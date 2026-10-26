/**
 * Loads and validates the synthetic data package (synthetic-data/).
 * Imports the JSON statically so it is bundled for the hosted app as well.
 */
import { z } from "zod";
import { CATEGORY_IDS } from "./categories";
import { AGE_RANGES, BASELINE_DOMAIN_IDS, CARE_PHASES, CARE_SETTINGS } from "./onboarding";
import case1 from "../../synthetic-data/cases/case-1-cancer.json";
import case2 from "../../synthetic-data/cases/case-2-surgery.json";
import case3 from "../../synthetic-data/cases/case-3-recovery.json";
import evaluation from "../../synthetic-data/evaluation/evaluation-cases.json";

const category = z.enum(CATEGORY_IDS as [string, ...string[]]);
const tier = z.enum(["emergency", "contact_care_team", "review", "none"]);
const seedTime = z.object({ dayOffset: z.number().int().max(-1), time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) });
const support = z.enum(["supported", "possible_unconfirmed", "conflicting", "unknown"]);
const fixtureObsId = z.string().regex(/^OBS-C[1-3]-\d{2}$/);

const observationFixture = z.object({
  fixtureId: fixtureObsId,
  at: seedTime,
  eventTime: seedTime.nullable(),
  author: z.string().nullable(),
  text: z.string().min(1).max(4000),
  isTestScenario: z.boolean(),
  synthetic: z.literal(true),
  expected: z.object({
    primaryCategory: category,
    secondaryCategories: z.array(category),
    safetyTier: tier,
    tags: z.array(z.string()),
  }),
});

const responses = z.partialRecord(
  category,
  z.union([z.object({ state: z.literal("answered"), value: z.string() }), z.object({ state: z.literal("skipped") })]),
);

const handoffStatus = z.enum(["draft", "reviewed", "submitted", "received", "acknowledged", "failed"]);

const caseFixture = z.object({
  seedKey: z.enum(["PAT-CANCER-001", "PAT-SURGERY-002", "PAT-RECOVERY-003"]),
  synthetic: z.literal(true),
  title: z.string(),
  demonstrates: z.string(),
  demoAccount: z.object({
    userId: z.string().uuid(),
    username: z.string().regex(/^demo-[a-z]+$/),
    email: z.string().email(),
    displayName: z.string(),
  }),
  patient: z.object({
    patientRef: z.string(),
    pseudonym: z.string(),
    ageRange: z.enum(AGE_RANGES.map((a) => a.id) as [string, ...string[]]).nullable(),
    primaryCondition: z.string().max(80).nullable(),
    carePhase: z.enum(CARE_PHASES.map((a) => a.id) as [string, ...string[]]).nullable(),
    careSetting: z.enum(CARE_SETTINGS.map((a) => a.id) as [string, ...string[]]).nullable(),
    careContext: z.string(),
    milestones: z.string().nullable(),
    synthetic: z.literal(true),
  }),
  caregiver: z.object({ name: z.string(), relationship: z.string() }),
  baselines: z.array(z.object({ category: z.enum(BASELINE_DOMAIN_IDS as [string, ...string[]]), description: z.string() })),
  observations: z.array(observationFixture).min(1),
  missingDays: z.array(z.number().int().max(-1)),
  checkins: z.array(
    z.object({
      dayOffset: z.number().int().max(-1),
      synthetic: z.literal(true),
      status: z.enum(["no_change", "noticed_change", "concern", "skipped"]),
      note: z.string().max(500).nullable(),
      responses,
    }),
  ),
  handoff: z.object({
    synthetic: z.literal(true),
    draftedBy: z.literal("seed_fixture"),
    period: z.object({ fromDayOffset: z.number().int(), toDayOffset: z.number().int() }),
    statusTimeline: z.array(z.object({ status: handoffStatus, at: seedTime, note: z.string().nullable() })).min(1),
    content: z.object({
      summary: z.string(),
      items: z.array(z.object({ statement: z.string(), support, sourceIds: z.array(fixtureObsId).min(1) })),
      questions: z.array(z.object({ text: z.string(), sourceIds: z.array(fixtureObsId).min(1) })),
      missingInfo: z.array(z.string()),
    }),
    receiverResponse: z
      .object({
        synthetic: z.literal(true),
        kind: z.literal("fictional_clinician_response"),
        at: seedTime,
        text: z.string(),
        label: z.string(),
      })
      .nullable(),
  }),
  expectedOutcome: z.object({
    supported: z.array(z.object({ claim: z.string(), sourceIds: z.array(fixtureObsId) })),
    possibleUnconfirmed: z.array(z.object({ claim: z.string(), sourceIds: z.array(fixtureObsId) })),
    conflicts: z.array(z.array(fixtureObsId)),
    unknowns: z.array(z.string()),
    urgent: z
      .object({ sourceId: fixtureObsId, safetyTier: tier, ruleIds: z.array(z.string()), mustWorkWithoutAi: z.boolean() })
      .optional(),
    mustNot: z.array(z.string()),
  }),
});

const evaluationFixture = z.object({
  synthetic: z.literal(true),
  cases: z.array(
    z.object({
      id: z.string(),
      kind: z.enum(["observation", "case"]),
      description: z.string(),
      text: z.string().optional(),
      seedKey: z.string().optional(),
      expected: z.record(z.string(), z.unknown()),
    }),
  ),
});

export type CaseFixture = z.infer<typeof caseFixture>;
export type ObservationFixture = z.infer<typeof observationFixture>;
export type SeedKey = CaseFixture["seedKey"];

export const SEED_CASES: CaseFixture[] = [case1, case2, case3].map((c) => caseFixture.parse(c));
export const EVALUATION_CASES = evaluationFixture.parse(evaluation).cases;

export function seedCase(seedKey: string): CaseFixture {
  const c = SEED_CASES.find((s) => s.seedKey === seedKey);
  if (!c) throw new Error("unknown seed case");
  return c;
}

export function seedCaseByUsername(username: string): CaseFixture | undefined {
  return SEED_CASES.find((c) => c.demoAccount.username === username.trim().toLowerCase());
}

export function isSeedKey(value: unknown): value is SeedKey {
  return SEED_CASES.some((c) => c.seedKey === value);
}
