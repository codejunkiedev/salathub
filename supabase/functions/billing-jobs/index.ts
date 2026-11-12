/**
 * Hourly billing housekeeping.
 *
 *   POST /billing-jobs
 *   header: x-jobs-secret: $BILLING_JOBS_SECRET
 *
 * Run by pg_cron. Emails a masjid's admins before its Pro ends, once each:
 * 7 days and 1 day before a trial ends, 30 days and 7 days before free Pro
 * from our team ends. Takes expired tax-exemption certificates out of Stripe so
 * tax resumes, and warns admins 30 days before a certificate expires.
 */
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendEmail, type Email } from '../_shared/email.ts';
import { adminEmails, getMasjidMembers } from '../_shared/masjid-admins.ts';
import {
  exemptionExpiringEmail,
  grantEndingEmail,
  trialReminderEmail,
} from '../_shared/billing-emails.ts';
import { getStripe } from '../_shared/stripe.ts';
import { syncTaxExemption } from '../_shared/tax-exemption.ts';

const BATCH_SIZE = 50;
const SOFT_DEADLINE_MS = 50_000;
const DAY_MS = 24 * 60 * 60 * 1000;

type Reminder = {
  label: string;
  status: 'trial' | 'granted';
  endColumn: 'trial_ends_at' | 'granted_until';
  sentColumn: string;
  /** Sent once the end is within upTo days, unless it is already within `after` days. */
  after: number;
  upTo: number;
  email: (to: string[], name: string, endsAt: string, timeZone: string | null) => Email;
};

const REMINDERS: Reminder[] = [
  {
    label: '7-day trial',
    status: 'trial',
    endColumn: 'trial_ends_at',
    sentColumn: 'trial_reminder_7d_at',
    after: 1,
    upTo: 7,
    email: (to, name, endsAt, tz) => trialReminderEmail(to, name, endsAt, tz, 7),
  },
  {
    label: '1-day trial',
    status: 'trial',
    endColumn: 'trial_ends_at',
    sentColumn: 'trial_reminder_1d_at',
    after: 0,
    upTo: 1,
    email: (to, name, endsAt, tz) => trialReminderEmail(to, name, endsAt, tz, 1),
  },
  {
    label: '30-day grant',
    status: 'granted',
    endColumn: 'granted_until',
    sentColumn: 'grant_reminder_30d_at',
    after: 7,
    upTo: 30,
    email: (to, name, endsAt, tz) => grantEndingEmail(to, name, endsAt, tz, 30),
  },
  {
    label: '7-day grant',
    status: 'granted',
    endColumn: 'granted_until',
    sentColumn: 'grant_reminder_7d_at',
    after: 0,
    upTo: 7,
    email: (to, name, endsAt, tz) => grantEndingEmail(to, name, endsAt, tz, 7),
  },
];

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const sendReminders = async (
  admin: SupabaseClient,
  reminder: Reminder,
  startedAt: number
): Promise<{ sent: number; failed: number }> => {
  const now = Date.now();
  const { data, error } = await admin
    .from('masjid_billing')
    .select(`masjid_id, ${reminder.endColumn}, masjid_profiles(name, timezone)`)
    .eq('status', reminder.status)
    .gt(reminder.endColumn, new Date(now + reminder.after * DAY_MS).toISOString())
    .lte(reminder.endColumn, new Date(now + reminder.upTo * DAY_MS).toISOString())
    .is(reminder.sentColumn, null)
    .limit(BATCH_SIZE);
  if (error) throw error;

  const due = (data ?? []) as unknown as (Record<string, string> & {
    masjid_id: string;
    masjid_profiles: { name: string; timezone: string | null } | null;
  })[];

  const result = { sent: 0, failed: 0 };
  for (const row of due) {
    if (Date.now() - startedAt > SOFT_DEADLINE_MS) break;
    try {
      const to = adminEmails(await getMasjidMembers(admin, row.masjid_id));
      await sendEmail(
        reminder.email(
          to,
          row.masjid_profiles?.name ?? 'Your masjid',
          row[reminder.endColumn],
          row.masjid_profiles?.timezone ?? null
        )
      );

      const { error: markError } = await admin
        .from('masjid_billing')
        .update({ [reminder.sentColumn]: new Date().toISOString() })
        .eq('masjid_id', row.masjid_id);
      if (markError) throw markError;
      result.sent += 1;
    } catch (e) {
      result.failed += 1;
      console.error(`${reminder.label} reminder failed for ${row.masjid_id}`, e);
    }
  }
  return result;
};

