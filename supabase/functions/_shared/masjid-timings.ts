/**
 * Resolving a masjid's prayer times and keeping `masjid_prayer_days` filled.
 *
 * The maths itself lives in `prayer-engine.ts`, which is a copy of
 * `src/utils/prayer-engine.ts` — the console, the display screens and the phones
 * all run the same adjustment code. What is here is the surrounding work: load a
 * masjid's configuration, fetch the Al-Adhan months a window needs, and write
 * the resolved days back.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  resolveDayTimes,
  type EnginePrayerAdjustments,
  type EngineDayTimings,
  type EngineSingleAdjustment,
  type EngineSolarAdjustments,
  type ResolvedDayTimes,
} from './prayer-engine.ts';
import {
  fetchMonth,
  isoDateRange,
  isoFromAlAdhanDate,
  monthsSpanning,
  shiftIsoDate,
  todayInTimeZone,
  type AlAdhanDay,
} from './aladhan.ts';

/** The new-masjid defaults from the console, repeated for masjids saved before the fields existed. */
const DEFAULT_CALCULATION_METHOD = 3; // Muslim World League
const DEFAULT_JURISTIC_SCHOOL = 0; // Shafi
const DEFAULT_HIJRI_METHOD = 'UAQ'; // Umm al-Qura

/** Hijri comes from the row `hijri_offset` days away, so the months fetched have to cover it. */
const MAX_HIJRI_OFFSET_DAYS = 30;

const REQUIRED_TIMINGS = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha', 'Sunset'] as const;

export interface MasjidTimingsConfig {
  masjidId: string;
  latitude: number;
  longitude: number;
  timezone: string;
  method: number;
  school: number;
  calendarMethod: string;
  hijriOffset: number;
  prayerAdjustments: EnginePrayerAdjustments | null;
  solarAdjustments: EngineSolarAdjustments;
}

export interface HijriDate {
  date: string;
  day: string;
  month_number: number;
  month_en: string;
  month_ar: string;
  year: string;
  designation: string;
  weekday_en: string;
  weekday_ar: string;
}

export interface ResolvedDay {
  day: string;
  times: ResolvedDayTimes;
  hijri: HijriDate | null;
  computed_at: string;
}

/**
 * An in-app masjid's timing configuration, or null when it is not in the app, has
 * no coordinates, or does not exist. Leaving the app reads the same as absence
 * from here on.
 */
export const loadTimingsConfig = async (
  admin: SupabaseClient,
  masjidId: string
): Promise<MasjidTimingsConfig | null> => {
  const { data: profile, error } = await admin
    .from('masjid_profiles')
    .select('id, latitude, longitude, timezone')
    .eq('id', masjidId)
    .eq('in_app', true)
    .maybeSingle();

  if (error) throw error;
  if (!profile || profile.latitude === null || profile.longitude === null) return null;

  const [{ data: settings }, { data: adjustments }] = await Promise.all([
    admin
      .from('settings')
      .select('*')
      .eq('masjid_id', masjidId)
      .order('created_at')
      .limit(1)
      .maybeSingle(),
    admin
      .from('prayer_times')
      .select('prayer_adjustments')
      .eq('masjid_id', masjidId)
      .order('created_at')
      .limit(1)
      .maybeSingle(),
  ]);

  return configFromRows(masjidId, profile, settings, adjustments);
};

export interface ProfileRow {
  latitude: number;
  longitude: number;
  timezone: string;
}

export interface SettingsRow {
  calculation_method?: number | null;
  juristic_school?: number | null;
  hijri_calculation_method?: string | null;
  hijri_offset?: number | null;
  sunrise_adjustment?: EngineSingleAdjustment | null;
  ishraq_adjustment?: EngineSingleAdjustment | null;
  chasht_adjustment?: EngineSingleAdjustment | null;
  sunset_adjustment?: EngineSingleAdjustment | null;
}

export interface PrayerTimesRow {
  prayer_adjustments?: EnginePrayerAdjustments | null;
}

/** The rows as stored, whether read live or from a snapshot taken before a save. */
export const configFromRows = (
  masjidId: string,
  profile: ProfileRow,
  settings: SettingsRow | null,
  adjustments: PrayerTimesRow | null
): MasjidTimingsConfig => {
  return {
    masjidId,
    latitude: profile.latitude,
    longitude: profile.longitude,
    timezone: profile.timezone,
    method: settings?.calculation_method ?? DEFAULT_CALCULATION_METHOD,
    school: settings?.juristic_school ?? DEFAULT_JURISTIC_SCHOOL,
    calendarMethod: settings?.hijri_calculation_method ?? DEFAULT_HIJRI_METHOD,
    hijriOffset: settings?.hijri_offset ?? 0,
    prayerAdjustments: adjustments?.prayer_adjustments ?? null,
    solarAdjustments: {
      sunrise: settings?.sunrise_adjustment ?? null,
      ishraq: settings?.ishraq_adjustment ?? null,
      chasht: settings?.chasht_adjustment ?? null,
      sunset: settings?.sunset_adjustment ?? null,
    },
  };
};

const toEngineTimings = (day: AlAdhanDay): EngineDayTimings | null => {
  for (const key of REQUIRED_TIMINGS) {
    if (typeof day.timings?.[key] !== 'string') return null;
  }
  const timings = day.timings;
  return {
    Fajr: timings.Fajr,
    Sunrise: timings.Sunrise,
    Dhuhr: timings.Dhuhr,
    Asr: timings.Asr,
    Maghrib: timings.Maghrib,
    Isha: timings.Isha,
    Sunset: timings.Sunset,
  };
};

