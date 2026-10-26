/**
 * In-app reminder preference (Task 11). CareSignal has NO email, SMS, browser push or phone
 * notifications. The only "reminder" is a gentle note shown inside the app, on the Overview,
 * after the chosen time — and only if the person opens the app. It never blocks note logging.
 */
export const REMINDER_LIMITATION =
  "In-app only: CareSignal shows a gentle note on the Overview after your chosen time if today's optional check-in isn't recorded yet. It does not send email, text messages, push or phone notifications, so you'll only see it when you open the app.";

export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+)*$/.test(tz) && tz.length <= 64;
  } catch {
    return false;
  }
}

/** Local wall-clock time "HH:MM" of an instant in a time zone. */
export function localHHMM(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
}

/**
 * Should the in-app reminder show right now?
 * Only when: the preference is on, a time is set, it is at/after that local time today, and
 * today's check-in has not been recorded. A missing check-in is never read as "fine" — the
 * reminder just invites an optional answer.
 */
export function isReminderDue(
  c: { reminderPref: "off" | "in_app_daily"; reminderTime: string | null; reminderTz: string | null },
  now: Date,
  hasCheckinToday: boolean,
): boolean {
  if (c.reminderPref !== "in_app_daily" || !c.reminderTime || !TIME_RE.test(c.reminderTime)) return false;
  if (hasCheckinToday) return false;
  const tz = c.reminderTz && isValidTimeZone(c.reminderTz) ? c.reminderTz : "America/New_York";
  return localHHMM(now, tz) >= c.reminderTime;
}

/** "20:00" -> "8:00 PM" for display. */
export function formatTime12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
