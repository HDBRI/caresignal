/** Insights dashboard: descriptive calculations from stored records (no AI). */
import { afterEach, describe, expect, it } from "vitest";
import { computeDashboard, effectiveCategories, makeBuckets, observationDay, type DashboardInput } from "@/lib/dashboard";
import { containsRawId, humanizeText, readableLabel } from "@/lib/humanize";
import type { Database } from "@/lib/db/client";
import type { Baseline, Observation, ObservationAnalysis, ObservationEdit, SafetyAlert } from "@/lib/models";
import { createUserCase } from "@/lib/repo/cases";
import { loadDashboard } from "@/lib/repo/dashboard";
import { addObservation, correctCategories } from "@/lib/repo/observations";
import { copySeedToUserCase } from "@/lib/repo/seed";
import { freshDb, registeredUser } from "./helpers/db";

// "Now" = Oct 25 2026, 3 pm New York. Today is 2026-10-25 in the app time zone.
const NOW = new Date("2026-10-25T19:00:00Z");
const at = (day: string, hhmm = "10:00") => new Date(`${day}T${hhmm}:00-04:00`).toISOString(); // New York (EDT)

let n = 0;
function obs(day: string, over: Partial<Observation> = {}): Observation {
  n += 1;
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    caseId: "c",
    displayId: `OBS-T-${String(n).padStart(3, "0")}`,
    originalText: `note ${n}`,
    enteredAt: at(day),
    eventTime: null,
    authorLabel: null,
    origin: "session",
    synthetic: true,
    isTestScenario: false,
    safetyTier: "none",
    safetyRuleIds: [],
    safetyRulesVersion: "v",
    aiState: "complete",
    ...over,
  };
}
const label = (o: Observation, primary: string, secondary: string[] = [], source: "ai" | "caregiver" = "ai"): [string, ObservationAnalysis] => [
  o.id,
  { id: `a-${o.id}`, observationId: o.id, source, primaryCategory: primary as never, secondaryCategories: secondary as never[], facts: [], summary: null, modelReported: null, createdAt: o.enteredAt },
];
const input = (observations: Observation[], labels: [string, ObservationAnalysis][] = [], extra: Partial<DashboardInput> = {}): DashboardInput => ({
  observations,
  analyses: new Map(labels),
  edits: new Map<string, ObservationEdit>(),
  alerts: [] as SafetyAlert[],
  baselines: [] as Baseline[],
  ...extra,
});

describe("period filtering", () => {
  it("last 7 days = today and the 6 days before; day 7 back is excluded", () => {
    const a = obs("2026-10-25"), b = obs("2026-10-19"), c = obs("2026-10-18");
    const d = computeDashboard(input([a, b, c]), "7d", NOW);
    expect([d.period.start, d.period.end]).toEqual(["2026-10-19", "2026-10-25"]);
    expect(d.metrics.observations).toBe(2);
  });
  it("last 30 days and all history", () => {
    const a = obs("2026-10-25"), b = obs("2026-09-26"), c = obs("2026-09-25"), e = obs("2026-01-02");
    expect(computeDashboard(input([a, b, c, e]), "30d", NOW).metrics.observations).toBe(2);
    const all = computeDashboard(input([a, b, c, e]), "all", NOW);
    expect(all.metrics.observations).toBe(4);
    expect(all.period.start).toBe("2026-01-02");
  });
  it("uses the event day when given, otherwise the entry day", () => {
    const entered25happened20 = obs("2026-10-25", { eventTime: at("2026-10-20", "08:00") });
    const d = computeDashboard(input([entered25happened20], [label(entered25happened20, "other")]), "7d", NOW);
    expect(d.observations[entered25happened20.displayId].day).toBe("2026-10-20");
    expect(d.series.find((s) => s.id === "other")!.buckets.find((b) => b.start === "2026-10-20")!.count).toBe(1);
  });
  it("applies the app time zone at day boundaries (11:30 pm New York is still that day)", () => {
    expect(observationDay({ eventTime: null, enteredAt: "2026-10-21T03:30:00Z" })).toBe("2026-10-20");
    expect(observationDay({ eventTime: null, enteredAt: "2026-10-21T04:30:00Z" })).toBe("2026-10-21");
  });
  it("missing or malformed dates are excluded from charts and counted as undated (never crash)", () => {
    const bad = obs("2026-10-25", { enteredAt: "not-a-date", eventTime: "also-bad" });
    const fallback = obs("2026-10-24", { eventTime: "garbage" }); // falls back to entry time
    const d = computeDashboard(input([bad, fallback]), "7d", NOW);
    expect(d.metrics.undated).toBe(1);
    expect(d.metrics.observations).toBe(1);
    expect(d.observations[fallback.displayId].day).toBe("2026-10-24");
  });
});

