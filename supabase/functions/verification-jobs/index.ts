/**
 * Hourly verification housekeeping.
 *
 *   POST /verification-jobs
 *   header: x-jobs-secret: $VERIFICATION_JOBS_SECRET
 *
 * Run by pg_cron. Deletes verification documents 90 days after a decision, and
 * emails a masjid in its grace period once, asking it to verify.
 */
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendEmail } from '../_shared/email.ts';
import { adminEmails, getMasjidAdminContacts } from '../_shared/masjid-admins.ts';
import { graceWarningEmail } from '../_shared/verification-emails.ts';

const BUCKET = 'verification-documents';
const BATCH_SIZE = 100;
const WARNING_BATCH_SIZE = 50;
const SOFT_DEADLINE_MS = 50_000;

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/** Removes the files first, then their rows, so a failed run leaves rows to retry. */
const purgeDocuments = async (admin: SupabaseClient, startedAt: number): Promise<number> => {
  let purged = 0;

  while (Date.now() - startedAt < SOFT_DEADLINE_MS) {
    const { data, error } = await admin.rpc('list_purgeable_verification_documents', {
      p_limit: BATCH_SIZE,
    });
    if (error) throw error;

    const batch = (data ?? []) as { id: string; storage_path: string }[];
    if (batch.length === 0) break;

    const { error: removeError } = await admin.storage
      .from(BUCKET)
      .remove(batch.map(doc => doc.storage_path));
    if (removeError) throw removeError;

    const { error: deleteError } = await admin
      .from('verification_documents')
      .delete()
      .in(
        'id',
        batch.map(doc => doc.id)
      );
    if (deleteError) throw deleteError;

    purged += batch.length;
    if (batch.length < BATCH_SIZE) break;
  }

  return purged;
};

const sendGraceWarnings = async (
  admin: SupabaseClient,
  startedAt: number
): Promise<{ warned: number; failed: number }> => {
  const { data, error } = await admin
    .from('masjid_verifications')
    .select('masjid_id, grace_until, masjid_profiles(name)')
    .in('status', ['not_submitted', 'rejected'])
    .gt('grace_until', new Date().toISOString())
    .is('grace_warned_at', null)
    .is('suspended_at', null)
    .limit(WARNING_BATCH_SIZE);
  if (error) throw error;

  const due = (data ?? []) as unknown as {
    masjid_id: string;
    grace_until: string;
    masjid_profiles: { name: string } | null;
  }[];

  const result = { warned: 0, failed: 0 };
  for (const row of due) {
    if (Date.now() - startedAt > SOFT_DEADLINE_MS) break;
    try {
      const to = adminEmails(await getMasjidAdminContacts(admin, row.masjid_id));
      await sendEmail(
        graceWarningEmail(to, row.masjid_profiles?.name ?? 'Your masjid', row.grace_until)
      );

      const { error: markError } = await admin
        .from('masjid_verifications')
        .update({ grace_warned_at: new Date().toISOString() })
        .eq('masjid_id', row.masjid_id);
      if (markError) throw markError;
      result.warned += 1;
    } catch (e) {
      result.failed += 1;
      console.error(`grace warning failed for ${row.masjid_id}`, e);
    }
  }
  return result;
};

Deno.serve(async req => {
  const secret = Deno.env.get('VERIFICATION_JOBS_SECRET');
  if (!secret) return json({ error: 'Jobs secret is not configured' }, 503);
  if (req.headers.get('x-jobs-secret') !== secret) return json({ error: 'Forbidden' }, 403);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const startedAt = Date.now();
  const summary = { purged: 0, warned: 0, failed: 0 };

  try {
    summary.purged = await purgeDocuments(admin, startedAt);
  } catch (error) {
    summary.failed += 1;
    console.error('verification-jobs purge failed', error);
  }

  try {
    const warnings = await sendGraceWarnings(admin, startedAt);
    summary.warned = warnings.warned;
    summary.failed += warnings.failed;
  } catch (error) {
    summary.failed += 1;
    console.error('verification-jobs warnings failed', error);
  }

  return json({ ok: summary.failed === 0, ...summary }, summary.failed === 0 ? 200 : 500);
});