const toHijri = (day: AlAdhanDay | undefined): HijriDate | null => {
  const hijri = day?.date?.hijri;
  if (!hijri) return null;
  return {
    date: hijri.date,
    day: hijri.day,
    month_number: hijri.month?.number,
    month_en: hijri.month?.en,
    month_ar: hijri.month?.ar,
    year: hijri.year,
    designation: hijri.designation?.abbreviated,
    weekday_en: hijri.weekday?.en,
    weekday_ar: hijri.weekday?.ar,
  };
};

export const fetchDaysByIsoDate = async (
  config: MasjidTimingsConfig,
  fromIso: string,
  toIso: string
): Promise<Map<string, AlAdhanDay>> => {
  const byDate = new Map<string, AlAdhanDay>();

  // Sequential on purpose: a window spans two or three months at most, and a
  // burst of parallel requests is how a free public API starts refusing them.
  for (const [year, month] of monthsSpanning(fromIso, toIso)) {
    const days = await fetchMonth({
      year,
      month,
      latitude: config.latitude,
      longitude: config.longitude,
      method: config.method,
      school: config.school,
      calendarMethod: config.calendarMethod,
    });

    for (const day of days) {
      const iso = isoFromAlAdhanDate(day.date?.gregorian?.date ?? '');
      if (iso) byDate.set(iso, day);
    }
  }

  return byDate;
};

/**
 * Every day in `[fromIso, toIso]` the masjid has times for, reading the cache
 * first and computing only what is missing.
 *
 * A day Al-Adhan has no row for is left out rather than guessed at, so the
 * caller can tell "the masjid has not configured this" from "we made something
 * up".
 */
export const resolveWindow = async (
  admin: SupabaseClient,
  config: MasjidTimingsConfig,
  fromIso: string,
  toIso: string
): Promise<ResolvedDay[]> => {
  const requested = isoDateRange(fromIso, toIso);
  if (requested.length === 0) return [];

  const { data: cached, error } = await admin
    .from('masjid_prayer_days')
    .select('day, times, hijri, computed_at')
    .eq('masjid_id', config.masjidId)
    .gte('day', fromIso)
    .lte('day', toIso);

  if (error) throw error;

  const byDay = new Map<string, ResolvedDay>(
    ((cached ?? []) as ResolvedDay[]).map(row => [row.day, row])
  );

  const missing = requested.filter(day => !byDay.has(day));
  if (missing.length === 0) return requested.map(day => byDay.get(day)!).filter(Boolean);

  const pad = Math.min(Math.abs(config.hijriOffset), MAX_HIJRI_OFFSET_DAYS);

  let alAdhanDays: Map<string, AlAdhanDay>;
  try {
    alAdhanDays = await fetchDaysByIsoDate(
      config,
      shiftIsoDate(missing[0], -pad),
      shiftIsoDate(missing[missing.length - 1], pad)
    );
  } catch (error) {
    // Al-Adhan is down or slow. Days already cached are still correct, so serve
    // the short window rather than failing the whole request.
    console.error(`Al-Adhan fetch failed for ${config.masjidId}`, error);
    if (byDay.size > 0) {
      return requested.map(day => byDay.get(day)).filter((row): row is ResolvedDay => !!row);
    }
    throw error;
  }

  const computed = computeDays(config, missing, alAdhanDays);

  if (computed.length > 0) {
    const { error: writeError } = await admin.from('masjid_prayer_days').upsert(
      computed.map(row => ({
        masjid_id: config.masjidId,
        day: row.day,
        times: row.times,
        hijri: row.hijri,
        computed_at: row.computed_at,
      })),
      { onConflict: 'masjid_id,day' }
    );

    // A failed write is a cache miss next time, not a failed request.
    if (writeError) console.error('masjid_prayer_days upsert failed', writeError);

    for (const row of computed) byDay.set(row.day, row);
  }

  return requested.map(day => byDay.get(day)).filter((row): row is ResolvedDay => !!row);
};

/** Resolves `days` from Al-Adhan rows already fetched; days Al-Adhan has no row for are left out. */
export const computeDays = (
  config: MasjidTimingsConfig,
  days: string[],
  alAdhanDays: Map<string, AlAdhanDay>
): ResolvedDay[] => {
  const computed: ResolvedDay[] = [];
  const computedAt = new Date().toISOString();

  for (const day of days) {
    const source = alAdhanDays.get(day);
    if (!source) continue;

    const timings = toEngineTimings(source);
    if (!timings) continue;

    computed.push({
      day,
      times: resolveDayTimes({
        timings,
        weekday: source.date?.gregorian?.weekday?.en ?? '',
        prayerAdjustments: config.prayerAdjustments,
        solarAdjustments: config.solarAdjustments,
      }),
      // The Hijri date a masjid prints is its own offset applied to the
      // calendar, so it comes from a different row than the prayer times.
      hijri: toHijri(alAdhanDays.get(shiftIsoDate(day, config.hijriOffset))),
      computed_at: computedAt,
    });
  }

  return computed;
};

/** The window a phone gets by default: today in the masjid's zone, plus a week. */
export const defaultWindow = (timezone: string): { fromIso: string; toIso: string } => {
  const today = todayInTimeZone(timezone);
  return { fromIso: today, toIso: shiftIsoDate(today, 7) };
};

export const listInAppMasjidIds = async (admin: SupabaseClient): Promise<string[]> => {
  const { data, error } = await admin
    .from('masjid_profiles')
    .select('id')
    .eq('in_app', true)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null);

  if (error) throw error;
  return ((data ?? []) as { id: string }[]).map(row => row.id);
};
