/**
 * Scores the deterministic rules against the developer-written SYNTHETIC test set.
 * Reports true positives / false positives / missed triggers with denominators.
 * This is NOT a measure of real-world sensitivity, specificity or clinical safety.
 */
import { evaluateSafety, type SafetyTier } from "./rules";

export interface SafetyTestSet {
  emergency: string[];
  contact_care_team: string[];
  review: string[];
  routine: string[];
  negated: string[];
  false_trigger_probes: string[];
  known_false_positives: string[];
  known_misses: string[];
  injection: { text: string; expected: SafetyTier | "none" }[];
}

export interface GroupResult {
  group: string;
  expected: SafetyTier | "none" | "mixed";
  total: number;
  correct: number; // exact expected level
  wrongLevel: number; // an alert, but a different level than expected
  missed: number; // expected an alert, none fired
  falsePositives: number; // expected no alert, one fired
  failures: { text: string; got: SafetyTier | "none" }[];
}

function score(group: string, items: { text: string; expected: SafetyTier | "none" }[], expectedLabel: GroupResult["expected"]): GroupResult {
  const r: GroupResult = { group, expected: expectedLabel, total: items.length, correct: 0, wrongLevel: 0, missed: 0, falsePositives: 0, failures: [] };
  for (const { text, expected } of items) {
    const got = evaluateSafety(text).tier ?? "none";
    if (got === expected) r.correct += 1;
    else {
      if (expected === "none") r.falsePositives += 1;
      else if (got === "none") r.missed += 1;
      else r.wrongLevel += 1;
      r.failures.push({ text, got });
    }
  }
  return r;
}

export function evaluateSafetyTestSet(set: SafetyTestSet): { groups: GroupResult[]; totals: { alertCases: number; caught: number; missed: number; noAlertCases: number; falsePositives: number } } {
  const as = (texts: string[], expected: SafetyTier | "none") => texts.map((text) => ({ text, expected }));
  const groups = [
    score("Emergency phrases", as(set.emergency, "emergency"), "emergency"),
    score("Prompt-attention phrases", as(set.contact_care_team, "contact_care_team"), "contact_care_team"),
    score("Review phrases", as(set.review, "review"), "review"),
    score("Routine notes", as(set.routine, "none"), "none"),
    score("Negated phrases", as(set.negated, "none"), "none"),
    score("False-trigger probes", as(set.false_trigger_probes, "none"), "none"),
    score("Prompt-injection notes", set.injection, "mixed"),
    // Documented limitations, scored against what SHOULD happen (so they show up as failures):
    score("Known false positives (documented)", as(set.known_false_positives, "none"), "none"),
    score("Known misses (documented)", as(set.known_misses, "emergency"), "emergency"),
  ];
  const alertGroups = groups.filter((g) => g.expected !== "none");
  const alertItems = [
    ...set.emergency,
    ...set.contact_care_team,
    ...set.review,
    ...set.known_misses,
    ...set.injection.filter((i) => i.expected !== "none").map((i) => i.text),
  ];
  const noAlertItems = [
    ...set.routine,
    ...set.negated,
    ...set.false_trigger_probes,
    ...set.known_false_positives,
    ...set.injection.filter((i) => i.expected === "none").map((i) => i.text),
  ];
  const caught = alertItems.filter((t) => evaluateSafety(t).tier !== null).length;
  return {
    groups,
    totals: {
      alertCases: alertItems.length,
      caught,
      missed: alertGroups.reduce((s, g) => s + g.missed, 0),
      noAlertCases: noAlertItems.length,
      falsePositives: noAlertItems.filter((t) => evaluateSafety(t).tier !== null).length,
    },
  };
}