describe("buckets and counts", () => {
  it("7 days → 7 daily buckets; 30 days → weekly buckets that cover every day once", () => {
    expect(makeBuckets("2026-10-19", "2026-10-25")).toMatchObject({ bucket: "day" });
    const w = makeBuckets("2026-09-26", "2026-10-25");
    expect(w.bucket).toBe("week");
    expect(w.ranges[w.ranges.length - 1]).toMatchObject({ start: "2026-10-19", end: "2026-10-25" });
    expect(w.ranges[0].start).toBe("2026-09-26");
    const covered = w.ranges.reduce((sum, r) => sum + (Date.parse(r.end) - Date.parse(r.start)) / 86_400_000 + 1, 0);
    expect(covered).toBe(30);
  });
  it("bucket counts add up to the category total", () => {
    const notes = ["2026-10-01", "2026-10-02", "2026-10-15", "2026-10-25"].map((d) => obs(d));
    const d = computeDashboard(input(notes, notes.map((o) => label(o, "mobility_daily_functioning"))), "30d", NOW);
    const s = d.series.find((x) => x.id === "mobility_daily_functioning")!;
    expect(s.total).toBe(4);
    expect(s.buckets.reduce((a, b) => a + b.count, 0)).toBe(4);
  });
  it("a note in several categories counts once per category, but once in the overall total", () => {
    const o = obs("2026-10-24");
    const d = computeDashboard(input([o], [label(o, "physical_symptoms_comfort", ["sleep_nutrition_hydration", "physical_symptoms_comfort"])]), "7d", NOW);
    expect(d.metrics.observations).toBe(1);
    expect(d.metrics.categoriesRepresented).toBe(2);
    expect(d.series.find((s) => s.id === "physical_symptoms_comfort")!.total).toBe(1);
    expect(d.series.find((s) => s.id === "sleep_nutrition_hydration")!.total).toBe(1);
  });
  it("the same record is never counted twice (duplicate rows from a join or repeated request)", () => {
    const o = obs("2026-10-24");
    const d = computeDashboard(input([o, { ...o }], [label(o, "other")]), "7d", NOW);
    expect(d.metrics.observations).toBe(1);
    expect(d.series.find((s) => s.id === "other")!.total).toBe(1);
  });
  it("a caregiver correction replaces the AI label; AI labels are only used once analysis completed", () => {
    const o = obs("2026-10-24");
    expect(effectiveCategories(o, label(o, "other", [], "caregiver")[1]).categories).toEqual(["other"]);
    const pending = obs("2026-10-24", { aiState: "pending" });
    expect(effectiveCategories(pending, label(pending, "other")[1])).toEqual({ categories: [], source: null });
    const d = computeDashboard(input([pending]), "7d", NOW);
    expect(d.metrics.uncategorized).toBe(1);
    expect(d.uncategorizedIds).toEqual([pending.displayId]);
  });
  it("an edited note keeps its categories and count; the newer wording is carried for display", () => {
    const o = obs("2026-10-24");
    const edits = new Map([[o.id, { id: "e", observationId: o.id, version: 2, editedText: "fixed wording", editedAt: o.enteredAt, safetyTier: null }]]);
    const d = computeDashboard(input([o], [label(o, "other")], { edits }), "7d", NOW);
    expect(d.series.find((s) => s.id === "other")!.total).toBe(1);
    expect(d.observations[o.displayId]).toMatchObject({ text: o.originalText, editedText: "fixed wording" });
  });
});

