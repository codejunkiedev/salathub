/**
 * Formats instants against a masjid's wall clock rather than the device's.
 * A null or unrecognised zone falls back to the device's.
 */

const zoneSupport = new Map<string, boolean>();

/**
 * Whether the runtime recognises a zone id
 *
 * Probes the formatter instead of checking `supportedValuesOf`, which lists
 * only canonical ids — it has `Asia/Calcutta` but not `Asia/Kolkata`, and both
 * spellings come back from Geoapify and pg_timezone_names.
 */
export function isSupportedTimeZone(timeZone: string): boolean {
  const memoized = zoneSupport.get(timeZone);
  if (memoized !== undefined) return memoized;

  let supported: boolean;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    supported = true;
  } catch {
    supported = false;
  }

  zoneSupport.set(timeZone, supported);
  return supported;
}

/**
 * The runtime's canonical spelling of a zone id, or null if it does not know it.
 * `Asia/Kolkata` resolves to `Asia/Calcutta` — same clock, one spelling.
 */
export function canonicalTimeZone(timeZone: string): string | null {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

/**
 * Zone ids to offer in a picker, sorted. Canonical spellings only, so check a
 * given zone with isSupportedTimeZone rather than against this list.
 */
export function listTimeZones(): string[] {
  try {
    return [...Intl.supportedValuesOf('timeZone')].sort();
  } catch {
    return [];
  }
}

/** The zone the current device is set to */
export function getDeviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** The given zone when set and recognised, otherwise the device's */
export function resolveTimeZone(timeZone: string | null | undefined): string {
  if (timeZone && isSupportedTimeZone(timeZone)) return timeZone;
  return getDeviceTimeZone();
}

type WallClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

/** The calendar fields an instant lands on in a given zone */
function wallClockIn(instant: Date, timeZone: string): WallClock {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    // h23, not hour12: false — the latter renders midnight as hour 24 in en-US
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);

  const field = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find(part => part.type === type)?.value ?? '0');

  return {
    year: field('year'),
    month: field('month'),
    day: field('day'),
    hour: field('hour'),
    minute: field('minute'),
    second: field('second'),
  };
}

/** A zone's offset from UTC at a given instant, in minutes east of UTC */
function offsetMinutesAt(instant: Date, timeZone: string): number {
  const wall = wallClockIn(instant, timeZone);
  const asIfUtc = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
    wall.second
  );
  // The formatter has no milliseconds, so compare against whole seconds
  return (asIfUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60_000;
}

/**
 * An instant as a Date whose local fields read as the wall clock in `timeZone`.
 * For feeding a picker that works in local fields; pass it back through
 * fromZonedWallClock to recover the instant.
 */
export function toZonedWallClock(instant: Date, timeZone: string | null | undefined): Date {
  const zone = resolveTimeZone(timeZone);
  const wall = wallClockIn(instant, zone);
  return new Date(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
    wall.second,
    instant.getMilliseconds()
  );
}

/**
 * The inverse: a Date's local fields read as a wall clock in `timeZone`.
 * Two passes so a guess landing across a DST transition is corrected.
 */
export function fromZonedWallClock(local: Date, timeZone: string | null | undefined): Date {
  const zone = resolveTimeZone(timeZone);
  const asIfUtc = Date.UTC(
    local.getFullYear(),
    local.getMonth(),
    local.getDate(),
    local.getHours(),
    local.getMinutes(),
    local.getSeconds(),
    local.getMilliseconds()
  );

  const guess = asIfUtc - offsetMinutesAt(new Date(asIfUtc), zone) * 60_000;
  const corrected = asIfUtc - offsetMinutesAt(new Date(guess), zone) * 60_000;
  return new Date(corrected);
}

/** Now, as a Date whose local fields read as the wall clock in `timeZone` */
export function nowInTimeZone(timeZone: string | null | undefined): Date {
  return toZonedWallClock(new Date(), timeZone);
}

/**
 * The instant at which the calendar day of `zonedDay` reaches `hours:minutes`
 * in `timeZone`. `zonedDay` is a wall clock in that zone, as nowInTimeZone
 * returns.
 */
export function instantOnZonedDay(
  zonedDay: Date,
  hours: number,
  minutes: number,
  timeZone: string | null | undefined
): Date {
  const local = new Date(zonedDay);
  local.setHours(hours, minutes, 0, 0);
  return fromZonedWallClock(local, timeZone);
}

/** Parses a stored instant, tolerating a null or unparseable value */
export function parseInstant(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatWith(
  value: Date | string | null | undefined,
  timeZone: string | null | undefined,
  options: Intl.DateTimeFormatOptions
): string {
  const instant = parseInstant(value);
  if (!instant) return '';

  return new Intl.DateTimeFormat('en-US', {
    ...options,
    timeZone: resolveTimeZone(timeZone),
  }).format(instant);
}

/** Any Intl parts, in the given zone. */
export const formatZoned = formatWith;

/** Date only, e.g. `May 1, 2026` */
export function formatZonedDate(
  value: Date | string | null | undefined,
  timeZone: string | null | undefined
): string {
  return formatWith(value, timeZone, { year: 'numeric', month: 'long', day: 'numeric' });
}

/** Time only, e.g. `8:00 PM` */
export function formatZonedTime(
  value: Date | string | null | undefined,
  timeZone: string | null | undefined
): string {
  return formatWith(value, timeZone, { hour: 'numeric', minute: '2-digit', hour12: true });
}

/** Both, e.g. `May 1, 2026, 8:00 PM` */
export function formatZonedDateTime(
  value: Date | string | null | undefined,
  timeZone: string | null | undefined
): string {
  return formatWith(value, timeZone, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/** A zone rendered for a human, e.g. `Africa/Addis_Ababa` as `Africa/Addis Ababa (GMT+3)` */
export function describeTimeZone(
  timeZone: string | null | undefined,
  at: Date = new Date()
): string {
  const zone = resolveTimeZone(timeZone);
  const abbreviation = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'short' })
    .formatToParts(at)
    .find(part => part.type === 'timeZoneName')?.value;

  // Zone ids spell spaces as underscores; that is an id detail, not something
  // to read. The id itself is what gets stored.
  const label = zone.replace(/_/g, ' ');
  return abbreviation ? `${label} (${abbreviation})` : label;
}
