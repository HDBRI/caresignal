/**
 * Time helpers. Storage is always UTC ISO-8601. Seed fixtures are written as
 * "day offset + local wall time" in DEMO_TIME_ZONE and resolved against one anchor
 * per seeded copy, so every timestamp in a copy is consistent and reproducible.
 */
export const DEMO_TIME_ZONE = "America/New_York";

function tzOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - instant.getTime()) / 60000);
}

/** Calendar date (YYYY-MM-DD) of an instant in the given time zone. */
export function localDate(instant: Date, timeZone = DEMO_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    instant,
  );
}

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Convert a wall-clock time on a calendar date in `timeZone` to a UTC instant. */
export function wallTimeToUtc(isoDate: string, hhmm: string, timeZone = DEMO_TIME_ZONE): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const off1 = tzOffsetMinutes(new Date(guess), timeZone);
  let result = guess - off1 * 60000;
  const off2 = tzOffsetMinutes(new Date(result), timeZone);
  if (off2 !== off1) result = guess - off2 * 60000;
  return new Date(result);
}

export interface SeedTime {
  dayOffset: number; // <= -1 for seeded notes, so they are always in the past
  time: string; // "HH:MM" local wall time in DEMO_TIME_ZONE
}

/** Resolve a fixture time against the copy's anchor. */
export function resolveSeedTime(anchor: Date, t: SeedTime, timeZone = DEMO_TIME_ZONE): string {
  return wallTimeToUtc(addDays(localDate(anchor, timeZone), t.dayOffset), t.time, timeZone).toISOString();
}

export function resolveSeedDay(anchor: Date, dayOffset: number, timeZone = DEMO_TIME_ZONE): string {
  return addDays(localDate(anchor, timeZone), dayOffset);
}
