/**
 * Platform admin actions on a masjid.
 *
 *   POST /review-masjid  { action, masjid_id, reason? }
 *   POST /review-masjid  { action: 'remove_item', target_kind, target_id, reason }
 *   header: Authorization: Bearer <platform admin's access token>
 *
 * approve / reject decide a pending verification and email the masjid's
 * admins. suspend / restore change its app presence; suspending also closes
 * the open reports about the masjid. contacts lists its admins so a reviewer
 * can match them against the documents. remove_item takes a reported feed item
 * out of the app and emails the masjid's admins why.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendEmail } from '../_shared/email.ts';
import { adminEmails, getMasjidAdminContacts } from '../_shared/masjid-admins.ts';
import { approvedEmail, rejectedEmail, removedItemEmail } from '../_shared/verification-emails.ts';

const ACTIONS = ['approve', 'reject', 'suspend', 'restore', 'contacts', 'remove_item'] as const;
const ITEM_KINDS = ['announcement', 'event', 'post'] as const;
type Action = (typeof ACTIONS)[number];

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
    masjid_id?: unknown;
    target_kind?: unknown;
    target_id?: unknown;
    reason?: unknown;
  };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  const action = payload.action as Action;
  const masjidId = typeof payload.masjid_id === 'string' ? payload.masjid_id : '';
  const reason = typeof payload.reason === 'string' ? payload.reason.trim() : '';
  if (!ACTIONS.includes(action)) return json({ error: 'Unknown action' }, 400);
  if (reason.length > REASON_MAX) {
    return json({ error: `Reason must be at most ${REASON_MAX} characters` }, 400);
  }

  // As the caller, so the functions record who decided.
  const asCaller = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });

  if (action === 'remove_item') {
    const kind = payload.target_kind as (typeof ITEM_KINDS)[number];
    const targetId = typeof payload.target_id === 'string' ? payload.target_id : '';
    if (!ITEM_KINDS.includes(kind)) return json({ error: 'Unknown target_kind' }, 400);
    if (!UUID_PATTERN.test(targetId)) return json({ error: 'target_id is required' }, 400);
    if (!reason) return json({ error: 'A removal needs a reason' }, 400);

    const { data: item, error } = await asCaller.rpc('set_feed_item_removal', {
      p_kind: kind,
      p_id: targetId,
      p_removed: true,
      p_reason: reason,
    });
    if (error) {
      const status = error.code === 'P0002' ? 404 : error.code === '42501' ? 403 : 400;
      return json({ error: error.message }, status);
    }

    const { masjid_id: itemMasjidId, title } = item as { masjid_id: string; title: string | null };
    let emailed = false;
    try {
      const [{ data: profile }, contacts] = await Promise.all([
        admin.from('masjid_profiles').select('name').eq('id', itemMasjidId).single(),
        getMasjidAdminContacts(admin, itemMasjidId),
      ]);
      const to = adminEmails(contacts);
      await sendEmail(removedItemEmail(to, profile?.name ?? 'Your masjid', kind, title, reason));
      emailed = to.length > 0;
    } catch (e) {
      console.error(`review-masjid removal email failed for ${targetId}`, e);
    }
    return json({ emailed });
  }

  if (!UUID_PATTERN.test(masjidId)) return json({ error: 'masjid_id is required' }, 400);
  if (action === 'reject' && !reason) return json({ error: 'A rejection needs a reason' }, 400);

  if (action === 'contacts') {
    return json({ admins: await getMasjidAdminContacts(admin, masjidId) });
  }

  const { data: verification, error } =
    action === 'approve' || action === 'reject'
      ? await asCaller.rpc('decide_masjid_verification', {
          p_masjid_id: masjidId,
          p_approve: action === 'approve',
          p_reason: reason || null,
        })
      : await asCaller.rpc('set_masjid_suspension', {
          p_masjid_id: masjidId,
          p_suspended: action === 'suspend',
          p_reason: reason || null,
        });

  if (error) {
    const status = error.code === 'P0002' ? 409 : error.code === '42501' ? 403 : 400;
    return json({ error: error.message }, status);
  }

  if (action === 'suspend') {
    const { error: closeError } = await asCaller.rpc('close_masjid_reports', {
      p_target_kind: 'masjid',
      p_target_id: masjidId,
      p_resolution: 'suspended',
    });
    if (closeError)
      console.error(`review-masjid closing reports failed for ${masjidId}`, closeError);
  }

  if (action !== 'approve' && action !== 'reject') return json({ verification, emailed: false });

  // The decision stands even if the email fails; the reviewer is told.
  let emailed = false;
  try {
    const [{ data: profile }, contacts] = await Promise.all([
      admin.from('masjid_profiles').select('name').eq('id', masjidId).single(),
      getMasjidAdminContacts(admin, masjidId),
    ]);
    const to = adminEmails(contacts);
    const name = profile?.name ?? 'Your masjid';
    await sendEmail(
      action === 'approve' ? approvedEmail(to, name) : rejectedEmail(to, name, reason)
    );
    emailed = to.length > 0;
  } catch (e) {
    console.error(`review-masjid email failed for ${masjidId}`, e);
  }

  return json({ verification, emailed });
});
