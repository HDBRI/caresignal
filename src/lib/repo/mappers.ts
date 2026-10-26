/** Row -> model mappers. Dates become ISO strings; JSON columns are parsed if needed. */
import type {
  Baseline,
  DailyCheckin,
  Handoff,
  HandoffStatusEvent,
  Insight,
  InsightRun,
  Observation,
  ObservationAnalysis,
  ObservationEdit,
  PatientCase,
  ReceiverRecord,
  ReceiverResponse,
  SafetyAlert,
} from "../models";

type Row = Record<string, unknown>;

const iso = (v: unknown): string => (v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString());
const isoOrNull = (v: unknown): string | null => (v === null || v === undefined ? null : iso(v));
const json = <T>(v: unknown): T => (typeof v === "string" ? (JSON.parse(v) as T) : (v as T));
const day = (v: unknown): string => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));

export const toCase = (r: Row): PatientCase => ({
  id: r.id as string,
  ownerId: r.owner_id as string,
  kind: r.kind as PatientCase["kind"],
  demoSessionId: (r.demo_session_id as string) ?? null,
  patientRef: r.patient_ref as string,
  seedKey: (r.seed_key as string) ?? null,
  pseudonym: r.pseudonym as string,
  careContext: (r.care_context as string) ?? null,
  ageRange: (r.age_range as string) ?? null,
  primaryCondition: (r.primary_condition as string) ?? null,
  carePhase: (r.care_phase as string) ?? null,
  careSetting: (r.care_setting as string) ?? null,
  milestones: (r.milestones as string) ?? null,
  caregiverName: (r.caregiver_name as string) ?? null,
  caregiverRelationship: (r.caregiver_relationship as string) ?? null,
  reminderPref: r.reminder_pref as PatientCase["reminderPref"],
  reminderTime: (r.reminder_time as string) ?? null,
  reminderTz: (r.reminder_tz as string) ?? null,
  synthetic: true,
  seedAnchor: isoOrNull(r.seed_anchor),
  createdAt: iso(r.created_at),
});

export const toBaseline = (r: Row): Baseline => ({
  id: r.id as string,
  caseId: r.case_id as string,
  category: r.category as Baseline["category"],
  description: r.description as string,
  origin: r.origin as Baseline["origin"],
  synthetic: Boolean(r.synthetic),
  reportedAt: iso(r.reported_at),
});

export const toObservation = (r: Row): Observation => ({
  id: r.id as string,
  caseId: r.case_id as string,
  displayId: r.display_id as string,
  originalText: r.original_text as string,
  enteredAt: iso(r.entered_at),
  eventTime: isoOrNull(r.event_time),
  authorLabel: (r.author_label as string) ?? null,
  origin: r.origin as Observation["origin"],
  synthetic: Boolean(r.synthetic),
  isTestScenario: Boolean(r.is_test_scenario),
  safetyTier: r.safety_tier as Observation["safetyTier"],
  safetyRuleIds: json<string[]>(r.safety_rule_ids),
  safetyRulesVersion: r.safety_rules_version as string,
  aiState: r.ai_state as Observation["aiState"],
});

export const toEdit = (r: Row): ObservationEdit => ({
  id: r.id as string,
  observationId: r.observation_id as string,
  version: Number(r.version),
  editedText: r.edited_text as string,
  editedAt: iso(r.edited_at),
  safetyTier: (r.safety_tier as ObservationEdit["safetyTier"]) ?? null,
});

export const toAlert = (r: Row): SafetyAlert => ({
  id: r.id as string,
  observationId: r.observation_id as string,
  caseId: r.case_id as string,
  tier: r.tier as SafetyAlert["tier"],
  ruleIds: json<string[]>(r.rule_ids),
  matchedText: json<string[]>(r.matched_text),
  rulesVersion: r.rules_version as string,
  isTestScenario: Boolean(r.is_test_scenario),
  createdAt: iso(r.created_at),
  seenAt: isoOrNull(r.seen_at),
});

export const toCheckin = (r: Row): DailyCheckin => ({
  id: r.id as string,
  caseId: r.case_id as string,
  day: day(r.day),
  status: r.status as DailyCheckin["status"],
  note: (r.note as string) ?? null,
  respondedAt: iso(r.responded_at ?? r.created_at),
  responses: json(r.responses),
  origin: r.origin as DailyCheckin["origin"],
  synthetic: Boolean(r.synthetic),
  createdAt: iso(r.created_at),
});

