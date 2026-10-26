/**
 * Converts the user-provided synthetic monthly dataset (CareSignal_Synthetic_Monthly_Datasets.zip, 2026-09-26 → 2026-10-25)
 * into the three demo-case fixtures. Deterministic and idempotent: same input → same JSON.
 *
 *   npx tsx scripts/import-monthly.ts <path-to/caresignal_monthly_synthetic_dataset.json>
 *
 * - Notes are copied VERBATIM. Dataset IDs are kept in `datasetId`; fixture IDs are OBS-C{n}-{nn} in date order.
 * - Dates become offsets from 2026-10-26 (the day after the window), so the demo stays relative to "today".
 *   The dataset has dates only: entry time is set to 20:00 and no event time is invented.
 * - Safety tiers come from the app's own rules on the note text, never from the dataset's label (differences reported).
 * - Categories come from the dataset's labels and are stored as source "scenario" (not AI, not a caregiver correction).
 * - Check-ins: completed → no_change / noticed_change; not completed / no response → not stored (unknown, never "well").
 * - A row that says "No observation was logged" is a missing day, not a note.
 * - Timeline events are kept separate from notes (`careEvents`), with their dataset IDs.
 */
import fs from "node:fs";
import path from "node:path";
import { evaluateSafety } from "../src/lib/safety/rules";
import { detectPatterns } from "../src/lib/patterns";

const SRC = process.argv[2];
const d = JSON.parse(fs.readFileSync(SRC, "utf8"));
const ROOT = process.cwd();
const ANCHOR = Date.UTC(2026, 9, 26);
const off = (date: string) => Math.round((Date.parse(date + "T00:00:00Z") - ANCHOR) / 86_400_000);
const CAT: Record<string, string> = {
  "Mobility and daily functioning": "mobility_daily_functioning",
  "Physical symptoms and comfort": "physical_symptoms_comfort",
  "Cognition and communication": "cognition_communication",
  "Emotional wellbeing and behavior": "emotional_wellbeing_behavior",
  "Sleep, nutrition and hydration": "sleep_nutrition_hydration",
  "Treatment and care coordination": "treatment_care_coordination",
  Other: "other",
};
const BASE: Record<string, string> = { mobility: "mobility_function", nutrition: "eating_drinking", energy: "energy_sleep", sleep: "energy_sleep" };
const MAP = [
  { profile: "DEMO-JORDAN", file: "case-1-cancer.json", n: 1 },
  { profile: "DEMO-MORGAN", file: "case-2-surgery.json", n: 2 },
  { profile: "DEMO-ALEX", file: "case-3-recovery.json", n: 3 },
];
const EVENT_KIND: Record<string, string> = {
  "Treatment visit": "treatment_session",
  "Care-team check-in": "clinician_visit",
  "Follow-up appointment": "clinician_visit",
  "Recovery-window start": "milestone",
  "Activity milestone": "milestone",
};
const report: string[] = [];

