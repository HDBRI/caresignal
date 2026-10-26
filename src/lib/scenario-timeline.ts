/**
 * Dated care/treatment events from a demo case's synthetic scenario timeline (imported monthly dataset).
 * Kept separate from caregiver notes; dates are resolved from the case's seed anchor exactly like the notes.
 * User-created cases have no scenario timeline (returns []), so nothing is ever invented for them.
 */
import { SEED_CASES } from "./fixtures";
import type { PatientCase } from "./models";
import type { CareEvent } from "./patterns";
import { resolveSeedDay } from "./time";

export function scenarioTimeline(c: Pick<PatientCase, "seedKey" | "seedAnchor">): CareEvent[] {
  const fixture = SEED_CASES.find((f) => f.seedKey === c.seedKey);
  if (!fixture?.careEvents || !c.seedAnchor) return [];
  const anchor = new Date(c.seedAnchor);
  return fixture.careEvents.map((e) => ({
    kind: e.kind,
    label: e.label,
    day: resolveSeedDay(anchor, e.dayOffset),
    dateCertainty: "scenario_date" as const,
    relativeText: null,
    sourceId: "",
    quote: e.description,
  }));
}
