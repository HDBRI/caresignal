/** Check-in status labels (no server imports, safe for browser components). */
export const CHECKIN_STATUSES = [
  { id: "no_change", label: "No meaningful change" },
  { id: "noticed_change", label: "I noticed a change" },
  { id: "concern", label: "I have a concern or question" },
  { id: "skipped", label: "Skipped" },
] as const;

/** Shown for any day with no check-in. Never stored; never treated as "fine". */
export const NO_RESPONSE_LABEL = "No response recorded";

export function checkinStatusLabel(status: string | null | undefined): string {
  return CHECKIN_STATUSES.find((s) => s.id === status)?.label ?? NO_RESPONSE_LABEL;
}
