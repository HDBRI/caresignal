/**
 * CareSignal domain models (typed views of the database rows).
 * Data dictionary: docs/DATA_MODEL.md. All timestamps are ISO-8601 UTC strings.
 * `null` always means "not provided / not reported" — never "normal".
 */
import type { CategoryId, CheckinTopic } from "./categories";
import type { SafetyTier } from "./safety/rules";
import type { BaselineDomain } from "./onboarding";

export type Origin = "seeded" | "session";

// ---------- Sessions and accounts ----------
export type AccountKind = "registered" | "demo";

/** Who is acting. Demo visitors share a demo login but each has their own demo session. */
export interface CaregiverSession {
  userId: string;
  accountKind: AccountKind;
  displayName: string;
  /** Present only for demo visitors; isolates their personal copy of a seeded case. */
  demoSessionId: string | null;
}

export interface DemoSession {
  id: string;
  ownerId: string;
  seedKey: string;
  createdAt: string;
  lastSeenAt: string;
}

// ---------- Patient / case ----------
export interface PatientCase {
  id: string;
  ownerId: string;
  kind: "demo_copy" | "user";
  demoSessionId: string | null;
  patientRef: string; // PAT-CANCER-001 or PAT-USER-XXXXXX
  seedKey: string | null;
  pseudonym: string;
  careContext: string | null;
  ageRange: string | null;
  primaryCondition: string | null;
  carePhase: string | null;
  careSetting: string | null;
  milestones: string | null;
  caregiverName: string | null;
  caregiverRelationship: string | null;
  reminderPref: "off" | "in_app_daily";
  reminderTime: string | null; // "HH:MM" local, only when the in-app reminder is on
  reminderTz: string | null; // IANA time zone captured from the caregiver's browser
  synthetic: true;
  seedAnchor: string | null;
  createdAt: string;
}

export interface Baseline {
  id: string;
  caseId: string;
  category: BaselineDomain;
  description: string;
  origin: Origin;
  synthetic: boolean;
  reportedAt: string;
}

// ---------- Observations ----------
export type AiState =
  | "pending"
  | "complete"
  | "failed"
  | "failed_validation"
  | "unavailable_error"
  | "unavailable_limit"
  | "not_run";

export interface Observation {
  id: string;
  caseId: string;
  displayId: string; // stable: OBS-C1-03 (seeded) / OBS-0001 (added this session)
  originalText: string; // exactly as entered; immutable
  enteredAt: string; // set by the server
  eventTime: string | null; // optional "When did this happen?"; null = not provided
  authorLabel: string | null;
  origin: Origin;
  synthetic: boolean;
  isTestScenario: boolean;
  safetyTier: SafetyTier | "none";
  safetyRuleIds: string[];
  safetyRulesVersion: string;
  aiState: AiState;
}

export interface ObservationEdit {
  id: string;
  observationId: string;
  version: number; // 2, 3, ... (version 1 is the original)
  editedText: string;
  editedAt: string;
  safetyTier: SafetyTier | "none" | null;
}

export interface ObservationAnalysis {
  id: string;
  observationId: string;
  /** "ai" = suggested by the model; "caregiver" = a correction made by the caregiver. */
  source: "ai" | "caregiver";
  primaryCategory: CategoryId;
  secondaryCategories: CategoryId[];
  /** AI-extracted facts, each with the exact words from the note that support it. */
  facts: { fact: string; quote: string }[];
  summary: string | null;
  modelReported: string | null;
  createdAt: string;
}

export interface SafetyAlert {
  id: string;
  observationId: string;
  caseId: string;
  tier: SafetyTier;
  ruleIds: string[];
  matchedText: string[];
  rulesVersion: string;
  isTestScenario: boolean;
  createdAt: string;
  seenAt: string | null; // "I've seen this" — not "resolved"
}

// ---------- Check-ins ----------
export type CheckinResponse = { state: "answered"; value: string } | { state: "skipped" };
/** Missing category key = not reported. */
export type CheckinResponses = Partial<Record<CheckinTopic, CheckinResponse>>;
export type CheckinState = "answered" | "skipped" | "not_reported";

/** Overall daily status. "No response recorded" is the absence of a check-in, never stored. */
export type CheckinStatus = "no_change" | "noticed_change" | "concern" | "skipped";

export interface DailyCheckin {
  id: string;
  caseId: string;
  day: string; // YYYY-MM-DD
  status: CheckinStatus;
  note: string | null;
  /** When the caregiver last answered (updated each time the day's answer changes). */
  respondedAt: string;
  responses: CheckinResponses;
  origin: Origin;
  synthetic: boolean;
  createdAt: string;
}

// ---------- Insights ----------
export type InsightKind = "pattern" | "change" | "possible_pattern" | "conflict" | "missing_info" | "question";
export type Support = "supported" | "possible_unconfirmed" | "conflicting" | "unknown";

export interface Evidence {
  sourceId: string; // observation display_id
  quote: string; // exact substring of the original note
}

