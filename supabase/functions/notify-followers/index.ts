/**
 * Sends a masjid's own message to the phones that follow it.
 *
 *   POST /notify-followers  { title, body }
 *   header: Authorization: Bearer <member's access token>
 *
 * Any admin or moderator can send, up to DAILY_LIMIT messages per masjid in a
 * rolling 24 hours.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendPushMessages } from '../_shared/expo-push.ts';

const DAILY_LIMIT = 3;
const TITLE_MAX = 50;
const BODY_MAX = 150;
const ANDROID_CHANNEL_ID = 'masjid-updates';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing authorization header' }, 401);

  const {
    data: { user: caller },
  } = await admin.auth.getUser(authHeader.replace('Bearer ', ''));
  if (!caller) return json({ error: 'Invalid token' }, 401);

  const { data: membership } = await admin
    .from('masjid_members')
    .select('masjid_id, name')
    .eq('user_id', caller.id)
    .maybeSingle();
  if (!membership) return json({ error: 'You are not a member of a masjid' }, 403);

  let payload: { title?: unknown; body?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  const body = typeof payload.body === 'string' ? payload.body.trim() : '';
  if (!title || title.length > TITLE_MAX) {
    return json({ error: `Title is required and must be at most ${TITLE_MAX} characters` }, 400);
  }
  if (!body || body.length > BODY_MAX) {
    return json({ error: `Message is required and must be at most ${BODY_MAX} characters` }, 400);
  }

  const masjidId = membership.masjid_id as string;

  const { data: profile, error: profileError } = await admin
    .from('masjid_profiles')
    .select('listed, name')
    .eq('id', masjidId)
    .single();
  if (profileError) {
    console.error('notify-followers profile lookup failed', profileError);
    return json({ error: 'Could not load the masjid' }, 500);
  }
  if (!profile.listed) {
    return json({ error: 'List the masjid in the Alkhairia app before notifying followers' }, 409);
  }

  const { data: claimed, error: claimError } = await admin.rpc('claim_masjid_notification', {
    p_masjid_id: masjidId,
    p_sent_by: caller.id,
    p_sent_by_name: (membership.name as string) || caller.email || 'Unknown',
    p_title: title,
    p_body: body,
    p_limit: DAILY_LIMIT,
    p_window: '24 hours',
  });
  if (claimError) {
    console.error('claim_masjid_notification failed', claimError);
    return json({ error: 'Could not send the notification' }, 500);
  }

  const claim = (claimed as { id: string | null; retry_at: string | null }[])[0];
  if (!claim?.id) {
    return json(
      {
        error: `A masjid can send ${DAILY_LIMIT} notifications in 24 hours. The limit has been reached.`,
        code: 'daily_limit',
        retry_at: claim?.retry_at ?? null,
      },
      429
    );
  }

  let result;
  try {
    const { data: rows, error: tokensError } = await admin
      .from('push_devices')
      .select('expo_push_token, push_subscriptions!inner(masjid_id)')
      .eq('push_subscriptions.masjid_id', masjidId);
    if (tokensError) throw tokensError;

    result = await sendPushMessages(
      (rows ?? []).map(row => ({
        to: row.expo_push_token as string,
        title: profile.name ? `${profile.name}: ${title}` : title,
        body,
        channelId: ANDROID_CHANNEL_ID,
        data: { type: 'masjid_message', masjidId },
      }))
    );
  } catch (e) {
    console.error(`notify-followers failed for ${masjidId}`, e);
    await admin.from('masjid_notifications').delete().eq('id', claim.id);
    return json({ error: 'Could not send the notification' }, 500);
  }

  if (result.unregistered.length > 0) {
    await admin.from('push_devices').delete().in('expo_push_token', result.unregistered);
  }

  const { data: sent, error: updateError } = await admin
    .from('masjid_notifications')
    .update({ devices_reached: result.sent })
    .eq('id', claim.id)
    .select()
    .single();
  if (updateError) console.error('notify-followers history update failed', updateError);

  return json(sent ?? { id: claim.id, devices_reached: result.sent });
});