describe("findings never overstate", () => {
  it("empty period: zero counts, no findings, nothing reassuring", () => {
    const d = computeDashboard(input([obs("2026-01-01")]), "7d", NOW);
    expect(d.metrics.observations).toBe(0);
    expect(d.findings).toEqual([]);
    expect(JSON.stringify(d)).not.toMatch(/\b(fine|normal|safe)\b|\bimprov/i);
  });
  it("a single observation: 'only a few notes' + a single mention, never a pattern or a change", () => {
    const o = obs("2026-10-24");
    const d = computeDashboard(input([o], [label(o, "physical_symptoms_comfort")]), "7d", NOW);
    expect(d.findings.map((f) => f.kind).sort()).toEqual(["insufficient", "single_mention"]);
  });
  it("a repeated theme needs 2+ notes on 2+ different days, and says it counts writing, not condition", () => {
    const a = obs("2026-10-24"), b = obs("2026-10-24"), c = obs("2026-10-22");
    const sameDay = computeDashboard(input([a, b], [label(a, "other"), label(b, "other")]), "7d", NOW);
    expect(sameDay.findings.some((f) => f.kind === "repeated_theme")).toBe(false);
    const twoDays = computeDashboard(input([a, c, b], [label(a, "other"), label(c, "other"), label(b, "other")]), "7d", NOW);
    const f = twoDays.findings.find((x) => x.kind === "repeated_theme")!;
    expect(f.uncertainty).toMatch(/does not show whether anything got better or worse/);
  });
  it("frequency changes only when earlier records exist, worded as more/fewer notes recorded", () => {
    const recent = ["2026-10-20", "2026-10-22", "2026-10-24"].map((d) => obs(d));
    const sparse = computeDashboard(input(recent, recent.map((o) => label(o, "mobility_daily_functioning"))), "7d", NOW);
    expect(sparse.findings.some((f) => f.kind === "frequency_change")).toBe(false); // no history before this week
    const old = obs("2026-10-10");
    const withHistory = computeDashboard(input([old, ...recent], [old, ...recent].map((o) => label(o, "mobility_daily_functioning"))), "7d", NOW);
    const f = withHistory.findings.find((x) => x.kind === "frequency_change")!;
    expect(f.title).toBe("More notes about mobility and daily functioning were recorded");
    expect(f.detail).toBe("3 in this period compared with 0 in the 7 days before it.");
    expect(f.uncertainty).toMatch(/not necessarily a change in the person's condition/);
  });
});

describe("baseline comparison", () => {
  it("states clearly when there is no baseline, or no recent notes (never 'improved')", () => {
    const o = obs("2026-10-24");
    const baselines: Baseline[] = [{ id: "b", caseId: "c", category: "mobility_function", description: "Walks without help", origin: "session", synthetic: true, reportedAt: o.enteredAt }];
    const d = computeDashboard(input([o], [label(o, "sleep_nutrition_hydration")], { baselines }), "7d", NOW);
    const byDomain = Object.fromEntries(d.baselines.map((b) => [b.domain, b.status]));
    expect(byDomain.mobility_function).toBe("no_recent_notes");
    expect(byDomain.eating_drinking).toBe("no_baseline");
  });
});

describe("readable labels instead of raw IDs", () => {
  it("hides IDs in text but keeps a readable reference; evidence IDs stay in the data", () => {
    const o = obs("2026-10-24");
    const d = computeDashboard(input([o], [label(o, "physical_symptoms_comfort")]), "7d", NOW);
    const text = `Caregiver reported tiredness (${o.displayId}) and again in ${o.displayId}.`;
    const out = humanizeText(text, d.observations);
    expect(containsRawId(out)).toBe(false);
    expect(out).toBe("Caregiver reported tiredness and again in the Oct 24 note.");
    expect(readableLabel(d.observations[o.displayId])).toBe("Oct 24 · Physical symptoms and comfort");
    expect(d.series.find((s) => s.id === "physical_symptoms_comfort")!.buckets.flatMap((b) => b.observationIds)).toEqual([o.displayId]);
  });
});

describe("loaded through the authorized data path", () => {
  let db: Database;
  afterEach(async () => {
    await db?.close();
    db = undefined as unknown as Database;
  });

  it("updates after adding a note and after correcting its category", async () => {
    db = await freshDb();
    const u = await registeredUser(db);
    const c = await createUserCase(db, u, { pseudonym: "Fictional" });
    expect((await loadDashboard(db, u, c.id, "7d")).metrics.observations).toBe(0);
    const { observation } = await addObservation(db, u, { caseId: c.id, text: "Needed help on the stairs" });
    let d = await loadDashboard(db, u, c.id, "7d");
    expect([d.metrics.observations, d.metrics.uncategorized]).toEqual([1, 1]);
    await correctCategories(db, u, observation.id, "mobility_daily_functioning", []);
    d = await loadDashboard(db, u, c.id, "7d");
    expect(d.series.find((s) => s.id === "mobility_daily_functioning")!.total).toBe(1);
    expect(d.metrics.uncategorized).toBe(0);
  });

  it("works with AI unavailable (charts never depend on the model)", async () => {
    const saved = process.env.PORTKEY_API_KEY;
    delete process.env.PORTKEY_API_KEY;
    db = await freshDb();
    const u = await registeredUser(db);
    const caseId = await copySeedToUserCase(db, u, "PAT-SURGERY-002");
    const d = await loadDashboard(db, u, caseId, "all");
    expect(d.metrics.observations).toBe(8);
    expect(d.metrics.needReview).toBe(2); // the deterministic safety notices are still counted
    if (saved !== undefined) process.env.PORTKEY_API_KEY = saved;
  });

  it("case isolation: another user cannot load the dashboard; evidence only contains this case's notes", async () => {
    db = await freshDb();
    const a = await registeredUser(db, "A");
    const b = await registeredUser(db, "B");
    const c1 = await copySeedToUserCase(db, a, "PAT-CANCER-001");
    const c3 = await copySeedToUserCase(db, a, "PAT-RECOVERY-003");
    await expect(loadDashboard(db, b, c1, "all")).rejects.toThrow();
    const d = await loadDashboard(db, a, c3, "all");
    expect(Object.keys(d.observations).every((id) => id.startsWith("OBS-C3-"))).toBe(true);
  });
});