export interface Insight {
  id: string;
  runId: string;
  position: number;
  kind: InsightKind;
  statement: string;
  support: Support;
  sourceIds: string[]; // >= 1, all in the same case
  evidence: Evidence[];
  uncertainty: string | null;
  comparesToBaseline: boolean;
}

export type InsightRunStatus = "complete" | "failed" | "failed_validation" | "unavailable_error" | "unavailable_limit";

export interface InsightRun {
  id: string;
  caseId: string;
  status: InsightRunStatus;
  periodStart: string | null;
  periodEnd: string | null;
  origin: Origin;
  modelReported: string | null;
  generatedAt: string | null;
  errorReason: string | null;
  summary: string | null;
  unknowns: { statement: string; sourceIds: string[] }[];
  inputSourceIds: string[];
  rejectedItems: number;
  promptVersion: string | null;
  createdAt: string;
}

// ---------- Handoffs ----------
export type HandoffStatus = "draft" | "reviewed" | "submitted" | "received" | "acknowledged" | "failed";

export interface HandoffItem {
  statement: string;
  support: Support;
  sourceIds: string[];
  /** Task 13 drafts: what kind of statement this is (an AI insight, or a caregiver note listed as-is). */
  kind?: "pattern" | "change" | "possible_pattern" | "conflict" | "note" | "recording_activity";
  uncertainty?: string | null;
  comparesToBaseline?: boolean;
  /** Set when the caregiver carried this finding over from the Insights page. */
  addedFrom?: "insights";
}

export interface HandoffQuestion {
  text: string;
  sourceIds: string[];
}

/** The content a caregiver reviews and approves. Frozen into approvedPayload at review. */
export interface HandoffContent {
  summary: string;
  items: HandoffItem[];
  questions: HandoffQuestion[];
  missingInfo: string[];
  /** Task 13 drafts: notes grouped by category (caregiver correction first, else completed AI labels). */
  categories?: { category: string; sourceIds: string[] }[];
  /** Task 13 drafts: notes in the period that triggered emergency / prompt-attention guidance when saved. */
  urgent?: { sourceId: string; tier: SafetyTier; alertedAt: string; seenAt: string | null }[];
}

export interface HandoffPayload extends HandoffContent {
  handoffId: string; // HO-XXXXXXXX
  patientRef: string;
  pseudonym: string;
  periodStart: string | null;
  periodEnd: string | null;
  safetyNotes: { sourceId: string; tier: SafetyTier }[];
  synthetic: true;
  disclaimer: string;
}

export interface Handoff {
  id: string;
  displayId: string;
  caseId: string;
  status: HandoffStatus;
  periodStart: string | null;
  periodEnd: string | null;
  draft: HandoffContent;
  draftedBy: "ai" | "caregiver" | "seed_fixture" | "records";
  approvedPayload: HandoffPayload | null;
  sourceIds: string[];
  origin: Origin;
  synthetic: boolean;
  reviewedAt: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  /** The draft as generated, before caregiver edits (null for seeded examples). */
  generatedContent: HandoffContent | null;
  generation: HandoffGeneration;
  editedAt: string | null;
  /** Exact approved payload text (byte for byte) and its SHA-256, frozen at approval. */
  approvedPayloadText: string | null;
  approvedPayloadSha256: string | null;
  submitAttempts: number;
  lastError: string | null;
}

export interface HandoffGeneration {
  method?: "ai_insights" | "records_only" | "empty";
  insightRunId?: string | null;
  aiStatus?: string | null;
  modelReported?: string | null;
  reusedRun?: boolean;
  rejectedItems?: number;
}

export interface HandoffStatusEvent {
  id: string;
  handoffId: string;
  status: HandoffStatus;
  event: "status" | "edited" | "regenerated" | "response_added";
  note: string | null;
  at: string;
}

/** Delivery receipt — exists only after the simulated backend persisted the payload. */
export interface ReceiverRecord {
  id: string;
  handoffId: string;
  payload: HandoffPayload;
  /** The exact text received, its hash, and the receipt's own ID (RC-...). Null for seeded examples. */
  payloadText: string | null;
  payloadSha256: string | null;
  receiptCode: string | null;
  receivedAt: string;
  acknowledgedAt: string | null;
  synthetic: boolean;
}

export interface ReceiverResponse {
  id: string;
  handoffId: string;
  kind: "fictional_clinician_response";
  text: string;
  label: string;
  synthetic: true;
  at: string;
}

// ---------- Evaluation ----------
export interface EvaluationCase {
  id: string;
  kind: "observation" | "case";
  description: string;
  text?: string;
  seedKey?: string;
  expected: {
    safetyTier?: SafetyTier | "none";
    primaryCategory?: CategoryId;
    acceptableCategories?: CategoryId[];
    aiMustNot?: string[];
    mustMentionSourceIds?: string[];
    mustKeepConflict?: string[][];
    mustListUnknowns?: string[];
  };
}

export interface EvaluationResult {
  id: string;
  evalCaseId: string;
  runLabel: string;
  checkName: string;
  passed: boolean;
  details: Record<string, unknown>;
  modelReported: string | null;
  createdAt: string;
}