for (const m of MAP) {
  const fx = JSON.parse(fs.readFileSync(path.join(ROOT, "synthetic-data", "cases", m.file), "utf8"));
  const profile = d.profiles.find((p: { profile_id: string }) => p.profile_id === m.profile);
  const rows = d.observations
    .filter((o: { profile_id: string }) => o.profile_id === m.profile)
    .sort((a: { event_date: string; observation_id: string }, b: { event_date: string; observation_id: string }) => a.event_date.localeCompare(b.event_date) || a.observation_id.localeCompare(b.observation_id));
  const missingDays = new Set<number>();
  const observations: unknown[] = [];
  let i = 0;
  for (const o of rows) {
    const text: string = o.original_caregiver_note;
    if (/^No check-in was completed today\. No observation was logged\.$/.test(text.trim())) {
      missingDays.add(off(o.event_date));
      report.push(`${o.observation_id}: treated as a missing day (the row itself says no observation was logged)`);
      continue;
    }
    i += 1;
    const safety = evaluateSafety(text);
    const tier = safety.tier ?? "none";
    const label = o.safety_test_label === "routine" ? "none" : o.safety_test_label;
    if (tier !== label) report.push(`${o.observation_id}: dataset label "${label}", app rules "${tier}" — the app's rules are used`);
    const cats = String(o.categories).split(";").map((c) => CAT[c.trim()]).filter(Boolean);
    const tags: string[] = [];
    if (cats.length > 1) tags.push("multi_category");
    if (o.date_confidence !== "day_reported") tags.push("missing_context");
    if (/\b(but|unclear|unsure|not sure|uncertain)\b/i.test(text)) tags.push("ambiguous");
    if (/\b(caregiver says|according to caregiver|may be describing different|details are unclear)\b/i.test(text)) tags.push("conflicting_report");
    if (tier === "emergency") tags.push("urgent_scenario", "predefined_test_scenario");
    else if (tier !== "none") tags.push("routine_safety_example");
    if (!tags.length) tags.push("ordinary");
    observations.push({
      fixtureId: `OBS-C${m.n}-${String(i).padStart(2, "0")}`,
      datasetId: o.observation_id,
      at: { dayOffset: off(o.entered_date ?? o.event_date), time: "20:00" },
      eventTime: null,
      dateConfidence: o.date_confidence === "day_reported" ? "day_reported" : "uncertain",
      author: null,
      text,
      isTestScenario: tier === "emergency",
      synthetic: true,
      expected: { primaryCategory: cats[0] ?? "other", secondaryCategories: cats.slice(1), safetyTier: tier, tags },
    });
  }
  const noteDays = new Set((observations as { at: { dayOffset: number } }[]).map((o) => o.at.dayOffset));
  for (let k = off(d.date_window.start); k <= off(d.date_window.end); k++) if (!noteDays.has(k)) missingDays.add(k);

  const checkins = d.daily_checkins
    .filter((c: { profile_id: string; status: string }) => c.profile_id === m.profile && c.status === "completed")
    .map((c: { date: string; response: string }) => ({
      dayOffset: off(c.date),
      synthetic: true,
      status: c.response === "noticed_a_change" ? "noticed_change" : "no_change",
      note: null,
      responses: {},
    }));
  const careEvents = profile.timeline_events.map((e: { event_id: string; date: string; type: string; description: string }) => ({
    eventId: e.event_id,
    dayOffset: off(e.date),
    kind: EVENT_KIND[e.type] ?? "milestone",
    label: e.type,
    description: e.description,
    synthetic: true,
  }));

  // Example weekly handoff for the last 7 days, built deterministically from the notes (no AI).
  type Obs = { fixtureId: string; at: { dayOffset: number }; text: string; expected: { safetyTier: string }; isTestScenario: boolean };
  const obs = observations as Obs[];
  const day = (o: number) => new Date(ANCHOR + o * 86_400_000).toISOString().slice(0, 10);
  const week = obs.filter((o) => o.at.dayOffset >= -7);
  const pr = detectPatterns({
    notes: week.map((o) => ({ id: o.fixtureId, day: day(o.at.dayOffset), hasEventTime: false, text: o.text, author: null })),
    periodStart: day(-7),
    periodEnd: day(-1),
    baselines: Object.entries(profile.baseline).map(([k, v]) => ({ domain: BASE[k], description: String(v) })),
  });
  const items = pr.findings.filter((f) => f.level !== "observation").slice(0, 4).map((f) => ({
    statement: `Caregiver notes — ${f.theme.toLowerCase()}: ${f.headline.charAt(0).toLowerCase()}${f.headline.slice(1)}.`,
    support: f.timeframe.days >= 2 ? "supported" : "possible_unconfirmed",
    sourceIds: f.sourceIds,
  }));
  const questions = pr.questions.filter((q) => q.sourceIds.length > 0).slice(0, 3);
  fx.handoff.period = { fromDayOffset: -7, toDayOffset: -1 };
  fx.handoff.content = {
    summary: `Example weekly handoff prepared for this synthetic scenario. ${pr.overview}`,
    items: items.length ? items : [{ statement: "Caregiver notes from the last seven days are listed in the source observations.", support: "supported", sourceIds: week.slice(-1).map((o) => o.fixtureId) }],
    questions,
    missingInfo: pr.gaps,
  };

  fx.title = `${profile.scenario} — 30 days of notes`;
  fx.demonstrates = {
    1: "A month of notes: tiredness reported repeatedly and described as worse, variable eating and drinking with one low-fluid report, and a new need for help dressing compared with the baseline — shown alongside the fictional treatment visit on the timeline (timing only, never a cause). Includes a clearly labeled fictional clinician response.",
    2: "A month of post-surgery recovery that is variable but generally improving, then a predefined synthetic urgent note (sudden confusion and difficult to wake). The deterministic rules show emergency guidance immediately — before and without any AI — and the weekly handoff is never what delivers urgent guidance.",
    3: "A month of gradual recovery with fluctuating activity and discomfort, notes whose timing is uncertain, accounts that conflict within a note, and a missing day — kept as unknown, never as \"fine\".",
  }[m.n as 1 | 2 | 3];
  fx.patient.careContext = `Fictional. ${profile.scenario}. ${profile.care_phase}.`;
  fx.patient.milestones = profile.timeline_events.map((e: { date: string; type: string }) => `${e.type} (${e.date})`).join("; ");
  if (m.n === 3) fx.patient.primaryCondition = "Leg injury recovery (fictional)";
  if (m.n === 2) fx.patient.primaryCondition = "Recovery after surgery (fictional)";
  fx.baselines = Object.entries(profile.baseline).map(([k, v]) => ({ category: BASE[k], description: String(v) }));
  fx.observations = observations;
  fx.missingDays = [...missingDays].sort((a, b) => a - b);
  fx.checkins = checkins;
  fx.careEvents = careEvents;
  fx.dataset = { name: d.dataset_name, version: d.version, window: d.date_window, importedFrom: "CareSignal_Synthetic_Monthly_Datasets.zip" };
  const urgent = obs.find((o) => o.isTestScenario);
  fx.expectedOutcome = {
    supported: items.filter((x) => x.support === "supported").map((x) => ({ claim: x.statement, sourceIds: x.sourceIds })),
    possibleUnconfirmed: items.filter((x) => x.support !== "supported").map((x) => ({ claim: x.statement, sourceIds: x.sourceIds })),
    conflicts: (observations as { fixtureId: string; expected: { tags: string[] } }[]).filter((o) => o.expected.tags.includes("conflicting_report")).map((o) => [o.fixtureId]),
    unknowns: ["Missing check-ins and days without notes are unknown, not well.", "The cause of any reported change is not known from the notes."],
    ...(urgent ? { urgent: { sourceId: urgent.fixtureId, safetyTier: "emergency", ruleIds: evaluateSafety(urgent.text).matches.map((x) => x.ruleId), mustWorkWithoutAi: true } } : {}),
    mustNot: fx.expectedOutcome.mustNot,
  };
  fs.writeFileSync(path.join(ROOT, "synthetic-data", "cases", m.file), JSON.stringify(fx, null, 2) + "\n");
  report.push(`${m.profile} → ${fx.seedKey}: ${observations.length} notes, ${checkins.length} completed check-ins, ${careEvents.length} timeline events, ${fx.missingDays.length} days without a note`);
}
console.log(report.join("\n"));
