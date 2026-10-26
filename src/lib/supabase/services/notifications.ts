import { SupabaseTables, type MasjidNotification } from '@/types';
import type { FollowerNotificationData } from '../../zod';
import supabase from '../index';
import { getMasjidMembership } from '../helpers';
import { captureSupabaseError } from '@/lib/sentry';

export class NotificationLimitError extends Error {
  retryAt: Date | null;

  constructor(message: string, retryAt: string | null) {
    super(message);
    this.retryAt = retryAt ? new Date(retryAt) : null;
  }
}

export async function getMasjidNotifications(): Promise<MasjidNotification[]> {
  const { masjid_id } = await getMasjidMembership();

  const { data, error } = await supabase
    .from(SupabaseTables.MasjidNotifications)
    .select('*')
    .eq('masjid_id', masjid_id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function countMasjidFollowers(): Promise<number> {
  const { data, error } = await supabase.rpc('count_masjid_followers');
  if (error) throw error;
  return data ?? 0;
}

export async function notifyFollowers(
  notification: FollowerNotificationData
): Promise<MasjidNotification> {
  const { data, error } = await supabase.functions.invoke('notify-followers', {
    body: notification,
  });

  if (error) {
    if ('context' in error && error.context instanceof Response) {
      const body = await error.context.json().catch(() => null);
      if (body?.code === 'daily_limit') {
        throw new NotificationLimitError(body.error, body.retry_at ?? null);
      }
      if (body?.error) throw new Error(body.error);
    }
    captureSupabaseError(error, { source: 'supabase.functions', operation: 'notify_followers' });
    throw new Error(error.message || 'Failed to send the notification');
  }

  return data as MasjidNotification;
}
