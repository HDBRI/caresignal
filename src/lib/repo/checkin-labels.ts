/** Check-in states and labels (no server imports, safe for browser components). */
export const CHECKIN_STATUSES = [
  { id: "no_change", option: "No meaningful change", label: "No meaningful change" },
  { id: "noticed_change", option: "I noticed a change", label: "I noticed a change" },
  { id: "concern", option: "I have a concern or question", label: "I have a concern or question" },
  { id: "skipped", option: "Skip today", label: "Skipped today" },
] as const;

export type CheckinStatusId = (typeof CHECKIN_STATUSES)[number]["id"];

/** Only these two states take a free-text note (and can be saved as an observation). */
export const STATUSES_WITH_NOTE: CheckinStatusId[] = ["noticed_change", "concern"];

/** Shown for any day with no check-in. Never stored; never treated as "fine". */
export const NO_RESPONSE_LABEL = "No response recorded";

export function checkinStatusLabel(status: string | null | undefined): string {
  return CHECKIN_STATUSES.find((s) => s.id === status)?.label ?? NO_RESPONSE_LABEL;
}

export const CHECKIN_URGENT_NOTICE =
  "A check-in is not a substitute for urgent care. If something may be an emergency, call 911 now.";
