/**
 * Hourly billing housekeeping.
 *
 *   POST /billing-jobs
 *   header: x-jobs-secret: $BILLING_JOBS_SECRET
 *
 * Run by pg_cron. Emails a masjid's admins 7 days and 1 day before its Pro
 * trial ends, once each.
 */
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendEmail } from '../_shared/email.ts';
import { adminEmails, getMasjidMembers } from '../_shared/masjid-admins.ts';
import { trialReminderEmail } from '../_shared/billing-emails.ts';

const BATCH_SIZE = 50;
const SOFT_DEADLINE_MS = 50_000;
const DAY_MS = 24 * 60 * 60 * 1000;

const REMINDERS = [
  { daysLeft: 7, column: 'trial_reminder_7d_at', after: 1, upTo: 7 },
  { daysLeft: 1, column: 'trial_reminder_1d_at', after: 0, upTo: 1 },
] as const;

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const sendTrialReminders = async (
  admin: SupabaseClient,
  reminder: (typeof REMINDERS)[number],
  startedAt: number
): Promise<{ sent: number; failed: number }> => {
  const now = Date.now();
  const { data, error } = await admin
    .from('masjid_billing')
    .select('masjid_id, trial_ends_at, masjid_profiles(name)')
    .eq('status', 'trial')
    .gt('trial_ends_at', new Date(now + reminder.after * DAY_MS).toISOString())
    .lte('trial_ends_at', new Date(now + reminder.upTo * DAY_MS).toISOString())
    .is(reminder.column, null)
    .limit(BATCH_SIZE);
  if (error) throw error;

  const due = (data ?? []) as unknown as {
    masjid_id: string;
    trial_ends_at: string;
    masjid_profiles: { name: string } | null;
  }[];

  const result = { sent: 0, failed: 0 };
  for (const row of due) {
    if (Date.now() - startedAt > SOFT_DEADLINE_MS) break;
    try {
      const to = adminEmails(await getMasjidMembers(admin, row.masjid_id));
      await sendEmail(
        trialReminderEmail(
          to,
          row.masjid_profiles?.name ?? 'Your masjid',
          row.trial_ends_at,
          reminder.daysLeft
        )
      );

      const { error: markError } = await admin
        .from('masjid_billing')
        .update({ [reminder.column]: new Date().toISOString() })
        .eq('masjid_id', row.masjid_id);
      if (markError) throw markError;
      result.sent += 1;
    } catch (e) {
      result.failed += 1;
      console.error(`${reminder.daysLeft}-day trial reminder failed for ${row.masjid_id}`, e);
    }
  }
  return result;
};

Deno.serve(async req => {
  const secret = Deno.env.get('BILLING_JOBS_SECRET');
  if (!secret) return json({ error: 'Jobs secret is not configured' }, 503);
  if (req.headers.get('x-jobs-secret') !== secret) return json({ error: 'Forbidden' }, 403);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const startedAt = Date.now();
  const summary = { sent: 0, failed: 0 };

  for (const reminder of REMINDERS) {
    try {
      const result = await sendTrialReminders(admin, reminder, startedAt);
      summary.sent += result.sent;
      summary.failed += result.failed;
    } catch (error) {
      summary.failed += 1;
      console.error(`billing-jobs ${reminder.daysLeft}-day reminders failed`, error);
    }
  }

  return json({ ok: summary.failed === 0, ...summary }, summary.failed === 0 ? 200 : 500);
});