export const toInsightRun = (r: Row): InsightRun => ({
  id: r.id as string,
  caseId: r.case_id as string,
  status: r.status as InsightRun["status"],
  periodStart: isoOrNull(r.period_start),
  periodEnd: isoOrNull(r.period_end),
  origin: r.origin as InsightRun["origin"],
  modelReported: (r.model_reported as string) ?? null,
  generatedAt: isoOrNull(r.generated_at),
  errorReason: (r.error_reason as string) ?? null,
  summary: (r.summary as string) ?? null,
  unknowns: r.unknowns ? json(r.unknowns) : [],
  inputSourceIds: r.input_source_ids ? json(r.input_source_ids) : [],
  rejectedItems: Number(r.rejected_items ?? 0),
  promptVersion: (r.prompt_version as string) ?? null,
  createdAt: iso(r.created_at),
});

export const toInsight = (r: Row): Insight => ({
  id: r.id as string,
  runId: r.run_id as string,
  position: Number(r.position),
  kind: r.kind as Insight["kind"],
  statement: r.statement as string,
  support: r.support as Insight["support"],
  sourceIds: json<string[]>(r.source_ids),
  evidence: (json<{ source_id?: string; sourceId?: string; quote: string }[]>(r.evidence) ?? []).map((e) => ({
    sourceId: (e.source_id ?? e.sourceId) as string,
    quote: e.quote,
  })),
  uncertainty: (r.uncertainty as string) ?? null,
  comparesToBaseline: Boolean(r.compares_to_baseline),
});

export const toHandoff = (r: Row): Handoff => ({
  id: r.id as string,
  displayId: r.display_id as string,
  caseId: r.case_id as string,
  status: r.status as Handoff["status"],
  periodStart: isoOrNull(r.period_start),
  periodEnd: isoOrNull(r.period_end),
  draft: json(r.draft),
  draftedBy: r.drafted_by as Handoff["draftedBy"],
  approvedPayload: r.approved_payload ? json(r.approved_payload) : null,
  sourceIds: json<string[]>(r.source_ids),
  origin: r.origin as Handoff["origin"],
  synthetic: Boolean(r.synthetic),
  reviewedAt: isoOrNull(r.reviewed_at),
  submittedAt: isoOrNull(r.submitted_at),
  createdAt: iso(r.created_at),
  updatedAt: iso(r.updated_at),
  version: Number(r.version ?? 1),
  generatedContent: r.generated_content ? json(r.generated_content) : null,
  generation: r.generation ? json(r.generation) : {},
  editedAt: isoOrNull(r.edited_at),
});

export const toStatusEvent = (r: Row): HandoffStatusEvent => ({
  id: r.id as string,
  handoffId: r.handoff_id as string,
  status: r.status as HandoffStatusEvent["status"],
  event: ((r.event as string) ?? "status") as HandoffStatusEvent["event"],
  note: (r.note as string) ?? null,
  at: iso(r.at),
});

export const toReceiverRecord = (r: Row): ReceiverRecord => ({
  id: r.id as string,
  handoffId: r.handoff_id as string,
  payload: json(r.payload),
  receivedAt: iso(r.received_at),
  acknowledgedAt: isoOrNull(r.acknowledged_at),
  synthetic: Boolean(r.synthetic),
});

export const toReceiverResponse = (r: Row): ReceiverResponse => ({
  id: r.id as string,
  handoffId: r.handoff_id as string,
  kind: "fictional_clinician_response",
  text: r.text as string,
  label: r.label as string,
  synthetic: true,
  at: iso(r.at),
});

export const toAnalysis = (r: Row): ObservationAnalysis => ({
  id: r.id as string,
  observationId: r.observation_id as string,
  source: ((r.source as string) ?? "ai") as ObservationAnalysis["source"],
  primaryCategory: r.primary_category as ObservationAnalysis["primaryCategory"],
  secondaryCategories: json(r.secondary_categories),
  facts: r.facts ? json(r.facts) : [],
  summary: (r.summary as string) ?? null,
  modelReported: (r.model_reported as string) ?? null,
  createdAt: iso(r.created_at),
});
