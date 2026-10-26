/**
 * Insights dashboard — descriptive data, computed ONLY from persisted records (no AI involved).
 *
 * Definitions (documented for the report):
 *  - An observation's DAY is its event time if the caregiver gave one, otherwise its entry time, as a calendar
 *    day in the app's time zone (America/New_York). Observations with an unparseable timestamp are excluded
 *    from charts and counted as "undated".
 *  - An observation's CATEGORIES are the caregiver's correction if one exists, otherwise the AI labels
 *    (primary + secondary), but only when AI analysis completed. Uncategorized notes are counted separately.
 *  - CATEGORY COUNTS count each observation at most once per category. One note can belong to several
 *    categories, so category counts may add up to more than the total. The TOTAL counts unique observations.
 *  - Counts measure recorded activity (how many notes were logged), never severity or health.
 *  - PERIOD COMPARISON (7 / 30 days only): the same number of days immediately before the selected period.
 *    It is shown only when the records reach back to the start of that earlier period AND the two periods
 *    together hold at least MIN_NOTES_TO_COMPARE notes; otherwise the dashboard says a reliable comparison
 *    can't be made. A difference is a change in recording activity, not necessarily in health.
 */
import { CATEGORIES, type CategoryId } from "./categories";
import type { Baseline, Observation, ObservationAnalysis, ObservationEdit, SafetyAlert } from "./models";
import type { BaselineDomain } from "./onboarding";
import { BASELINE_DOMAINS } from "./onboarding";
import { addDays, DEMO_TIME_ZONE, localDate } from "./time";

export type ChartPeriod = "7d" | "30d" | "all";
export const CHART_PERIODS: { id: ChartPeriod; label: string }[] = [
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "all", label: "All history" },
];

export interface DashboardObservation {
  id: string; // internal id
  displayId: string; // stable ID — kept for traceability, shown only in technical details
  day: string; // YYYY-MM-DD (event day if given, else entry day)
  eventTime: string | null;
  enteredAt: string;
  text: string; // ORIGINAL text, verbatim
  editedText: string | null; // latest correction of wording, if any
  categories: CategoryId[];
  categorySource: "caregiver" | "ai" | null;
  safetyTier: Observation["safetyTier"];
  alertUnseen: boolean;
  origin: Observation["origin"];
  author: string | null;
}

export interface Bucket {
  start: string; // YYYY-MM-DD inclusive
  end: string; // YYYY-MM-DD inclusive
  label: string;
  count: number;
  observationIds: string[]; // display IDs (internal reference for the evidence drawer)
}

export interface CategorySeries {
  id: CategoryId;
  label: string;
  total: number;
  days: number; // distinct days with at least one note in this category
  buckets: Bucket[];
  /** Notes in this category in the previous equal-length period — only when the comparison is reliable. */
  previous: number | null;
}

/** Notes needed across both periods before CareSignal describes any difference. */
export const MIN_NOTES_TO_COMPARE = 4;

export interface PeriodComparison {
  status: "comparable" | "not_applicable" | "no_previous_history" | "too_few_notes";
  /** e.g. "the previous 7 days (Oct 12–Oct 18)" */
  previousLabel: string | null;
  current: number;
  previous: number | null;
  /** Plain-language explanation of what can (or can't) be said. */
  explanation: string;
}

export type FindingKind = "repeated_theme" | "single_mention" | "frequency_change" | "insufficient";

/** Descriptive finding computed from stored records — never an AI output. */
export interface DescriptiveFinding {
  kind: FindingKind;
  title: string;
  detail: string;
  categories: CategoryId[];
  periodLabel: string;
  comparisonBasis: string | null;
  sourceIds: string[];
  uncertainty: string | null;
}

export interface BaselineComparison {
  domain: BaselineDomain;
  domainLabel: string;
  baseline: string | null; // caregiver's words, or null = not provided
  categories: CategoryId[];
  sourceIds: string[]; // notes in the chart period in the related categories
  status: "no_baseline" | "no_recent_notes" | "notes_available";
}

