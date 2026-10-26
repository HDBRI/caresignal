/**
 * Weekly handoff draft (Task 13). Built from STORED observations plus a VALIDATED insight run:
 *
 *   1. The period is the last 7 days (the same window the Insights page calls "Last 7 days").
 *   2. No notes  -> "No observations were logged for this period." No AI call, nothing invented.
 *   3. Deterministic parts come straight from the records: category groupings (caregiver correction first,
 *      otherwise completed AI labels), urgent notes and when their guidance was shown, and days with no note.
 *   4. AI parts (summary, changes/patterns/conflicts, unknowns, questions) are taken ONLY from an insight run
 *      that passed every check in insights.ts. An existing run for exactly the same notes is reused; otherwise a
 *      new run is generated. If the AI is unavailable or its output is rejected, the draft lists each note as
 *      written instead, and says so.
 *
 * The draft is never sent: the caregiver reviews, may edit, approves, then submits to the SIMULATED receiver.
 */
import { categoryLabel, CATEGORY_IDS } from "../categories";
import type { Database, Principal } from "../db/client";
import { effectiveCategories } from "../dashboard";
import type { HandoffContent, HandoffGeneration, HandoffItem, Insight, InsightRun } from "../models";
import { listInsightRuns } from "../repo/handoffs";
import { listAlerts, listAnalyses, listObservations } from "../repo/observations";
import { buildInsightInput, generateInsights, type InsightInput } from "./insights";
import type { CategorizeDeps } from "./categorize";

export const HANDOFF_PERIOD_DAYS = 7;
export const NO_OBSERVATIONS = "No observations were logged for this period.";
export const UNCATEGORIZED = "not_categorized";

export interface HandoffDraft {
  content: HandoffContent;
  draftedBy: "ai" | "records";
  generation: HandoffGeneration;
  periodStart: string; // YYYY-MM-DD (local)
  periodEnd: string;
  sourceIds: string[]; // every note in the period
}

const AI_REASON: Record<string, string> = {
  unavailable_error: "AI is not configured on this server",
  unavailable_limit: "today's AI limit has been reached",
  failed: "the AI request did not complete",
  failed_validation: "the AI output did not pass CareSignal's checks",
};

const sameSet = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");

/** Notes in the period, grouped by their effective categories. Uncategorized notes are listed, not dropped. */
async function categoryGroups(db: Database, p: Principal, caseId: string, ids: string[]) {
  const [observations, analyses] = await Promise.all([listObservations(db, p, caseId), listAnalyses(db, p, caseId)]);
  const groups = new Map<string, string[]>();
  for (const o of observations.filter((x) => ids.includes(x.displayId))) {
    const { categories } = effectiveCategories(o, analyses.get(o.id));
    for (const c of categories.length ? categories : [UNCATEGORIZED]) groups.set(c, [...(groups.get(c) ?? []), o.displayId]);
  }
  const order = [...CATEGORY_IDS, UNCATEGORIZED] as string[];
  return [...groups.entries()]
    .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
    .map(([category, sourceIds]) => ({ category, sourceIds: sourceIds.sort() }));
}

export const handoffCategoryLabel = (id: string) => (id === UNCATEGORIZED ? "Not categorized yet" : categoryLabel(id));

async function urgentNotes(db: Database, p: Principal, caseId: string, ids: string[]) {
  const [alerts, observations] = await Promise.all([listAlerts(db, p, caseId), listObservations(db, p, caseId)]);
  const displayOf = new Map(observations.map((o) => [o.id, o.displayId]));
  return alerts
    .filter((a) => (a.tier === "emergency" || a.tier === "contact_care_team") && ids.includes(displayOf.get(a.observationId) ?? ""))
    .map((a) => ({ sourceId: displayOf.get(a.observationId)!, tier: a.tier, alertedAt: a.createdAt, seenAt: a.seenAt }))
    .sort((a, b) => a.alertedAt.localeCompare(b.alertedAt));
}

function gapLine(input: InsightInput): string[] {
  const missing = input.daysWithoutNotes.length;
  return missing ? [`No observation was logged on ${missing} of the ${input.periodDays} days in this period (not reported — not the same as "nothing happened").`] : [];
}

