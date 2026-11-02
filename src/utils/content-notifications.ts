import type { AppContentType, ContentNotificationStatus } from '@/types';

/** Whether an item that is about to show in the app will notify followers, in one line. */
export function contentNotificationLine(
  status: ContentNotificationStatus | null,
  type: AppContentType
): string | null {
  if (!status) return null;
  if (!status.in_app) {
    return "Followers won't be notified: the masjid isn't in the Alkhairia app yet.";
  }
  if (!status[type]) {
    return `Followers won't be notified: notifications for ${type} are turned off.`;
  }
  if (status.sent_today >= status.daily_limit) {
    return `Followers won't be notified: the limit of ${status.daily_limit} notifications in 24 hours has been reached.`;
  }
  return 'Followers in the app will be notified.';
}
