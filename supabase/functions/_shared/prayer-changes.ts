import type {
  EngineAdjustmentCategory,
  EngineDailyPrayerName,
  EngineJummaName,
  ResolvedDayTimes,
} from './prayer-engine.ts';

type PrayerName = EngineDailyPrayerName | EngineJummaName;

export interface DayTimes {
  day: string;
  times: ResolvedDayTimes;
}

export interface PrayerChange {
  day: string;
  prayer: PrayerName;
  category: EngineAdjustmentCategory;
  from: string;
  to: string;
}

const PRAYER_ORDER: PrayerName[] = [
  'fajr',
  'dhuhr',
  'jumma1',
  'jumma2',
  'jumma3',
  'asr',
  'maghrib',
  'isha',
];

const PRAYER_LABELS: Record<PrayerName, string> = {
  fajr: 'Fajr',
  dhuhr: 'Dhuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha',
  jumma1: "Jumu'ah",
  jumma2: "Jumu'ah 2",
  jumma3: "Jumu'ah 3",
};

const CATEGORY_LABELS: Record<EngineAdjustmentCategory, string> = {
  starts: 'start',
  athan: 'athan',
  iqamah: 'jamaat',
};

const CATEGORIES: EngineAdjustmentCategory[] = ['starts', 'athan', 'iqamah'];
const BODY_ORDER: EngineAdjustmentCategory[] = ['iqamah', 'athan', 'starts'];
const DAILY_PRAYERS: EngineDailyPrayerName[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const NAMED_IN_TITLE = 3;

const prayersOf = (
  times: ResolvedDayTimes
): Map<PrayerName, Record<EngineAdjustmentCategory, string>> => {
  const map = new Map<PrayerName, Record<EngineAdjustmentCategory, string>>();
  for (const name of DAILY_PRAYERS) {
    const prayer = times.prayers?.[name];
    if (prayer) map.set(name, prayer);
  }
  for (const jumma of times.jumma ?? []) map.set(jumma.name, jumma);
  return map;
};

/** Days present on both sides only: a day with no baseline was never shown to anyone. */
export const diffPrayerDays = (before: DayTimes[], after: DayTimes[]): PrayerChange[] => {
  const beforeByDay = new Map(before.map(row => [row.day, row.times]));
  const changes: PrayerChange[] = [];

  for (const { day, times } of after) {
    const previous = beforeByDay.get(day);
    if (!previous) continue;

    const old = prayersOf(previous);
    for (const [prayer, next] of prayersOf(times)) {
      const was = old.get(prayer);
      if (!was) continue;

      for (const category of CATEGORIES) {
        if (was[category] && next[category] && was[category] !== next[category]) {
          changes.push({ day, prayer, category, from: was[category], to: next[category] });
        }
      }
    }
  }

  return changes;
};

const formatClock = (value: string, dropSuffix = false): string => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return value;
  const hours = Number(match[1]);
  const clock = `${hours % 12 === 0 ? 12 : hours % 12}:${match[2]}`;
  return dropSuffix ? clock : `${clock} ${hours < 12 ? 'AM' : 'PM'}`;
};

const sameHalfOfDay = (a: string, b: string) =>
  Number(a.split(':')[0]) < 12 === Number(b.split(':')[0]) < 12;

const formatDay = (day: string, today: string): string => {
  if (day <= today) return 'today';

  const [year, month, date] = day.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, date));
  const [ty, tm, td] = today.split('-').map(Number);
  if (utc.getTime() - Date.UTC(ty, tm - 1, td) === 86_400_000) return 'tomorrow';

  return `${WEEKDAYS[utc.getUTCDay()]} ${date} ${MONTHS[month - 1]}`;
};

export interface ChangeMessage {
  title: string;
  body: string;
}

const joinNames = (names: string[]): string =>
  names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

/**
 * One notification per masjid, one line per prayer. Each prayer and time is
 * named once, at the first day it changes, so a new jamaat time reads as one
 * change rather than fourteen.
 */
export const describeChanges = (
  masjidName: string,
  changes: PrayerChange[],
  today: string
): ChangeMessage | null => {
  const first = new Map<string, PrayerChange>();
  for (const change of [...changes].sort((a, b) => a.day.localeCompare(b.day))) {
    const key = `${change.prayer}:${change.category}`;
    if (!first.has(key)) first.set(key, change);
  }
  if (first.size === 0) return null;

  const byPrayer = new Map<PrayerName, PrayerChange[]>();
  for (const change of first.values()) {
    byPrayer.set(change.prayer, [...(byPrayer.get(change.prayer) ?? []), change]);
  }

  const rank = (group: PrayerChange[]) =>
    Math.min(...group.map(change => BODY_ORDER.indexOf(change.category)));
  const groups = [...byPrayer.values()]
    .map(group =>
      group.sort((a, b) => BODY_ORDER.indexOf(a.category) - BODY_ORDER.indexOf(b.category))
    )
    .sort(
      (a, b) =>
        rank(a) - rank(b) || PRAYER_ORDER.indexOf(a[0].prayer) - PRAYER_ORDER.indexOf(b[0].prayer)
    );

  const days = new Set([...first.values()].map(change => change.day));
  const sharedDay = days.size === 1 ? [...days][0] : null;

  const part = (change: PrayerChange, withDay: boolean) => {
    const was =
      change.category === 'starts'
        ? ''
        : ` (was ${formatClock(change.from, sameHalfOfDay(change.from, change.to))})`;
    const day = withDay ? ` from ${formatDay(change.day, today)}` : '';
    return `${CATEGORY_LABELS[change.category]} ${formatClock(change.to)}${was}${day}`;
  };

  const lines = groups.map(group => {
    const lineDay = new Set(group.map(change => change.day)).size === 1 ? group[0].day : null;
    const parts = group.map(change => part(change, !sharedDay && !lineDay)).join(', ');
    const suffix = !sharedDay && lineDay ? ` from ${formatDay(lineDay, today)}` : '';
    return `${PRAYER_LABELS[group[0].prayer]} ${parts}${suffix}`;
  });
  if (sharedDay) {
    const from = formatDay(sharedDay, today);
    lines.push(`From ${from}`);
  }

  const names = groups.map(group => PRAYER_LABELS[group[0].prayer]);
  const subject =
    names.length > NAMED_IN_TITLE
      ? 'new prayer times'
      : `new ${joinNames(names)} ${names.length === 1 ? 'time' : 'times'}`;

  return { title: `${masjidName}: ${subject}`, body: lines.join('\n') };
};