type Certificate = {
  id: string;
  masjid_id: string;
  state: string;
  expires_at: string;
  masjid_profiles: { name: string; timezone: string | null } | null;
};

/** Expired approvals stop counting in Stripe; recorded once done. */
const lapseExemptions = async (admin: SupabaseClient, startedAt: number) => {
  const { data, error } = await admin
    .from('tax_exemption_certificates')
    .select('id, masjid_id')
    .eq('status', 'approved')
    .lte('expires_at', new Date().toISOString())
    .is('lapsed_at', null)
    .limit(BATCH_SIZE);
  if (error) throw error;

  const result = { sent: 0, failed: 0 };
  const stripe = (data ?? []).length > 0 ? getStripe() : null;
  for (const row of (data ?? []) as { id: string; masjid_id: string }[]) {
    if (Date.now() - startedAt > SOFT_DEADLINE_MS) break;
    try {
      await syncTaxExemption(admin, stripe!, row.masjid_id);
      const { error: markError } = await admin
        .from('tax_exemption_certificates')
        .update({ lapsed_at: new Date().toISOString() })
        .eq('id', row.id);
      if (markError) throw markError;
    } catch (e) {
      result.failed += 1;
      console.error(`tax exemption lapse failed for ${row.masjid_id}`, e);
    }
  }
  return result;
};

const warnExpiringExemptions = async (admin: SupabaseClient, startedAt: number) => {
  const now = Date.now();
  const { data, error } = await admin
    .from('tax_exemption_certificates')
    .select('id, masjid_id, state, expires_at, masjid_profiles(name, timezone)')
    .eq('status', 'approved')
    .gt('expires_at', new Date(now).toISOString())
    .lte('expires_at', new Date(now + 30 * DAY_MS).toISOString())
    .is('expiry_warned_at', null)
    .limit(BATCH_SIZE);
  if (error) throw error;

  const result = { sent: 0, failed: 0 };
  for (const row of (data ?? []) as unknown as Certificate[]) {
    if (Date.now() - startedAt > SOFT_DEADLINE_MS) break;
    try {
      const to = adminEmails(await getMasjidMembers(admin, row.masjid_id));
      await sendEmail(
        exemptionExpiringEmail(
          to,
          row.masjid_profiles?.name ?? 'Your masjid',
          row.state,
          row.expires_at,
          row.masjid_profiles?.timezone ?? null
        )
      );
      const { error: markError } = await admin
        .from('tax_exemption_certificates')
        .update({ expiry_warned_at: new Date().toISOString() })
        .eq('id', row.id);
      if (markError) throw markError;
      result.sent += 1;
    } catch (e) {
      result.failed += 1;
      console.error(`tax exemption expiry warning failed for ${row.masjid_id}`, e);
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
      const result = await sendReminders(admin, reminder, startedAt);
      summary.sent += result.sent;
      summary.failed += result.failed;
    } catch (error) {
      summary.failed += 1;
      console.error(`billing-jobs ${reminder.label} reminders failed`, error);
    }
  }

  for (const [label, job] of [
    ['exemption lapse', lapseExemptions],
    ['exemption expiry warning', warnExpiringExemptions],
  ] as const) {
    try {
      const result = await job(admin, startedAt);
      summary.sent += result.sent;
      summary.failed += result.failed;
    } catch (error) {
      summary.failed += 1;
      console.error(`billing-jobs ${label} failed`, error);
    }
  }

  return json({ ok: summary.failed === 0, ...summary }, summary.failed === 0 ? 200 : 500);
});
