/**
 * Caregiver-facing text: replace raw observation IDs (OBS-C1-02) with readable references.
 * The IDs stay in the data and drive the evidence links; they are only hidden from ordinary text.
 */
import { categoryLabel } from "./categories";
import { fmtShortDay, type DashboardObservation } from "./dashboard";

const ID = /OBS-[A-Z0-9]+(?:-[A-Z0-9]+)*/g;
const ID_LIST_IN_PARENS = /\s*\((?:\s*(?:notes?|observations?|see)?\s*OBS-[A-Z0-9-]+(?:\s*(?:,|and|&)\s*OBS-[A-Z0-9-]+)*\s*)\)/gi;

export function readableRef(o: DashboardObservation | undefined): string {
  if (!o) return "a note";
  return `the ${fmtShortDay(o.day)} note`;
}

/** e.g. "Oct 24 · Physical symptoms and comfort" */
export function readableLabel(o: DashboardObservation | undefined): string {
  if (!o) return "Note";
  return `${fmtShortDay(o.day)} · ${o.categories.length ? categoryLabel(o.categories[0]) : "Not yet categorized"}`;
}

export function humanizeText(text: string, obs: Record<string, DashboardObservation>): string {
  return text
    .replace(ID_LIST_IN_PARENS, "")
    .replace(ID, (id) => readableRef(obs[id]))
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;:])/g, "$1")
    .trim();
}

export function containsRawId(text: string): boolean {
  return new RegExp(ID.source).test(text);
}
