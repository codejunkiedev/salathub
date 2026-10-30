import { lazy } from 'react';

export const PlatformQueue = lazy(() => import('./queue'));
export const PlatformMasjids = lazy(() => import('./masjids'));
export const PlatformMasjidDetail = lazy(() => import('./masjid-detail'));
export const PlatformReports = lazy(() => import('./reports'));
