/**
 * Longitudinal pattern detection — deterministic, from stored caregiver notes only (no AI, no network).
 *
 * Levels of evidence (never mixed):
 *   observation          — what a single note recorded
 *   pattern              — what repeated notes (or an explicit "worse/better" in the caregiver's words) show over time
 *   temporal_association — a pattern that sits in the days after a documented care/treatment event (timing only, never cause)
 *   uncertainty          — conflicting reports, gaps, not enough history
 * Clinical interpretation is left to the care team.
 *
 * Honesty rules built in:
 *   - "Reported more often" describes how often something was WRITTEN DOWN, never severity.
 *   - "Described as worse/better" only when the caregiver's own words say so.
 *   - A theme that stops appearing is "not mentioned in recent notes", never "resolved" or "improved".
 *   - No numerical severity scores. Numbers that appear in notes are quoted, not computed.
 *   - Care events come only from what notes document (e.g. "Treatment day at the clinic"). No dates are invented;
 *     a relative date ("next Tuesday") is kept as written and marked unresolved.
 */
import type { CategoryId } from "./categories";

export interface PatternNote {
  id: string; // stable display ID (kept internal; UI shows readable dates)
  day: string; // YYYY-MM-DD — event day if given, else entry day
  hasEventTime: boolean;
  text: string; // original caregiver wording
  author: string | null;
}

export interface Theme {
  id: string;
  label: string;
  category: CategoryId;
  patterns: RegExp[];
  /** Baseline domain this theme can be compared with, and the words in a baseline that make the theme a change. */
  baseline?: { domain: string; normalCue: RegExp };
}

