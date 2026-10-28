/**
 * The public read API for the mobile app: find listed masjids, and read the
 * prayer times of the ones a phone follows.
 *
 *   GET /nearby?lat=&lng=&radius_km=&limit=
 *   GET /search?q=&lat=&lng=&limit=
 *   GET /masjids?ids=<uuid>,<uuid>
 *   GET /timings?masjid_id=<uuid>&from=YYYY-MM-DD&to=YYYY-MM-DD
 *   GET /feed?ids=<uuid>,<uuid>&limit=&offset=
 *   POST /devices    { device_id, token, platform, masjid_ids }
 *   DELETE /devices  { device_id }
 *
 * Why a function rather than RPCs the app calls directly: 20260909000002 took
 * every table read away from `anon` after the old policies turned the publishable
 * key into a list of every masjid's contact details and every screen's login
 * code. Serving the directory from here keeps that shut — the SQL functions are
 * granted to service_role alone — and leaves one place to hold the rate limit and
 * the column whitelist.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { defaultWindow, loadTimingsConfig, resolveWindow } from '../_shared/masjid-timings.ts';
import { shiftIsoDate, timeInTimeZone, todayInTimeZone } from '../_shared/aladhan.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
};

const MAX_FOLLOWED_IDS = 50;
const MAX_WINDOW_DAYS = 40;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PUSH_TOKEN_PATTERN = /^Expo(nent)?PushToken\[[^\]]{1,200}\]$/;
const PLATFORMS = ['ios', 'android'];

/**
 * Best-effort throttle. The directory is a deliberate enumeration of masjids
 * that opted into being found, so this is about keeping a crawler from turning
 * it into Al-Adhan traffic, not about secrecy. Per instance, and instances come
 * and go — a real ceiling would need a shared counter.
 */
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 60;
const hits = new Map<string, { count: number; resetAt: number }>();

const rateLimited = (key: string): boolean => {
  const now = Date.now();
  const entry = hits.get(key);

  if (!entry || entry.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    if (hits.size > 5_000) {
      for (const [ip, seen] of hits) if (seen.resetAt <= now) hits.delete(ip);
    }
    return false;
  }

  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX_REQUESTS;
};

const json = (body: unknown, status = 200, cacheSeconds = 0): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': cacheSeconds > 0 ? `public, max-age=${cacheSeconds}` : 'no-store',
    },
  });

