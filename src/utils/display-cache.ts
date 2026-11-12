import type {
  Announcement,
  AyatAndHadith,
  DisplayScreen,
  Event,
  Post,
  ScreenContent,
  Settings,
  YouTubeVideo,
} from '@/types';

const DISPLAY_CACHE_PREFIX = 'display_data_cache_v1';

type CachedContentRecord = Announcement | Event | Post | YouTubeVideo | AyatAndHadith;

export type DisplayDataCache = {
  settings: Settings | null;
  screen: DisplayScreen;
  screenContent: ScreenContent[];
  contentItems: Record<string, CachedContentRecord>;
  /** Missing in caches written before the badge existed. */
  showBadge?: boolean;
};

const cacheKey = (screenId: string) => `${DISPLAY_CACHE_PREFIX}:${screenId}`;

export const readDisplayCache = (screenId: string): DisplayDataCache | null => {
  try {
    const raw = localStorage.getItem(cacheKey(screenId));
    if (!raw) return null;
    return JSON.parse(raw) as DisplayDataCache;
  } catch {
    return null;
  }
};

export const writeDisplayCache = (screenId: string, payload: DisplayDataCache): void => {
  try {
    localStorage.setItem(cacheKey(screenId), JSON.stringify(payload));
  } catch {
    // Ignore quota / serialization errors — cache is best-effort.
  }
};