/** Plain-language themes. Matching is literal wording in the caregiver's own note — a starting set, not exhaustive. */
export const THEMES: Theme[] = [
  { id: "fatigue", label: "Tiredness or low energy", category: "physical_symptoms_comfort", patterns: [/\b(tired|tiredness|fatigue[d]?|exhausted|worn out|no energy|low energy|wiped out)\b/i] },
  {
    id: "reduced_intake",
    label: "Eating or drinking less",
    category: "sleep_nutrition_hydration",
    patterns: [/\b(few|couple of) bites\b/i, /\bleft (most|half|all) of\b/i, /\bbarely (touched|ate|eaten)\b/i, /\bskipped (breakfast|lunch|dinner|a meal)\b/i, /\bonly drank\b/i, /\b(not|didn'?t) (eat|eating|drink|drinking)\b/i, /\bate (only )?half\b/i, /\bpoor appetite\b/i],
    baseline: { domain: "eating_drinking", normalCue: /\b(normally|usually|three|meals)\b/i },
  },
  { id: "good_intake", label: "Eating well", category: "sleep_nutrition_hydration", patterns: [/\b(full plate|ate (everything|well|all of)|good appetite|finished (his|her|their) (meal|dinner|lunch))\b/i] },
  { id: "nausea", label: "Nausea", category: "physical_symptoms_comfort", patterns: [/\b(queasy|nause\w*|vomit\w*|threw up|sick to (his|her|their) stomach)\b/i] },
  { id: "taste_change", label: "Food tasting different", category: "physical_symptoms_comfort", patterns: [/\btastes? (like metal|metallic|off|strange)\b/i] },
  {
    id: "help_needed",
    label: "Needing help with daily activities",
    category: "mobility_daily_functioning",
    patterns: [/\bneeded (help|my arm|assistance)\b/i, /\bhelp (getting dressed|dressing|walking|to the bathroom|with the stairs)\b/i, /\bleaned on\b/i, /\bcouldn'?t (get up|stand|walk) (on (his|her|their) own|alone)\b/i],
    baseline: { domain: "mobility_function", normalCue: /\bwithout help|on (his|her|their) own|independent/i },
  },
  {
    id: "daytime_sleep",
    label: "Sleeping more in the day",
    category: "sleep_nutrition_hydration",
    patterns: [/\bnap(ped|ping|s)?\b/i, /\bslept (most of )?the (afternoon|day|morning)\b/i, /\bwent to bed early\b/i, /\bsleeping more\b/i],
    baseline: { domain: "energy_sleep", normalCue: /\b(did not nap|no naps?|doesn'?t nap|didn'?t nap|active most of the day)\b/i },
  },
  { id: "dizziness", label: "Dizziness", category: "physical_symptoms_comfort", patterns: [/\b(dizz\w*|light-?headed)\b/i] },
  { id: "confusion", label: "Confusion or memory changes", category: "cognition_communication", patterns: [/\b(confused|disoriented|didn'?t recognize|lost track|forgetful|kept asking)\b/i] },
  { id: "low_mood", label: "Low mood or frustration", category: "emotional_wellbeing_behavior", patterns: [/\b(seem(ed|s)?|felt|feel(s|ing)?|look(ed|s)?|been|a bit|very|really) (a bit |very |really |pretty )?(down|low|sad|blue)\b/i, /\b(frustrated|quieter than usual|withdrawn|anxious|tearful|irritable)\b/i] },
  { id: "pain", label: "Pain or discomfort", category: "physical_symptoms_comfort", patterns: [/\b(pain|hurts|hurting|sore|aching|discomfort|uncomfortable|stiff)\b/i] },
  { id: "medication_uncertain", label: "Unsure whether medicines were taken", category: "treatment_care_coordination", patterns: [/\bnot sure (whether|if) .{0,40}\b(pills?|medicines?|medications?|doses?|taken|took)\b/i, /\bmissed (a |the )?(dose|pills?|medicines?)\b/i] },
];

const WORSE = /\b(worse|getting worse|more than (before|usual|last)|increasing|worst|more (uncomfortable|tired|sore|painful))\b/i;
const BETTER = /\b(better|improv\w*|easier|less than (before|usual)|more energy|back to (normal|usual)|less (discomfort|pain|tired|sore))\b/i;
const NEW = /\b(first time|new|never (had|needed|did) (this|that|to)? ?before)\b/i;
const NEGATION = /\b(no|not|without|never|denies|denied)\b[^.;,!?]{0,20}$/i;
const CLAUSE_BREAK = /[.;,!?]|\b(and|but|then|so)\b/gi;

function negated(text: string, index: number): boolean {
  let w = text.slice(Math.max(0, index - 25), index);
  let cut = -1;
  for (const m of w.matchAll(CLAUSE_BREAK)) cut = m.index! + m[0].length;
  if (cut >= 0) w = w.slice(cut);
  return NEGATION.test(w);
}

export interface Mention {
  noteId: string;
  day: string;
  quote: string; // the caregiver's matched words
  sentence: string; // the sentence they appear in (for the cue check)
  cue: "worse" | "better" | "new" | null;
}

export function findMentions(theme: Theme, notes: PatternNote[]): Mention[] {
  const out: Mention[] = [];
  for (const n of notes) {
    for (const re of theme.patterns) {
      const m = re.exec(n.text);
      if (!m) continue;
      // "not eating" style patterns carry their own negation; others are skipped when negated ("no pain").
      if (!/^(not|didn'?t|barely|only|skipped|few|couple|left)/i.test(m[0]) && negated(n.text, m.index)) continue;
      const sentence = n.text.split(/(?<=[.!?])\s+/).find((s) => s.includes(m[0])) ?? n.text;
      const cue = WORSE.test(sentence) ? "worse" : BETTER.test(sentence) ? "better" : NEW.test(sentence) ? "new" : null;
      out.push({ noteId: n.id, day: n.day, quote: sentence.trim(), sentence, cue });
      break; // one mention per note per theme
    }
  }
  return out.sort((a, b) => a.day.localeCompare(b.day));
}

// ---------------- Care / treatment events documented in notes ----------------

export type CareEventKind = "treatment_session" | "procedure" | "clinician_visit" | "medication_change" | "medication_taken" | "medication_status_unknown" | "appointment_change" | "milestone";

export interface CareEvent {
  kind: CareEventKind;
  label: string;
  day: string; // the note's day
  dateCertainty: "note_day" | "relative_unresolved" | "scenario_date"; // never a computed date
  relativeText: string | null; // e.g. "next Tuesday" — kept as written
  sourceId: string;
  quote: string;
}

const EVENT_RULES: { kind: CareEventKind; label: string; re: RegExp; relative?: RegExp }[] = [
  { kind: "treatment_session", label: "Treatment session", re: /\b(treatment day|chemo\w*|infusion|radiation|dialysis)\b[^.]*/i },
  { kind: "procedure", label: "Procedure or surgery", re: /\b(surgery|operation|procedure)\b(?! date)[^.]*\b(today|yesterday|this morning|had|was done)\b[^.]*/i },
  { kind: "clinician_visit", label: "Clinician or nurse visit", re: /\b(visiting nurse|nurse came|doctor came|home visit|therapist came)\b[^.]*/i },
  { kind: "medication_change", label: "Medication change (caregiver-reported)", re: /\b(started|stopped|switched|new) (a |the )?(new )?(medicine|medication|pill|dose)\b[^.]*|\bdose (was )?(changed|increased|decreased|lowered|raised)\b[^.]*/i },
  { kind: "medication_taken", label: "Medicines taken (caregiver-reported)", re: /\btook the (morning |evening |night )?(medicines|medications|pills)\b[^.;]*/i },
  { kind: "medication_status_unknown", label: "Medicine status unknown", re: /\bnot sure (whether|if) [^.]*\b(pills?|medicines?|medications?|doses?|taken|took)\b[^.]*/i },
  { kind: "appointment_change", label: "Appointment change", re: /\b(follow-up|appointment|visit)\b[^.]*\b(moved|changed|rescheduled|cancel+ed)\b[^.]*/i, relative: /\b(next|this) (monday|tuesday|wednesday|thursday|friday|saturday|sunday|week)\b/i },
];

export function documentedCareEvents(notes: PatternNote[]): CareEvent[] {
  const out: CareEvent[] = [];
  for (const n of notes) {
    for (const r of EVENT_RULES) {
      const m = r.re.exec(n.text);
      if (!m) continue;
      const rel = r.relative?.exec(n.text)?.[0] ?? null;
      out.push({ kind: r.kind, label: r.label, day: n.day, dateCertainty: rel ? "relative_unresolved" : "note_day", relativeText: rel, sourceId: n.id, quote: m[0].trim() });
    }
  }
  return out.sort((a, b) => a.day.localeCompare(b.day));
}

// ---------------- Patterns ----------------

export type EvidenceLevel = "observation" | "pattern" | "temporal_association" | "uncertainty";
export type Direction = "described_worse" | "described_better" | "fluctuating" | "reported_more_often" | "reported_less_often" | "new" | "not_mentioned_recently" | "unclear";

export interface PatternFinding {
  themeId: string;
  theme: string;
  category: CategoryId;
  level: EvidenceLevel;
  shape: "isolated" | "repeated" | "fluctuating";
  directions: Direction[];
  /** Short plain-language headline, e.g. "Tiredness reported on 4 days; once described as worse than last cycle". */
  headline: string;
  timeframe: { first: string; last: string; days: number };
  sourceIds: string[]; // all supporting notes
  keySourceIds: string[]; // the most informative ones (cue sentences first)
  quotes: { sourceId: string; quote: string }[];
  baseline: string | null; // caregiver-reported baseline it differs from, if any
  relatedEvents: { sourceId: string; label: string; day: string; daysAfter: number[] }[];
  uncertainty: string[];
  priority: number; // ordering only — not a severity score, never shown
}

export interface PatternInput {
  notes: PatternNote[]; // notes in the selected period
  periodStart: string;
  periodEnd: string;
  baselines: { domain: string; description: string }[];
  /** Dated events from the case's scenario timeline (sourceId "" — they are not caregiver notes). */
  timelineEvents?: CareEvent[];
}

const dayDiff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
export const fmtDay = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(new Date(Date.UTC(y, m - 1, d)));
};

export interface PatternResult {
  findings: PatternFinding[];
  events: CareEvent[];
  conflicts: { theme: string; sourceIds: string[]; detail: string }[];
  eventNotes: string[]; // e.g. "Not enough notes after the treatment session to assess a pattern"
  gaps: string[];
  overview: string;
  questions: { text: string; sourceIds: string[] }[];
}

export function detectPatterns(input: PatternInput): PatternResult {
  const notes = [...input.notes].sort((a, b) => a.day.localeCompare(b.day));
  const noteDays = [...new Set(notes.map((n) => n.day))];
  // Only treatment sessions, procedures and medication changes are used for timing; visits are shown on the timeline only.
  const scenarioEvents = (input.timelineEvents ?? []).filter((e) => e.day <= input.periodEnd);
  const events = [...scenarioEvents, ...documentedCareEvents(notes)].filter((e) => e.kind === "treatment_session" || e.kind === "procedure" || e.kind === "medication_change");
  const allEvents = [...scenarioEvents, ...documentedCareEvents(notes)].sort((a, b) => a.day.localeCompare(b.day));
  const findings: PatternFinding[] = [];

  for (const theme of THEMES) {
    if (theme.id === "good_intake") continue; // only used for conflict detection
    const mentions = findMentions(theme, notes);
    if (!mentions.length) continue;
    const days = [...new Set(mentions.map((m) => m.day))];
    const cues = new Set(mentions.map((m) => m.cue).filter(Boolean));
    const directions: Direction[] = [];
    const uncertainty: string[] = [];
    if (cues.has("worse") && cues.has("better")) directions.push("fluctuating");
    else if (cues.has("worse")) directions.push("described_worse");
    else if (cues.has("better")) directions.push("described_better");
    if (cues.has("new")) directions.push("new");

    // Frequency across the two halves of the logged period (recording activity, not severity).
    if (days.length >= 3 && noteDays.length >= 4) {
      const mid = noteDays[Math.floor(noteDays.length / 2)];
      const early = mentions.filter((m) => m.day < mid).length;
      const late = mentions.filter((m) => m.day >= mid).length;
      if (late >= early + 2) directions.push("reported_more_often");
      else if (early >= late + 2) directions.push("reported_less_often");
    }
    // Comes and goes: notes were logged on a day between mentions without this theme.
    const gapDays = noteDays.filter((d) => d > days[0] && d < days[days.length - 1] && !days.includes(d));
    const comesAndGoes = days.length >= 3 && gapDays.length >= 1 && !directions.includes("fluctuating");
    if (comesAndGoes) directions.push("fluctuating");
    // Not mentioned recently: at least 2 later note days without it.
    const laterDays = noteDays.filter((d) => d > days[days.length - 1]);
    if (laterDays.length >= 2) directions.push("not_mentioned_recently");

    const b = theme.baseline ? input.baselines.find((x) => x.domain === theme.baseline!.domain && theme.baseline!.normalCue.test(x.description)) : undefined;
    if (b && !directions.includes("new")) directions.push("new");
    if (!directions.length) directions.push(days.length >= 2 ? "unclear" : "unclear");

    const related = events
      .map((e) => ({ e, after: days.map((d) => dayDiff(e.day, d)).filter((x) => x >= 0 && x <= 5) }))
      .filter((x) => x.after.length > 0 && !(x.e.sourceId && mentions.every((m) => m.noteId === x.e.sourceId)))
      .map((x) => ({ sourceId: x.e.sourceId, label: x.e.label, day: x.e.day, daysAfter: x.after }));

    const shape: PatternFinding["shape"] = days.length === 1 ? "isolated" : directions.includes("fluctuating") ? "fluctuating" : "repeated";
    const level: EvidenceLevel = related.length && days.length >= 2 ? "temporal_association" : days.length >= 2 || cues.size ? "pattern" : "observation";
    if (days.length < 2 && !cues.size) uncertainty.push("Only one note — not enough information to establish a trend.");
    if (directions.includes("reported_more_often") || directions.includes("reported_less_often"))
      uncertainty.push("A change in how often something was written down is not necessarily a change in how the person is.");
    if (directions.includes("not_mentioned_recently")) uncertainty.push("Not mentioned in recent notes — that is not the same as resolved.");
    if (related.length) uncertainty.push("The timing overlaps a documented care event; the notes do not show whether they are related.");

    const parts: string[] = [`Reported on ${days.length} day${days.length === 1 ? "" : "s"}`];
    if (directions.includes("described_worse")) parts.push("described as worse in the caregiver's words");
    if (directions.includes("described_better")) parts.push("described as better in the caregiver's words");
    if (directions.includes("fluctuating")) parts.push(cues.has("worse") && cues.has("better") ? "described both better and worse" : "appears to come and go");
    if (directions.includes("new")) parts.push(b ? "differs from the caregiver-reported baseline" : "described as new");
    if (directions.includes("reported_more_often")) parts.push("mentioned more often later in the period");
    if (directions.includes("reported_less_often")) parts.push("mentioned less often later in the period");
    if (directions.includes("not_mentioned_recently")) parts.push("not mentioned in the most recent notes");
    const keyIds = [...mentions.filter((m) => m.cue).map((m) => m.noteId), ...mentions.map((m) => m.noteId)];
    findings.push({
      themeId: theme.id,
      theme: theme.label,
      category: theme.category,
      level,
      shape,
      directions,
      headline: parts.join("; "),
      timeframe: { first: days[0], last: days[days.length - 1], days: days.length },
      sourceIds: mentions.map((m) => m.noteId),
      keySourceIds: [...new Set(keyIds)].slice(0, 3),
      quotes: mentions.map((m) => ({ sourceId: m.noteId, quote: m.quote })),
      baseline: b?.description ?? null,
      relatedEvents: related,
      uncertainty,
      priority: (cues.has("worse") ? 40 : 0) + (directions.includes("new") ? 30 : 0) + days.length * 5 + (related.length ? 5 : 0),
    });
  }
  findings.sort((a, b) => b.priority - a.priority || a.theme.localeCompare(b.theme));

  // Conflicting reports about eating within a day of each other (kept side by side, never resolved).
  const conflicts: PatternResult["conflicts"] = [];
  const less = findMentions(THEMES.find((t) => t.id === "reduced_intake")!, notes);
  const more = findMentions(THEMES.find((t) => t.id === "good_intake")!, notes);
  for (const g of more) {
    const other = less.find((l) => Math.abs(dayDiff(l.day, g.day)) <= 1);
    if (other) conflicts.push({ theme: "Eating", sourceIds: [g.noteId, other.noteId], detail: `“${g.quote}” and “${other.quote}” were reported within a day of each other, possibly by different people; it is unclear whether they describe the same meal.` });
  }

  // Accounts that differ inside one note ("caregiver says … Alex remembers …") are kept as a conflict, not resolved.
  const DIFFERING = /\b(caregiver says|according to (the )?caregiver|caregiver recalls)\b[^.]*\b(but|;)|\bmay be describing different\b|\bthe details are unclear\b/i;
  for (const n of notes) {
    if (DIFFERING.test(n.text) && !conflicts.some((c) => c.sourceIds.includes(n.id)))
      conflicts.push({ theme: "Accounts", sourceIds: [n.id], detail: `Accounts differ within one note (${fmtDay(n.day)}): “${n.text}”` });
  }

  const eventNotes: string[] = [];
  for (const e of events) {
    const after = noteDays.filter((d) => d > e.day);
    if (after.length < 2) eventNotes.push(`${e.label} (${fmtDay(e.day)}): not enough notes afterwards to assess a pattern.`);
  }
  for (const e of allEvents.filter((x) => x.dateCertainty === "relative_unresolved"))
    eventNotes.push(`${e.label}: date given as “${e.relativeText}” in a note from ${fmtDay(e.day)} — not converted to a calendar date.`);

  const gaps: string[] = [];
  const periodDays = dayDiff(input.periodStart, input.periodEnd) + 1;
  const missing = periodDays - noteDays.filter((d) => d >= input.periodStart && d <= input.periodEnd).length;
  if (missing > 0) gaps.push(`No note on ${missing} of ${periodDays} days (not reported — not the same as "nothing happened").`);
  if (!events.length) gaps.push("No treatment session, procedure or medication change is documented with a date in these notes, so timing relative to treatment can't be assessed.");
  if (notes.length < 3) gaps.push("Not enough information to establish trends in this period.");
  if (notes.some((n) => !n.hasEventTime)) gaps.push("Some notes give no time of the event; their day is the day they were logged.");

  const top = findings.filter((f) => f.level !== "observation").slice(0, 3);
  const overview = notes.length === 0
    ? "No observations were logged for this period."
    : top.length === 0
      ? `${notes.length} note${notes.length === 1 ? " was" : "s were"} logged; no topic came up on more than one day, so there is not enough information to establish a trend.`
      : `${notes.length} notes were logged. Most notable: ${top.map(shortSummary).join("; ")}.${conflicts.length ? " Some reports conflict." : ""} The notes do not establish the cause of these changes.`;

  const questions: PatternResult["questions"] = [];
  for (const f of findings.slice(0, 4)) {
    if (f.directions.includes("new") && f.baseline) questions.push({ text: `Is the change in “${f.theme.toLowerCase()}” important relative to the usual baseline (“${f.baseline}”)?`, sourceIds: f.keySourceIds });
    else if (f.relatedEvents.length) questions.push({ text: `Would it help to review when “${f.theme.toLowerCase()}” was reported alongside the documented ${f.relatedEvents[0].label.toLowerCase()} (${fmtDay(f.relatedEvents[0].day)})?`, sourceIds: [...f.keySourceIds, f.relatedEvents[0].sourceId] });
    else if (f.directions.includes("described_worse")) questions.push({ text: `What should we watch for regarding “${f.theme.toLowerCase()}”, which was described as worse?`, sourceIds: f.keySourceIds });
  }
  for (const c of conflicts) questions.push({ text: "How would you like eating to be recorded, since reports differ?", sourceIds: c.sourceIds });
  const uniq = new Map(questions.map((q) => [q.text, q]));

  return { findings, events: allEvents, conflicts, eventNotes, gaps, overview, questions: [...uniq.values()].slice(0, 5) };
}

/** "tiredness or low energy (4 days, described as worse)" — for the one-paragraph overview. */
function shortSummary(f: PatternFinding): string {
  const bits = [`${f.timeframe.days} day${f.timeframe.days === 1 ? "" : "s"}`];
  if (f.directions.includes("described_worse")) bits.push("described as worse");
  else if (f.directions.includes("described_better")) bits.push("described as better");
  if (f.directions.includes("new")) bits.push(f.baseline ? "differs from the usual baseline" : "described as new");
  if (f.relatedEvents.length) bits.push(`after the documented ${f.relatedEvents[0].label.toLowerCase()}`);
  return `${f.theme.toLowerCase()} (${bits.join(", ")})`;
}

/** Evidence label for display: a one-day finding with explicit wording is not a "repeated" pattern. */
export function levelLabel(f: { level: EvidenceLevel; timeframe: { days: number } }): string {
  if (f.level === "pattern" && f.timeframe.days === 1) return "Single note · explicit change in the caregiver's words";
  if (f.level === "temporal_association" && f.timeframe.days === 1) return "Single note · after a documented care event";
  return LEVEL_LABEL[f.level];
}

export const DIRECTION_LABEL: Record<Direction, string> = {
  described_worse: "Described as worse",
  described_better: "Described as better",
  fluctuating: "Comes and goes",
  reported_more_often: "Mentioned more often",
  reported_less_often: "Mentioned less often",
  new: "New / differs from baseline",
  not_mentioned_recently: "Not mentioned recently",
  unclear: "Direction unclear",
};

export const LEVEL_LABEL: Record<EvidenceLevel, string> = {
  observation: "Single observation",
  pattern: "Repeated pattern",
  temporal_association: "Timing overlaps a care event",
  uncertainty: "Uncertain",
};
