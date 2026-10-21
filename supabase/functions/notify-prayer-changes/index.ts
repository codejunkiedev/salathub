/**
 * Tells followers when a masjid's prayer times change.
 *
 *   POST /notify-prayer-changes
 *   header: x-notify-secret: $PRAYER_CHANGES_SECRET
 *
 * Run every few minutes by pg_cron. Each run claims masjids whose last edit is
 * two minutes old, resolves their next two weeks under the settings saved before
 * the first edit and under the current ones, and pushes one message per masjid.
 */
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  computeDays,
  configFromRows,
  fetchDaysByIsoDate,
  loadTimingsConfig,
  type MasjidTimingsConfig,
  type PrayerTimesRow,
  type ProfileRow,
  type SettingsRow,
} from '../_shared/masjid-timings.ts';
import {
  isoDateRange,
  shiftIsoDate,
  todayInTimeZone,
  type AlAdhanDay,
} from '../_shared/aladhan.ts';
import { describeChanges, diffPrayerDays, type DayTimes } from '../_shared/prayer-changes.ts';
import { sendPushMessages } from '../_shared/expo-push.ts';

const QUIET_SECONDS = 120;
const CLAIM_LIMIT = 20;
const WINDOW_DAYS = 13;
const SOFT_DEADLINE_MS = 50_000;
const ANDROID_CHANNEL_ID = 'masjid-updates';

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const followerTokens = async (admin: SupabaseClient, masjidId: string): Promise<string[]> => {
  const { data, error } = await admin
    .from('push_devices')
    .select('expo_push_token, push_subscriptions!inner(masjid_id)')
    .eq('push_subscriptions.masjid_id', masjidId);
  if (error) throw error;

  return (data ?? []).map(row => row.expo_push_token as string);
};

interface Snapshot {
  profile: ProfileRow | null;
  settings: SettingsRow | null;
  prayer_times: PrayerTimesRow | null;
}

interface QueuedChange {
  masjid_id: string;
  changed_at: string;
  previous: Snapshot | null;
}

const processMasjid = async (
  admin: SupabaseClient,
  { masjid_id: masjidId, previous }: QueuedChange
) => {
  const current = await loadTimingsConfig(admin, masjidId);
  if (!current || !previous?.profile) return { sent: 0, changes: 0 };

  const before = configFromRows(
    masjidId,
    previous.profile,
    previous.settings,
    previous.prayer_times
  );
  const today = todayInTimeZone(current.timezone);
  const toIso = shiftIsoDate(today, WINDOW_DAYS);
  const days = isoDateRange(today, toIso);

  // Both sides resolve against the same Al-Adhan answer, so only the masjid's
  // own settings can differ between them.
  const sources = new Map<string, Promise<Map<string, AlAdhanDay>>>();
  const source = (config: MasjidTimingsConfig) => {
    const key = [
      config.latitude,
      config.longitude,
      config.method,
      config.school,
      config.calendarMethod,
    ].join('|');
    if (!sources.has(key)) sources.set(key, fetchDaysByIsoDate(config, today, toIso));
    return sources.get(key)!;
  };

  const [oldSource, newSource] = await Promise.all([source(before), source(current)]);
  const toDayTimes = (rows: { day: string; times: DayTimes['times'] }[]): DayTimes[] =>
    rows.map(row => ({ day: row.day, times: row.times }));

  const changes = diffPrayerDays(
    toDayTimes(computeDays(before, days, oldSource)),
    toDayTimes(computeDays(current, days, newSource))
  );

  const { data: profile, error: profileError } = await admin
    .from('masjid_profiles')
    .select('name')
    .eq('id', masjidId)
    .single();
  if (profileError) throw profileError;

  const message = describeChanges(profile.name, changes, today);
  if (!message) return { sent: 0, changes: 0 };

  const tokens = await followerTokens(admin, masjidId);
  const result = await sendPushMessages(
    tokens.map(to => ({
      to,
      ...message,
      channelId: ANDROID_CHANNEL_ID,
      data: { type: 'timings_changed', masjidId },
    }))
  );

  if (result.unregistered.length > 0) {
    await admin.from('push_devices').delete().in('expo_push_token', result.unregistered);
  }

  return { sent: result.sent, changes: changes.length };
};

Deno.serve(async req => {
  const secret = Deno.env.get('PRAYER_CHANGES_SECRET');
  if (!secret) return json({ error: 'Notify secret is not configured' }, 503);
  if (req.headers.get('x-notify-secret') !== secret) return json({ error: 'Forbidden' }, 403);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const startedAt = Date.now();
  const summary = { claimed: 0, notified: 0, sent: 0, failed: 0, requeued: 0 };

  const { data: claimed, error } = await admin.rpc('claim_prayer_changes', {
    p_quiet_seconds: QUIET_SECONDS,
    p_limit: CLAIM_LIMIT,
  });
  if (error) {
    console.error('claim_prayer_changes failed', error);
    return json({ error: 'Claim failed' }, 500);
  }

  const queue = (claimed ?? []) as QueuedChange[];
  summary.claimed = queue.length;

  for (const item of queue) {
    const outOfTime = Date.now() - startedAt > SOFT_DEADLINE_MS;

    try {
      if (outOfTime) throw new Error('deadline');
      const result = await processMasjid(admin, item);
      if (result.changes > 0) summary.notified += 1;
      summary.sent += result.sent;
    } catch (e) {
      if (!outOfTime) {
        summary.failed += 1;
        console.error(`notify-prayer-changes failed for ${item.masjid_id}`, e);
      }
      // Back on the queue with the older snapshot, which covers any newer edit too.
      const { error: requeueError } = await admin
        .from('masjid_prayer_changes')
        .upsert(
          { masjid_id: item.masjid_id, changed_at: item.changed_at, previous: item.previous },
          { onConflict: 'masjid_id' }
        );
      if (requeueError) console.error('requeue failed', requeueError);
      else summary.requeued += 1;
    }
  }

  return json({ ok: summary.failed === 0, ...summary });
});
