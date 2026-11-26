import { PublicRoutes } from '@/constants';

export const ALKHAIRIA_PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.alkhairia.dhikr';

/**
 * Null until Alkhairia is live on the App Store. Set it to the app's listing
 * (https://apps.apple.com/app/id<Apple ID from App Store Connect>) and iPhone
 * visitors get an App Store button instead of a "coming soon" note.
 */
export const ALKHAIRIA_APP_STORE_URL: string | null = null;

export type DevicePlatform = 'android' | 'ios' | 'other';

export const devicePlatform = (): DevicePlatform => {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  // iPadOS reports itself as a Mac; touch support gives it away.
  if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return 'ios';
  return 'other';
};

/**
 * The link a follow QR carries. Built on whatever host served this page, so it
 * moves to a new domain with the deployment. The path matches the Alkhairia
 * app's own masjid route, which is what lets the app open it directly.
 */
export const masjidFollowUrl = (masjidId: string): string =>
  `${window.location.origin}${PublicRoutes.Masjid.replace(':id', masjidId)}`;

export const masjidAppUrl = (masjidId: string): string => `alkhairia://masjid/${masjidId}`;
