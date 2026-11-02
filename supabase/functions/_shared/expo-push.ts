import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH_SIZE = 100;

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channelId?: string;
}

interface PushTicket {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

export interface PushResult {
  sent: number;
  failed: number;
  unregistered: string[];
}

export const sendPushMessages = async (messages: PushMessage[]): Promise<PushResult> => {
  const result: PushResult = { sent: 0, failed: 0, unregistered: [] };
  const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');

  for (let start = 0; start < messages.length; start += BATCH_SIZE) {
    const batch = messages.slice(start, start + BATCH_SIZE);

    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(
        batch.map(message => ({ sound: 'default', priority: 'high', ...message }))
      ),
    });

    if (!response.ok) {
      console.error(`Expo push batch failed: ${response.status} ${await response.text()}`);
      result.failed += batch.length;
      continue;
    }

    const { data } = (await response.json()) as { data?: PushTicket[] };
    (data ?? []).forEach((ticket, index) => {
      if (ticket.status === 'ok') {
        result.sent += 1;
        return;
      }
      result.failed += 1;
      if (ticket.details?.error === 'DeviceNotRegistered') {
        result.unregistered.push(batch[index].to);
      } else {
        console.error(`Expo push ticket error: ${ticket.message ?? ticket.details?.error}`);
      }
    });
  }

  return result;
};

export const followerTokens = async (
  admin: SupabaseClient,
  masjidId: string
): Promise<string[]> => {
  const { data, error } = await admin
    .from('push_devices')
    .select('expo_push_token, push_subscriptions!inner(masjid_id)')
    .eq('push_subscriptions.masjid_id', masjidId);
  if (error) throw error;

  return (data ?? []).map(row => row.expo_push_token as string);
};
