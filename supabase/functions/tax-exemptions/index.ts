/**
 * Platform admin decisions on tax-exemption certificates.
 *
 *   POST /tax-exemptions  { action: 'approve', certificate_id, expires_at? }
 *   POST /tax-exemptions  { action: 'reject', certificate_id, reason }
 *   header: Authorization: Bearer <platform admin's access token>
 *
 * Only a pending certificate can be decided. The masjid's Stripe customer is
 * brought in line straight after, so the next charge reflects the decision.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getStripe } from '../_shared/stripe.ts';
import { syncTaxExemption } from '../_shared/tax-exemption.ts';

const REASON_MAX = 500;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, baggage, sentry-trace',
};

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing authorization header' }, 401);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const {
    data: { user: caller },
  } = await admin.auth.getUser(authHeader.replace('Bearer ', ''));
  if (!caller) return json({ error: 'Invalid token' }, 401);

  const { data: platformAdmin } = await admin
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', caller.id)
    .maybeSingle();
  if (!platformAdmin) return json({ error: 'Not allowed' }, 403);

  let payload: {
    action?: unknown;
    certificate_id?: unknown;
    expires_at?: unknown;
    reason?: unknown;
  };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  const id = typeof payload.certificate_id === 'string' ? payload.certificate_id : '';
  if (!UUID_PATTERN.test(id)) return json({ error: 'Unknown certificate' }, 400);
  if (payload.action !== 'approve' && payload.action !== 'reject') {
    return json({ error: 'Unknown action' }, 400);
  }

  const reason = typeof payload.reason === 'string' ? payload.reason.trim() : '';
  if (payload.action === 'reject' && !reason) {
    return json({ error: 'A rejection needs a reason' }, 400);
  }
  if (reason.length > REASON_MAX) {
    return json({ error: `Reason must be at most ${REASON_MAX} characters` }, 400);
  }

  let expiresAt: string | null = null;
  if (payload.action === 'approve' && payload.expires_at != null) {
    const parsed = typeof payload.expires_at === 'string' ? new Date(payload.expires_at) : null;
    if (!parsed || Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
      return json({ error: 'The expiry date must be in the future' }, 400);
    }
    expiresAt = parsed.toISOString();
  }

  const decided = {
    decided_at: new Date().toISOString(),
    decided_by: caller.id,
    ...(payload.action === 'approve'
      ? { status: 'approved', expires_at: expiresAt, rejection_reason: null }
      : { status: 'rejected', rejection_reason: reason }),
  };

  const { data: certificate, error } = await admin
    .from('tax_exemption_certificates')
    .update(decided)
    .eq('id', id)
    .eq('status', 'pending')
    .select('masjid_id')
    .maybeSingle();
  if (error) throw error;
  if (!certificate) return json({ error: 'This certificate is not waiting for a decision' }, 409);

  let stripe: 'exempt' | 'none' | 'no_customer' | 'failed';
  try {
    stripe = await syncTaxExemption(admin, getStripe(), certificate.masjid_id);
  } catch (e) {
    console.error(`tax exemption sync failed for ${certificate.masjid_id}`, e);
    stripe = 'failed';
  }

  return json({ ok: true, stripe });
});