const numberParam = (params: URLSearchParams, key: string): number | null => {
  const raw = params.get(key);
  if (raw === null || raw.trim() === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
};

const idsParam = (params: URLSearchParams): string[] =>
  (params.get('ids') ?? '')
    .split(',')
    .map(id => id.trim())
    .filter(id => UUID_PATTERN.test(id))
    .slice(0, MAX_FOLLOWED_IDS);

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) {
    return json({ error: 'Method not allowed' }, 405);
  }

  const clientIp = (req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
  if (rateLimited(clientIp)) return json({ error: 'Too many requests' }, 429);

  const url = new URL(req.url);
  const route = url.pathname.split('/').filter(Boolean).pop() ?? '';
  const params = url.searchParams;

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    if (route === 'devices') {
      if (req.method === 'GET') return json({ error: 'Method not allowed' }, 405);

      const body = (await req.json().catch(() => null)) as {
        device_id?: unknown;
        token?: unknown;
        platform?: unknown;
        masjid_ids?: unknown;
      } | null;
      const deviceId = typeof body?.device_id === 'string' ? body.device_id : '';
      if (!UUID_PATTERN.test(deviceId)) return json({ error: 'device_id is required' }, 400);

      if (req.method === 'DELETE') {
        const { error } = await admin.from('push_devices').delete().eq('id', deviceId);
        if (error) throw error;
        return json({ ok: true });
      }

      const token = typeof body?.token === 'string' ? body.token : '';
      const platform = typeof body?.platform === 'string' ? body.platform : '';
      if (!PUSH_TOKEN_PATTERN.test(token)) return json({ error: 'token is invalid' }, 400);
      if (!PLATFORMS.includes(platform)) return json({ error: 'platform is invalid' }, 400);

      const masjidIds = (Array.isArray(body?.masjid_ids) ? body.masjid_ids : [])
        .filter((id): id is string => typeof id === 'string' && UUID_PATTERN.test(id))
        .slice(0, MAX_FOLLOWED_IDS);

      const { error } = await admin.rpc('register_push_device', {
        p_device_id: deviceId,
        p_token: token,
        p_platform: platform,
        p_masjid_ids: masjidIds,
      });
      if (error) throw error;

      return json({ ok: true });
    }

    if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

    if (route === 'nearby') {
      const lat = numberParam(params, 'lat');
      const lng = numberParam(params, 'lng');
      if (lat === null || lng === null) {
        return json({ error: 'lat and lng are required' }, 400);
      }

      const { data, error } = await admin.rpc('search_masjids_nearby', {
        p_lat: lat,
        p_lng: lng,
        p_radius_km: numberParam(params, 'radius_km'),
        p_limit: numberParam(params, 'limit'),
      });
      if (error) throw error;

      return json({ masjids: data ?? [] }, 200, 300);
    }

    if (route === 'search') {
      const query = (params.get('q') ?? '').trim();
      if (query.length < 2) return json({ error: 'q must be at least 2 characters' }, 400);

      const { data, error } = await admin.rpc('search_masjids_by_name', {
        p_query: query,
        p_lat: numberParam(params, 'lat'),
        p_lng: numberParam(params, 'lng'),
        p_limit: numberParam(params, 'limit'),
      });
      if (error) throw error;

      return json({ masjids: data ?? [] }, 200, 300);
    }

    if (route === 'masjids') {
      const ids = idsParam(params);
      if (ids.length === 0) return json({ masjids: [] }, 200, 300);

      const { data, error } = await admin.rpc('get_masjids_public', { p_ids: ids });
      if (error) throw error;

      return json({ masjids: data ?? [] }, 200, 300);
    }

    if (route === 'feed') {
      const ids = idsParam(params);
      if (ids.length === 0) return json({ items: [] }, 200, 60);

      const { data, error } = await admin.rpc('get_masjid_feed', {
        p_ids: ids,
        p_limit: numberParam(params, 'limit'),
        p_offset: numberParam(params, 'offset'),
      });
      if (error) throw error;

      return json({ items: data ?? [] }, 200, 60);
    }

    if (route === 'timings') {
      const masjidId = (params.get('masjid_id') ?? '').trim();
      if (!UUID_PATTERN.test(masjidId)) return json({ error: 'masjid_id is required' }, 400);

      const config = await loadTimingsConfig(admin, masjidId);
      // Not listed, gone, or never given coordinates. One answer for all three:
      // the phone should stop asking either way.
      if (!config) return json({ error: 'Masjid is not available' }, 404);

      const window = defaultWindow(config.timezone);
      const from = params.get('from');
      const to = params.get('to');
      const fromIso = from && ISO_DATE_PATTERN.test(from) ? from : window.fromIso;
      const requestedTo = to && ISO_DATE_PATTERN.test(to) ? to : window.toIso;
      // Clamped so one request cannot ask for a year of Al-Adhan months.
      const maxTo = shiftIsoDate(fromIso, MAX_WINDOW_DAYS);
      const toIso = requestedTo > maxTo ? maxTo : requestedTo;

      if (toIso < fromIso) return json({ error: 'to must not precede from' }, 400);

      const [{ data: masjids, error: masjidError }, days] = await Promise.all([
        admin.rpc('get_masjids_public', { p_ids: [masjidId] }),
        resolveWindow(admin, config, fromIso, toIso),
      ]);
      if (masjidError) throw masjidError;

      return json(
        {
          masjid: masjids?.[0] ?? null,
          timezone: config.timezone,
          // The masjid's own clock, sent along so the phone can count down to the
          // next jamaat without carrying a timezone database or trusting the
          // device's. `instant` is what the app measures elapsed time against.
          now: {
            date: todayInTimeZone(config.timezone),
            time: timeInTimeZone(config.timezone),
            instant: new Date().toISOString(),
          },
          from: fromIso,
          to: toIso,
          days,
        },
        200,
        300
      );
    }

    return json({ error: 'Not found' }, 404);
  } catch (error) {
    console.error(`masjid-directory ${route} failed`, error);
    return json({ error: 'Directory request failed' }, 500);
  }
});
