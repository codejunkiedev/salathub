import { lazy } from 'react';

export * from './error-display';
export * from './logout';
export * from './paused-display';
export * from './powered-by-badge';

export const PrayerTimingDisplay = lazy(() =>
  import('./prayer-timings').then(m => ({ default: m.PrayerTimingDisplay }))
);
export const AnnouncementsDisplay = lazy(() =>
  import('./announcements').then(m => ({ default: m.AnnouncementsDisplay }))
);
export const PostsDisplay = lazy(() => import('./posts').then(m => ({ default: m.PostsDisplay })));
export const EventsDisplay = lazy(() =>
  import('./events').then(m => ({ default: m.EventsDisplay }))
);
export const WeatherDisplay = lazy(() =>
  import('./weather').then(m => ({ default: m.WeatherDisplay }))
);
export const FollowQrDisplay = lazy(() =>
  import('./follow-qr').then(m => ({ default: m.FollowQrDisplay }))
);
export const YouTubeVideoDisplay = lazy(() =>
  import('./youtube-videos').then(m => ({ default: m.YouTubeVideoDisplay }))
);
export const AyatHadithDisplay = lazy(() =>
  import('./ayat-hadith').then(m => ({ default: m.AyatHadithDisplay }))
);