export interface Dashboard {
  period: { id: ChartPeriod; label: string; start: string | null; end: string; bucket: "day" | "week"; days: number };
  metrics: {
    observations: number;
    categoriesRepresented: number;
    firstDay: string | null;
    lastDay: string | null;
    needReview: number; // notes whose safety-rule notice has not been marked as seen
    uncategorized: number;
    undated: number;
  };
  series: CategorySeries[];
  comparison: PeriodComparison;
  uncategorizedIds: string[];
  findings: DescriptiveFinding[];
  baselines: BaselineComparison[];
  observations: Record<string, DashboardObservation>; // keyed by display ID
}

/** Baseline area → the observation categories it can reasonably be compared with. */
export const BASELINE_TO_CATEGORIES: Record<BaselineDomain, CategoryId[]> = {
  mobility_function: ["mobility_daily_functioning"],
  eating_drinking: ["sleep_nutrition_hydration"],
  energy_sleep: ["sleep_nutrition_hydration", "physical_symptoms_comfort"],
  mood_communication: ["emotional_wellbeing_behavior", "cognition_communication"],
  memory_attention: ["cognition_communication"],
  other: ["other"],
};

const isValidIso = (s: string | null | undefined): s is string => Boolean(s) && !Number.isNaN(Date.parse(s as string));

export function observationDay(o: Pick<Observation, "eventTime" | "enteredAt">, timeZone = DEMO_TIME_ZONE): string | null {
  const iso = isValidIso(o.eventTime) ? o.eventTime : isValidIso(o.enteredAt) ? o.enteredAt : null;
  return iso ? localDate(new Date(iso), timeZone) : null;
}

/** Caregiver correction wins; otherwise AI labels only if the AI analysis completed. */
export function effectiveCategories(o: Pick<Observation, "aiState">, analysis: ObservationAnalysis | undefined): { categories: CategoryId[]; source: "caregiver" | "ai" | null } {
  if (!analysis) return { categories: [], source: null };
  if (analysis.source !== "caregiver" && o.aiState !== "complete") return { categories: [], source: null };
  const cats = [...new Set([analysis.primaryCategory, ...analysis.secondaryCategories])].filter((c) =>
    CATEGORIES.some((k) => k.id === c),
  ) as CategoryId[];
  return { categories: cats, source: analysis.source };
}

const dayDiff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

export function fmtShortDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function periodRange(period: ChartPeriod, today: string, earliest: string | null): { start: string | null; end: string; days: number } {
  if (period === "7d") return { start: addDays(today, -6), end: today, days: 7 };
  if (period === "30d") return { start: addDays(today, -29), end: today, days: 30 };
  if (!earliest) return { start: null, end: today, days: 0 };
  const start = earliest < today ? earliest : today;
  return { start, end: today, days: dayDiff(start, today) + 1 };
}

/** Daily buckets up to 14 days; otherwise 7-day buckets ending on the last day. */
export function makeBuckets(start: string, end: string): { bucket: "day" | "week"; ranges: { start: string; end: string; label: string }[] } {
  const days = dayDiff(start, end) + 1;
  if (days <= 14) {
    return {
      bucket: "day",
      ranges: Array.from({ length: days }, (_, i) => {
        const d = addDays(start, i);
        return { start: d, end: d, label: fmtShortDay(d) };
      }),
    };
  }
  const ranges: { start: string; end: string; label: string }[] = [];
  for (let e = end; e >= start; e = addDays(e, -7)) {
    const s = addDays(e, -6) < start ? start : addDays(e, -6);
    ranges.unshift({ start: s, end: e, label: s === e ? fmtShortDay(s) : `${fmtShortDay(s)}–${fmtShortDay(e)}` });
  }
  return { bucket: "week", ranges };
}

export interface DashboardInput {
  observations: Observation[];
  analyses: Map<string, ObservationAnalysis>;
  edits: Map<string, ObservationEdit>;
  alerts: SafetyAlert[];
  baselines: Baseline[];
}

