/**
 * Fills `masjid_prayer_days` ahead of the phones asking.
 *
 * `masjid-directory` already computes on a miss, so this is an optimisation, not
 * a dependency: it keeps the first follower of the day off the Al-Adhan round
 * trip, and it is where a failure shows up as a failed run rather than as one
 * slow request nobody sees. Wire it to a nightly schedule.
 *
 *   POST /warm-prayer-cache      { "days": 30 }
 *   header: x-warm-secret: $PRAYER_CACHE_WARM_SECRET
 *
 * Resumable by design: work already cached is skipped, so a run cut short by the
 * deadline is continued by simply invoking it again.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { listInAppMasjidIds, loadTimingsConfig, resolveWindow } from '../_shared/masjid-timings.ts';
import { shiftIsoDate, todayInTimeZone } from '../_shared/aladhan.ts';

const DEFAULT_DAYS_AHEAD = 30;
const MAX_DAYS_AHEAD = 60;
/** Leaves room to answer before the platform cuts the invocation off. */
const SOFT_DEADLINE_MS = 50_000;

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

Deno.serve(async req => {
  const secret = Deno.env.get('PRAYER_CACHE_WARM_SECRET');
  // Fail closed: without a configured secret this endpoint would be an open
  // invitation to spend the project's Al-Adhan budget.
  if (!secret) return json({ error: 'Warm secret is not configured' }, 503);
  if (req.headers.get('x-warm-secret') !== secret) return json({ error: 'Forbidden' }, 403);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  let daysAhead = DEFAULT_DAYS_AHEAD;
  try {
    const body = (await req.json()) as { days?: number };
    if (typeof body?.days === 'number' && Number.isFinite(body.days)) {
      daysAhead = Math.min(Math.max(Math.trunc(body.days), 1), MAX_DAYS_AHEAD);
    }
  } catch {
    // No body is the normal case for a scheduled call.
  }

  const startedAt = Date.now();
  const summary = { masjids: 0, warmed: 0, days: 0, skipped: 0, failed: 0, remaining: 0 };

  try {
    const masjidIds = await listInAppMasjidIds(admin);
    summary.masjids = masjidIds.length;

    for (const [index, masjidId] of masjidIds.entries()) {
      if (Date.now() - startedAt > SOFT_DEADLINE_MS) {
        summary.remaining = masjidIds.length - index;
        break;
      }

      try {
        const config = await loadTimingsConfig(admin, masjidId);
        if (!config) {
          summary.skipped += 1;
          continue;
        }

        const today = todayInTimeZone(config.timezone);
        const resolved = await resolveWindow(admin, config, today, shiftIsoDate(today, daysAhead));
        summary.warmed += 1;
        summary.days += resolved.length;
      } catch (error) {
        // One masjid with a bad configuration should not stop the rest.
        summary.failed += 1;
        console.error(`warm-prayer-cache failed for ${masjidId}`, error);
      }
    }

    return json({ ok: summary.failed === 0, ...summary });
  } catch (error) {
    console.error('warm-prayer-cache failed', error);
    return json({ error: 'Warm run failed' }, 500);
  }
});
