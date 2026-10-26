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
import { listBaselines } from "../repo/cases";
import { detectPatterns, fmtDay as fmtPatternDay, type PatternResult } from "../patterns";
import { scenarioTimeline } from "../scenario-timeline";
import { getCase } from "../repo/cases";
import { buildInsightInput, generateInsights } from "./insights";
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

/** Turns deterministic pattern results into the structured handoff sections (B–E). */
function structuredFromPatterns(pr: PatternResult, urgent: NonNullable<HandoffContent["urgent"]>) {
  const patterns: NonNullable<HandoffContent["patterns"]> = pr.findings
    .filter((f) => f.level !== "observation")
    .map((f) => ({
      category: f.category,
      theme: f.theme,
      change: f.headline,
      level: f.level,
      directions: f.directions,
      timeframe: f.timeframe,
      sourceIds: f.sourceIds,
      keySourceIds: f.keySourceIds,
      event: f.relatedEvents[0] ? `${f.relatedEvents[0].label}, ${fmtPatternDay(f.relatedEvents[0].day)} (${f.relatedEvents[0].sourceId ? "from a caregiver note" : "synthetic scenario timeline"})` : null,
      uncertainty: f.uncertainty[0] ?? "",
    }));
  const notable = [
    ...urgent.map((u) => ({
      sourceId: u.sourceId,
      reason: u.tier === "emergency" ? "Matched an emergency safety rule — guidance was shown immediately when it was saved" : "Matched a prompt-attention safety rule — guidance was shown when it was saved",
    })),
    ...pr.findings.filter((f) => f.level === "observation").slice(0, 4).map((f) => ({ sourceId: f.sourceIds[0], reason: `${f.theme} — mentioned once (not a trend)` })),
  ].filter((x, i, a) => a.findIndex((y) => y.sourceId === x.sourceId) === i);
  const timeline = pr.events.map((e) => ({
    day: e.day,
    label: e.label,
    sourceId: e.sourceId,
    quote: e.quote,
    dateCertainty: e.dateCertainty,
    relativeText: e.relativeText,
    relatedThemes: pr.findings.filter((f) => f.relatedEvents.some((r) => r.sourceId === e.sourceId)).map((f) => f.theme),
  }));
  const missing = [...pr.conflicts.map((c) => `Conflicting reports (${c.theme.toLowerCase()}): ${c.detail}`), ...pr.eventNotes, ...pr.gaps];
  return { patterns, notable, timeline, questions: pr.questions, missing };
}

function mergeQuestions(first: HandoffContent["questions"], second: HandoffContent["questions"]) {
  const seen = new Set<string>();
  return [...first, ...second].filter((q) => (seen.has(q.text) ? false : (seen.add(q.text), true))).slice(0, 6);
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

  const [categories, urgent, baselines, theCase] = await Promise.all([categoryGroups(db, p, caseId, ids), urgentNotes(db, p, caseId, ids), listBaselines(db, p, caseId), getCase(db, p, caseId)]);
  // Deterministic pattern detection over the same notes (no AI call).
  const pr = detectPatterns({
    notes: input.notes.map((x) => ({ id: x.id, day: x.day, hasEventTime: x.eventTime !== null, text: x.text, author: x.author })),
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    baselines: baselines.map((b) => ({ domain: b.category, description: b.description })),
    timelineEvents: scenarioTimeline(theCase).filter((e) => e.day >= input.periodStart),
  });
  const structured = structuredFromPatterns(pr, urgent);

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
      content: {
        ...ai,
        summary: pr.overview,
        aiSummary: ai.summary,
        questions: mergeQuestions(structured.questions, ai.questions),
        missingInfo: [...structured.missing, ...ai.missingInfo],
        categories,
        urgent,
        overview: pr.overview,
        patterns: structured.patterns,
        notable: structured.notable,
        timeline: structured.timeline,
      },
    };
  }

  // Notes-only draft: every note listed as the caregiver wrote it. Nothing is interpreted.
  const reason = AI_REASON[aiStatus ?? ""] ?? "the AI summary is not available";
  return {
    ...base,
    draftedBy: "records",
    generation: { method: "records_only", aiStatus, rejectedItems: rejected },
    content: {
      summary: `${pr.overview} (AI interpretation is not available: ${reason}.)`,
      items: input.notes.map((note) => ({ statement: `Caregiver reported: “${note.text}”`, support: "supported", sourceIds: [note.id], kind: "note" })),
      questions: structured.questions,
      missingInfo: [
        ...structured.missing,
        "AI interpretation was not available: the patterns come from fixed rules over the caregiver's words, and conflicting reports were not analyzed by AI — please read the notes themselves.",
      ],
      categories,
      urgent,
      overview: pr.overview,
      patterns: structured.patterns,
      notable: structured.notable,
      timeline: structured.timeline,
    },
  };
}
