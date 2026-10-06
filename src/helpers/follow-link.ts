import { PublicRoutes } from '@/constants';

export const ALKHAIRIA_PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.alkhairia.dhikr';

/**
 * The link a follow QR carries. Built on whatever host served this page, so it
 * moves to a new domain with the deployment. The path matches the Alkhairia
 * app's own masjid route, which is what lets the app open it directly.
 */
export const masjidFollowUrl = (masjidId: string): string =>
  `${window.location.origin}${PublicRoutes.Masjid.replace(':id', masjidId)}`;

export const masjidAppUrl = (masjidId: string): string => `alkhairia://masjid/${masjidId}`;