export function computeDashboard(input: DashboardInput, period: ChartPeriod, now: Date = new Date()): Dashboard {
  const today = localDate(now);
  const unseen = new Set(input.alerts.filter((a) => a.seenAt === null).map((a) => a.observationId));

  const all: DashboardObservation[] = [];
  let undated = 0;
  const seen = new Set<string>();
  for (const o of input.observations) {
    if (seen.has(o.id)) continue; // never count a record twice
    seen.add(o.id);
    const day = observationDay(o);
    if (!day) {
      undated += 1;
      continue;
    }
    const { categories, source } = effectiveCategories(o, input.analyses.get(o.id));
    all.push({
      id: o.id,
      displayId: o.displayId,
      day,
      eventTime: o.eventTime,
      enteredAt: o.enteredAt,
      text: o.originalText,
      editedText: input.edits.get(o.id)?.editedText ?? null,
      categories,
      categorySource: source,
      safetyTier: o.safetyTier,
      alertUnseen: unseen.has(o.id),
      origin: o.origin,
      author: o.authorLabel,
    });
  }

  const earliest = all.length ? all.map((o) => o.day).sort()[0] : null;
  const range = periodRange(period, today, earliest);
  const label = CHART_PERIODS.find((p) => p.id === period)!.label;
  const inPeriod = range.start ? all.filter((o) => o.day >= range.start! && o.day <= range.end) : [];
  const { bucket, ranges } = range.start ? makeBuckets(range.start, range.end) : { bucket: "day" as const, ranges: [] };

  // ---- Previous equal-length period (only for 7d/30d, only if records reach back that far, only if not sparse) ----
  const prevStart = period !== "all" && range.start ? addDays(range.start, -range.days) : null;
  const prevEnd = period !== "all" && range.start ? addDays(range.start, -1) : null;
  const hasPrevHistory = Boolean(prevStart && earliest && earliest <= prevStart);
  const prev = prevStart && prevEnd ? all.filter((o) => o.day >= prevStart && o.day <= prevEnd) : [];
  const previousLabel = prevStart && prevEnd ? `the previous ${range.days} days (${fmtShortDay(prevStart)}–${fmtShortDay(prevEnd)})` : null;
  const comparison: PeriodComparison =
    period === "all"
      ? { status: "not_applicable", previousLabel: null, current: inPeriod.length, previous: null, explanation: "All history has no earlier period to compare with." }
      : !hasPrevHistory
        ? {
            status: "no_previous_history",
            previousLabel,
            current: inPeriod.length,
            previous: null,
            explanation: `Notes don't go back far enough to cover ${previousLabel}, so a reliable comparison can't be made.`,
          }
        : inPeriod.length + prev.length < MIN_NOTES_TO_COMPARE
          ? {
              status: "too_few_notes",
              previousLabel,
              current: inPeriod.length,
              previous: prev.length,
              explanation: `Only ${inPeriod.length + prev.length} note${inPeriod.length + prev.length === 1 ? "" : "s"} across both periods — too few for a reliable comparison.`,
            }
          : {
              status: "comparable",
              previousLabel,
              current: inPeriod.length,
              previous: prev.length,
              explanation: "Differences show how much was written down in each period. They are changes in recording activity, not necessarily changes in health.",
            };
  const comparable = comparison.status === "comparable";

  const series: CategorySeries[] = CATEGORIES.map((c) => {
    const notes = inPeriod.filter((o) => o.categories.includes(c.id));
    return {
      id: c.id,
      label: c.label,
      total: notes.length,
      days: new Set(notes.map((o) => o.day)).size,
      buckets: ranges.map((r) => {
        const inBucket = notes.filter((o) => o.day >= r.start && o.day <= r.end).sort((a, b) => a.day.localeCompare(b.day));
        return { ...r, count: inBucket.length, observationIds: inBucket.map((o) => o.displayId) };
      }),
      previous: comparable ? prev.filter((o) => o.categories.includes(c.id)).length : null,
    };
  });

  const uncategorizedIds = inPeriod.filter((o) => o.categories.length === 0).map((o) => o.displayId);
  const days = inPeriod.map((o) => o.day).sort();

  const findings: DescriptiveFinding[] = [];
  if (inPeriod.length > 0 && inPeriod.length < 3) {
    findings.push({
      kind: "insufficient",
      title: "Only a few notes in this period",
      detail: `${inPeriod.length} observation${inPeriod.length === 1 ? " was" : "s were"} logged in this period — not enough to describe patterns.`,
      categories: [],
      periodLabel: label,
      comparisonBasis: null,
      sourceIds: inPeriod.map((o) => o.displayId),
      uncertainty: "Fewer notes does not mean fewer concerns; it may just mean less was written down.",
    });
  }
  for (const s of series) {
    const ids = inPeriod.filter((o) => o.categories.includes(s.id)).map((o) => o.displayId);
    if (s.total >= 2 && s.days >= 2) {
      findings.push({
        kind: "repeated_theme",
        title: `${s.label} came up in several notes`,
        detail: `${s.total} observations on ${s.days} different days were categorized as ${s.label.toLowerCase()}.`,
        categories: [s.id],
        periodLabel: label,
        comparisonBasis: null,
        sourceIds: ids,
        uncertainty: "This counts how often the topic was written about. It does not show whether anything got better or worse.",
      });
    } else if (s.total === 1) {
      findings.push({
        kind: "single_mention",
        title: `${s.label}: one note in this period`,
        detail: `A single observation was categorized as ${s.label.toLowerCase()}.`,
        categories: [s.id],
        periodLabel: label,
        comparisonBasis: null,
        sourceIds: ids,
        uncertainty: "One note is not a pattern.",
      });
    }
    if (comparable) {
      const before = s.previous ?? 0;
      if (Math.abs(s.total - before) >= 2) {
        findings.push({
          kind: "frequency_change",
          title: `${s.total > before ? "More" : "Fewer"} notes about ${s.label.toLowerCase()} were recorded`,
          detail: `${s.total} in this period compared with ${before} in the ${range.days} days before it.`,
          categories: [s.id],
          periodLabel: label,
          comparisonBasis: `The previous ${range.days} days (${fmtShortDay(prevStart!)}–${fmtShortDay(prevEnd!)})`,
          sourceIds: ids,
          uncertainty: "A change in how often something was written about is not necessarily a change in the person's condition.",
        });
      }
    }
  }
  const order: FindingKind[] = ["frequency_change", "repeated_theme", "insufficient", "single_mention"];
  findings.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));

  const baselines: BaselineComparison[] = BASELINE_DOMAINS.map((d) => {
    const b = input.baselines.find((x) => x.category === d.id);
    const cats = BASELINE_TO_CATEGORIES[d.id];
    const ids = inPeriod.filter((o) => o.categories.some((c) => cats.includes(c))).map((o) => o.displayId);
    return {
      domain: d.id,
      domainLabel: d.label,
      baseline: b?.description ?? null,
      categories: cats,
      sourceIds: ids,
      status: !b ? "no_baseline" : ids.length === 0 ? "no_recent_notes" : "notes_available",
    };
  });

  return {
    period: { id: period, label, start: range.start, end: range.end, bucket, days: range.days },
    metrics: {
      observations: inPeriod.length,
      categoriesRepresented: series.filter((s) => s.total > 0).length,
      firstDay: days[0] ?? null,
      lastDay: days[days.length - 1] ?? null,
      needReview: inPeriod.filter((o) => o.alertUnseen).length,
      uncategorized: uncategorizedIds.length,
      undated,
    },
    series,
    comparison,
    uncategorizedIds,
    findings,
    baselines,
    observations: Object.fromEntries(all.map((o) => [o.displayId, o])),
  };
}
