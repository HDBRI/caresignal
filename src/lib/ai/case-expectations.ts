/**
 * Deterministic checks of AI insight output against each demo case's expected outcome
 * (synthetic-data/evaluation/evaluation-cases.json). Used by the live smoke test and by `npm run seed:ai`
 * before any generated output is accepted for the demo cases.
 *
 * "hard" problems mean the output must not be used. "soft" notes are reported but do not block.
 */
import { EVALUATION_CASES } from "../fixtures";
import type { ValidatedOutput } from "./insights";

export function checkCaseExpectations(seedKey: string, out: ValidatedOutput): { hard: string[]; soft: string[] } {
  const ev = EVALUATION_CASES.find((e) => e.kind === "case" && e.seedKey === seedKey);
  const hard: string[] = [];
  const soft: string[] = [];
  if (!ev) return { hard, soft };
  const expected = ev.expected as { mustMentionSourceIds?: string[]; mustKeepConflict?: string[][]; mustListUnknowns?: string[] };

  const cited = new Set([
    ...out.insights.flatMap((i) => i.sourceIds),
    ...out.questions.flatMap((q) => q.sourceIds),
    ...out.unknowns.flatMap((u) => u.sourceIds),
  ]);
  const summaryIds = out.summary.match(/OBS-[A-Z0-9-]+/g) ?? [];
  for (const id of summaryIds) cited.add(id);
  const missing = (expected.mustMentionSourceIds ?? []).filter((id) => !cited.has(id));
  if (missing.length) hard.push(`does not cite expected source(s): ${missing.join(", ")}`);

  for (const group of expected.mustKeepConflict ?? []) {
    const ok = out.insights.some((i) => i.kind === "conflict" && group.every((id) => i.sourceIds.includes(id)));
    if (!ok) hard.push(`conflict between ${group.join(" and ")} is not preserved as a conflict insight`);
  }

  if (out.questions.length === 0) hard.push("no questions for the care team");

  const unknownText = [...out.unknowns.map((u) => u.statement), ...out.insights.map((i) => i.uncertainty ?? "")].join(" ").toLowerCase();
  for (const word of expected.mustListUnknowns ?? []) {
    if (!unknownText.includes(word.toLowerCase())) soft.push(`unknowns do not mention "${word}"`);
  }
  return { hard, soft };
}
