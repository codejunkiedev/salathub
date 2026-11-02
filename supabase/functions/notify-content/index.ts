/**
 * Tells followers when an announcement, event or post first shows in the app.
 *
 *   POST /notify-content
 *   header: x-notify-secret: $CONTENT_NOTIFICATIONS_SECRET
 *
 * Run every minute by pg_cron. Each run claims items that showed in the app at
 * least two minutes ago and notifies for those still there, within the
 * masjid's switches and daily limit.
 */
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { followerTokens, sendPushMessages } from '../_shared/expo-push.ts';

const DELAY_SECONDS = 120;
const CLAIM_LIMIT = 50;
const SOFT_DEADLINE_MS = 50_000;
const TITLE_MAX = 65;
const BODY_MAX = 150;
const ANDROID_CHANNEL_ID = 'masjid-updates';

type ContentType = 'announcements' | 'events' | 'posts';

interface QueuedItem {
  content_type: ContentType;
  content_id: string;
  queued_at: string;
}

interface Item {
  masjid_id: string;
  title: string | null;
  description?: string;
  date_time?: string;
  ends_at?: string;
  location?: string;
  published_at: string | null;
  show_in_app: boolean;
  archived: boolean | null;
  removed_at: string | null;
}

interface Masjid {
  name: string;
  timezone: string;
}

const KIND: Record<ContentType, string> = {
  announcements: 'announcement',
  events: 'event',
  posts: 'post',
};

const EXTRA_COLUMNS: Record<ContentType, string> = {
  announcements: 'description',
  events: 'date_time, ends_at, location',
  posts: '',
};

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const clip = (text: string, max: number) =>
  text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;

const eventWhen = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone,
  }).format(new Date(iso));

const buildMessage = (type: ContentType, item: Item, masjid: Masjid) => {
  const title = item.title?.trim() ?? '';
  if (type === 'events') {
    return {
      title: clip(`New event: ${title}`, TITLE_MAX),
      body: clip(
        [eventWhen(item.date_time!, masjid.timezone), item.location?.trim()]
          .filter(Boolean)
          .join(' · '),
        BODY_MAX
      ),
    };
  }
  const body =
    title ||
    item.description?.trim().split('\n')[0] ||
    (type === 'posts' ? 'New post' : 'New announcement');
  return { title: clip(masjid.name, TITLE_MAX), body: clip(body, BODY_MAX) };
};

const isStillInApp = (type: ContentType, item: Item | null): item is Item =>
  !!item &&
  item.published_at !== null &&
  item.show_in_app &&
  !item.archived &&
  item.removed_at === null &&
  (type !== 'events' || new Date(item.ends_at!) >= new Date());

const processItem = async (
  admin: SupabaseClient,
  { content_type: type, content_id: id }: QueuedItem
): Promise<{ outcome: string; sent: number }> => {
  const extra = EXTRA_COLUMNS[type];
  const { data: item, error: itemError } = await admin
    .from(type)
    .select(
      `masjid_id, title, published_at, show_in_app, archived, removed_at${extra ? `, ${extra}` : ''}`
    )
    .eq('id', id)
    .maybeSingle();
  if (itemError) throw itemError;
  if (!isStillInApp(type, item as Item | null)) return { outcome: 'gone', sent: 0 };

  const masjidId = (item as Item).masjid_id;
  const { data: masjid, error: masjidError } = await admin
    .from('masjid_profiles')
    .select('name, timezone')
    .eq('id', masjidId)
    .single();
  if (masjidError) throw masjidError;

  const message = buildMessage(type, item as Item, masjid as Masjid);
  const { data: claimed, error: claimError } = await admin.rpc('claim_content_notification', {
    p_masjid_id: masjidId,
    p_content_type: type,
    p_content_id: id,
    p_title: message.title,
    p_body: message.body,
  });
  if (claimError) throw claimError;

  const claim = (claimed as { id: string | null; skipped: string | null }[])[0];
  if (!claim?.id) return { outcome: claim?.skipped ?? 'already_sent', sent: 0 };

  try {
    const tokens = await followerTokens(admin, masjidId);
    const result = await sendPushMessages(
      tokens.map(to => ({
        to,
        ...message,
        channelId: ANDROID_CHANNEL_ID,
        data: {
          type: 'masjid_content',
          masjidId,
          masjidName: (masjid as Masjid).name,
          kind: KIND[type],
          contentId: id,
        },
      }))
    );

    if (result.unregistered.length > 0) {
      await admin.from('push_devices').delete().in('expo_push_token', result.unregistered);
    }

    const { error: updateError } = await admin
      .from('masjid_content_notifications')
      .update({ devices_reached: result.sent })
      .eq('id', claim.id);
    if (updateError) console.error('notify-content history update failed', updateError);

    return { outcome: 'sent', sent: result.sent };
  } catch (e) {
    await admin.from('masjid_content_notifications').delete().eq('id', claim.id);
    throw e;
  }
};

Deno.serve(async req => {
  const secret = Deno.env.get('CONTENT_NOTIFICATIONS_SECRET');
  if (!secret) return json({ error: 'Notify secret is not configured' }, 503);
  if (req.headers.get('x-notify-secret') !== secret) return json({ error: 'Forbidden' }, 403);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const startedAt = Date.now();
  const summary = { claimed: 0, notified: 0, skipped: 0, sent: 0, failed: 0, requeued: 0 };

  const { data: claimed, error } = await admin.rpc('claim_content_notifications', {
    p_delay_seconds: DELAY_SECONDS,
    p_limit: CLAIM_LIMIT,
  });
  if (error) {
    console.error('claim_content_notifications failed', error);
    return json({ error: 'Claim failed' }, 500);
  }

  const queue = (claimed ?? []) as QueuedItem[];
  summary.claimed = queue.length;

  for (const item of queue) {
    const outOfTime = Date.now() - startedAt > SOFT_DEADLINE_MS;

    try {
      if (outOfTime) throw new Error('deadline');
      const result = await processItem(admin, item);
      if (result.outcome === 'sent') summary.notified += 1;
      else summary.skipped += 1;
      summary.sent += result.sent;
    } catch (e) {
      if (!outOfTime) {
        summary.failed += 1;
        console.error(`notify-content failed for ${item.content_type}/${item.content_id}`, e);
      }
      const { error: requeueError } = await admin
        .from('content_notification_queue')
        .upsert(item, { onConflict: 'content_type,content_id' });
      if (requeueError) console.error('requeue failed', requeueError);
      else summary.requeued += 1;
    }
  }

  return json({ ok: summary.failed === 0, ...summary });
});
