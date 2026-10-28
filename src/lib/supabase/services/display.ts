import type {
  Announcement,
  AyatAndHadith,
  DisplayScreen,
  Event,
  MasjidProfile,
  Post,
  PrayerTimes,
  ScreenContent,
  Settings,
  YouTubeVideo,
} from '@/types';
import supabase from '../index';

/**
 * The display's read path.
 *
 * Displays run as the `anon` role, whose key ships in the web bundle and in the
 * TV shell. That role has no SELECT on any content table — it reaches the data
 * through the SECURITY DEFINER functions below, each keyed by the screen's own
 * login code. The code acts as a bearer credential: checkable but not listable,
 * and it pins every result to the one masjid that owns the screen.
 *
 * See supabase/migrations/20260909000001_add_display_read_functions.sql.
 */

export type DisplayContentRecord = Announcement | Event | Post | YouTubeVideo | AyatAndHadith;

export type DisplaySession = {
  screen: DisplayScreen;
  masjid_profile: MasjidProfile | null;
};

export type DisplayPrayerSettings = {
  settings: Settings | null;
  prayer_times: PrayerTimes | null;
};

export type DisplayPayload = DisplaySession &
  DisplayPrayerSettings & {
    screen_content: ScreenContent[];
    /** Content rows the playlist points at, keyed by id. */
    content: Record<string, DisplayContentRecord>;
  };

/**
 * Exchanges a screen code for the screen and its masjid profile.
 * Resolves to null when the code doesn't match a screen.
 */
export async function getDisplaySession(code: string): Promise<DisplaySession | null> {
  const { data, error } = await supabase.rpc('get_display_session', { p_code: code });
  if (error) throw error;
  return (data as DisplaySession | null) ?? null;
}

/**
 * Everything the display renders: screen, masjid, prayer settings, the screen's
 * playlist and the published content rows it points at, in one round trip.
 * Resolves to null when the screen no longer exists — the caller signs out.
 */
export async function getDisplayPayload(code: string): Promise<DisplayPayload | null> {
  const { data, error } = await supabase.rpc('get_display_payload', { p_code: code });
  if (error) throw error;
  return (data as DisplayPayload | null) ?? null;
}

/**
 * Prayer calculation settings and adjustments only, for the prayer-times hook
 * that refetches on its own schedule (midnight rollover, month change).
 */
export async function getDisplayPrayerSettings(code: string): Promise<DisplayPrayerSettings> {
  const { data, error } = await supabase.rpc('get_display_prayer_settings', { p_code: code });
  if (error) throw error;
  const result = data as DisplayPrayerSettings | null;
  return { settings: result?.settings ?? null, prayer_times: result?.prayer_times ?? null };
}
