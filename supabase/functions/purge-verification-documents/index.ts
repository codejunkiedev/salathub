/**
 * Deletes verification documents 90 days after the masjid's decision.
 *
 *   POST /purge-verification-documents
 *   header: x-purge-secret: $VERIFICATION_PURGE_SECRET
 *
 * Run daily by pg_cron. Removes the files first, then their rows, so a failed
 * run leaves rows to retry rather than files nobody tracks.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BUCKET = 'verification-documents';
const BATCH_SIZE = 100;
const SOFT_DEADLINE_MS = 50_000;

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

Deno.serve(async req => {
  const secret = Deno.env.get('VERIFICATION_PURGE_SECRET');
  if (!secret) return json({ error: 'Purge secret is not configured' }, 503);
  if (req.headers.get('x-purge-secret') !== secret) return json({ error: 'Forbidden' }, 403);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const startedAt = Date.now();
  let purged = 0;

  try {
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

    return json({ ok: true, purged });
  } catch (error) {
    console.error('purge-verification-documents failed', error);
    return json({ error: 'Purge failed', purged }, 500);
  }
});