function fromInsightRun(run: InsightRun, insights: Insight[]): Pick<HandoffContent, "summary" | "items" | "questions" | "missingInfo"> {
  const items: HandoffItem[] = insights
    .filter((i) => i.kind !== "question" && i.kind !== "missing_info")
    .map((i) => ({
      statement: i.statement,
      support: i.support,
      sourceIds: i.sourceIds,
      kind: i.kind as HandoffItem["kind"],
      uncertainty: i.uncertainty,
      comparesToBaseline: i.comparesToBaseline,
    }));
  return {
    summary: run.summary ?? "",
    items,
    questions: insights.filter((i) => i.kind === "question").map((q) => ({ text: q.statement, sourceIds: q.sourceIds })),
    missingInfo: run.unknowns.map((u) => u.statement),
  };
}

export async function buildHandoffDraft(db: Database, p: Principal, caseId: string, deps: CategorizeDeps): Promise<HandoffDraft> {
  const input = await buildInsightInput(db, p, caseId, "last7");
  const ids = input.notes.map((n) => n.id);
  const base = { periodStart: input.periodStart, periodEnd: input.periodEnd, sourceIds: [...ids].sort() };

  if (ids.length === 0) {
    return {
      ...base,
      draftedBy: "records",
      generation: { method: "empty" },
      content: {
        summary: NO_OBSERVATIONS,
        items: [],
        questions: [],
        missingInfo: [`${NO_OBSERVATIONS} CareSignal has nothing to summarize — this does not mean nothing happened.`],
        categories: [],
        urgent: [],
      },
    };
  }

  const [categories, urgent] = await Promise.all([categoryGroups(db, p, caseId, ids), urgentNotes(db, p, caseId, ids)]);

  // Reuse a validated run made from exactly these notes; otherwise ask for a new one (validated in insights.ts).
  let reused = true;
  let found = (await listInsightRuns(db, p, caseId)).find((r) => r.run.status === "complete" && sameSet(r.run.inputSourceIds, ids));
  let aiStatus: string | null = found ? "complete" : null;
  let rejected = found?.run.rejectedItems ?? 0;
  if (!found) {
    reused = false;
    const outcome = await generateInsights(db, p, caseId, "last7", deps, { purpose: "handoff_draft" });
    aiStatus = outcome.status;
    if (outcome.status !== "empty") {
      rejected = outcome.rejected;
      if (outcome.status === "complete") found = (await listInsightRuns(db, p, caseId)).find((r) => r.run.id === outcome.runId);
    }
  }

  if (found) {
    const ai = fromInsightRun(found.run, found.insights);
    return {
      ...base,
      draftedBy: "ai",
      generation: {
        method: "ai_insights",
        insightRunId: found.run.id,
        aiStatus: "complete",
        modelReported: found.run.modelReported,
        reusedRun: reused,
        rejectedItems: rejected,
      },
      content: { ...ai, missingInfo: [...gapLine(input), ...ai.missingInfo], categories, urgent },
    };
  }

  // Notes-only draft: every note listed as the caregiver wrote it. Nothing is interpreted.
  const n = input.notes.length;
  const reason = AI_REASON[aiStatus ?? ""] ?? "the AI summary is not available";
  return {
    ...base,
    draftedBy: "records",
    generation: { method: "records_only", aiStatus, rejectedItems: rejected },
    content: {
      summary: `${n} ${n === 1 ? "observation was" : "observations were"} logged by the caregiver in this period. An AI summary is not available (${reason}), so this draft lists each note exactly as written. Review it and add anything the care team should know.`,
      items: input.notes.map((note) => ({ statement: `Caregiver reported: “${note.text}”`, support: "supported", sourceIds: [note.id], kind: "note" })),
      questions: [],
      missingInfo: [
        ...gapLine(input),
        "Changes, patterns and conflicting reports were not analyzed because the AI summary was unavailable — please read the notes themselves.",
      ],
      categories,
      urgent,
    },
  };
}
