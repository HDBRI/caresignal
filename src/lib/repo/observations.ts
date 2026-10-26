/**
 * Observations. Saving a note:
 *   1. validates input server-side,
 *   2. runs the deterministic safety rules on the ORIGINAL text (no AI, no network),
 *   3. stores the exact text + safety result + alert in one transaction.
 * AI analysis is separate and happens afterwards; it never edits the original.
 * Note entry is never capped.
 */
import { z } from "zod";
import type { Database, Principal } from "../db/client";
import { assertUuid } from "../db/client";
import type { Observation, ObservationAnalysis, ObservationEdit, SafetyAlert } from "../models";
import { isCategoryId } from "../categories";
import { evaluateSafety, type SafetyResult } from "../safety/rules";
import { getCase, NotFoundError } from "./cases";
import { sessionObservationDisplayId } from "./ids";
import { toAlert, toAnalysis, toEdit, toObservation } from "./mappers";

export const newObservationInput = z.object({
  caseId: z.string().uuid(),
  // Not trimmed or normalized: stored exactly as entered.
  text: z.string().refine((s) => s.trim().length > 0, "Note cannot be empty").refine((s) => s.length <= 4000, "Note is too long"),
  eventTime: z.string().datetime({ offset: true }).optional().nullable(),
  authorLabel: z.string().trim().max(60).optional().nullable(),
  /** "pending" only when an AI analysis will actually be attempted; otherwise "not_run" (honest default). */
  aiState: z.enum(["pending", "not_run", "unavailable_limit", "unavailable_error"]).optional(),
});
export type NewObservationInput = z.infer<typeof newObservationInput>;

export interface SavedObservation {
  observation: Observation;
  safety: SafetyResult;
  alert: SafetyAlert | null;
}

export async function addObservation(db: Database, p: Principal, input: NewObservationInput): Promise<SavedObservation> {
  const data = newObservationInput.parse(input);
  await getCase(db, p, data.caseId); // ownership check (throws NotFoundError)
  if (data.eventTime && new Date(data.eventTime).getTime() > Date.now() + 5 * 60_000) {
    throw new Error("Event time cannot be in the future");
  }

  const safety = evaluateSafety(data.text); // runs before anything else; independent of AI

  return db.asPrincipal(p, async (sql) => {
    const [{ n }] = await sql.query<{ n: number }>(
      `select count(*)::int as n from observations where case_id = $1 and owner_id = $2 and origin = 'session'`,
      [data.caseId, p.userId],
    );
    const ruleIds = safety.matches.map((m) => m.ruleId);
    const [row] = await sql.query(
      `insert into observations (case_id, owner_id, display_id, original_text, event_time, author_label, origin, synthetic,
                                 is_test_scenario, safety_tier, safety_rule_ids, safety_rules_version, ai_state)
       values ($1, $2, $3, $4, $5, $6, 'session', true, false, $7, $8, $9, $10) returning *`,
      [
        data.caseId, p.userId, sessionObservationDisplayId(n + 1), data.text, data.eventTime ?? null, data.authorLabel ?? null,
        safety.tier ?? "none", JSON.stringify(ruleIds), safety.rulesVersion, data.aiState ?? "not_run",
      ],
    );
    let alert: SafetyAlert | null = null;
    if (safety.tier) {
      const [a] = await sql.query(
        `insert into safety_alerts (observation_id, case_id, owner_id, tier, rule_ids, matched_text, rules_version)
         values ($1, $2, $3, $4, $5, $6, $7) returning *`,
        [row.id, data.caseId, p.userId, safety.tier, JSON.stringify(ruleIds), JSON.stringify(safety.matches.map((m) => m.matchedText)), safety.rulesVersion],
      );
      alert = toAlert(a);
    }
    return { observation: toObservation(row), safety, alert };
  });
}

export async function listObservations(db: Database, p: Principal, caseId: string): Promise<Observation[]> {
  await getCase(db, p, caseId);
  return db.asPrincipal(p, async (sql) =>
    (
      await sql.query(
        `select * from observations where case_id = $1 and owner_id = $2 order by coalesce(event_time, entered_at), entered_at`,
        [caseId, p.userId],
      )
    ).map(toObservation),
  );
}

/** Look up by stable display ID within one case (used for source links). */
export async function getObservationByDisplayId(
  db: Database,
  p: Principal,
  caseId: string,
  displayId: string,
): Promise<{ observation: Observation; edits: ObservationEdit[]; alert: SafetyAlert | null }> {
  await getCase(db, p, caseId);
  return db.asPrincipal(p, async (sql) => {
    const rows = await sql.query(`select * from observations where case_id = $1 and owner_id = $2 and display_id = $3`, [
      caseId,
      p.userId,
      displayId,
    ]);
    if (rows.length !== 1) throw new NotFoundError("observation");
    const obs = toObservation(rows[0]);
    const edits = (await sql.query(`select * from observation_edits where observation_id = $1 order by version`, [obs.id])).map(toEdit);
    const alerts = await sql.query(`select * from safety_alerts where observation_id = $1`, [obs.id]);
    return { observation: obs, edits, alert: alerts[0] ? toAlert(alerts[0]) : null };
  });
}

/**
 * Edits never change the original; they add a new version with its own timestamp.
 * The safety rules also run on the new wording. A new alert is added if the edit matches a
 * rule and the note had none; an existing alert is never removed by editing.
 */
export async function addObservationEdit(
  db: Database,
  p: Principal,
  observationId: string,
  editedText: string,
): Promise<{ edit: ObservationEdit; safety: SafetyResult; alert: SafetyAlert | null }> {
  assertUuid(observationId, "observation id");
  if (!editedText.trim() || editedText.length > 4000) throw new Error("invalid edit");
  const safety = evaluateSafety(editedText);
  return db.asPrincipal(p, async (sql) => {
    const obs = await sql.query<{ case_id: string; safety_tier: string }>(
      `select case_id, safety_tier from observations where id = $1 and owner_id = $2`,
      [observationId, p.userId],
    );
    if (obs.length !== 1) throw new NotFoundError("observation");
    const [{ v }] = await sql.query<{ v: number }>(
      `select coalesce(max(version), 1)::int as v from observation_edits where observation_id = $1`,
      [observationId],
    );
    const [row] = await sql.query(
      `insert into observation_edits (observation_id, case_id, owner_id, version, edited_text, safety_tier)
       values ($1, $2, $3, $4, $5, $6) returning *`,
      [observationId, obs[0].case_id, p.userId, v + 1, editedText, safety.tier ?? "none"],
    );
    let alert: SafetyAlert | null = null;
    if (safety.tier) {
      const rank = { none: 0, review: 1, contact_care_team: 2, emergency: 3 } as const;
      if (rank[safety.tier] > rank[obs[0].safety_tier as keyof typeof rank]) {
        await sql.query(`update observations set safety_tier = $1, safety_rule_ids = $2 where id = $3 and owner_id = $4`, [
          safety.tier,
          JSON.stringify(safety.matches.map((m) => m.ruleId)),
          observationId,
          p.userId,
        ]);
      }
      const inserted = await sql.query(
        `insert into safety_alerts (observation_id, case_id, owner_id, tier, rule_ids, matched_text, rules_version)
         values ($1, $2, $3, $4, $5, $6, $7) on conflict (observation_id) do nothing returning *`,
        [
          observationId, obs[0].case_id, p.userId, safety.tier, JSON.stringify(safety.matches.map((m) => m.ruleId)),
          JSON.stringify(safety.matches.map((m) => m.matchedText)), safety.rulesVersion,
        ],
      );
      alert = inserted[0] ? toAlert(inserted[0]) : null;
    }
    return { edit: toEdit(row), safety, alert };
  });
}

/** Caregiver correction of the categories. Adds a new row; the AI's suggestion and the note stay unchanged. */
export async function correctCategories(
  db: Database,
  p: Principal,
  observationId: string,
  primary: string,
  secondary: string[],
): Promise<ObservationAnalysis> {
  assertUuid(observationId, "observation id");
  if (!isCategoryId(primary) || !secondary.every(isCategoryId) || secondary.length > 6) throw new Error("invalid categories");
  const cleanSecondary = [...new Set(secondary)].filter((c) => c !== primary);
  return db.asPrincipal(p, async (sql) => {
    const obs = await sql.query<{ case_id: string }>(`select case_id from observations where id = $1 and owner_id = $2`, [
      observationId,
      p.userId,
    ]);
    if (obs.length !== 1) throw new NotFoundError("observation");
    const [row] = await sql.query(
      `insert into observation_analyses (observation_id, case_id, owner_id, primary_category, secondary_categories, summary, model_reported, source)
       values ($1, $2, $3, $4, $5, null, null, 'caregiver') returning *`,
      [observationId, obs[0].case_id, p.userId, primary, JSON.stringify(cleanSecondary)],
    );
    return toAnalysis(row);
  });
}

/** All label rows for one observation, newest first (AI suggestions and caregiver corrections). */
export async function listAnalysisHistory(db: Database, p: Principal, observationId: string): Promise<ObservationAnalysis[]> {
  assertUuid(observationId, "observation id");
  return db.asPrincipal(p, async (sql) =>
    (
      await sql.query(`select * from observation_analyses where observation_id = $1 and owner_id = $2 order by created_at desc`, [
        observationId,
        p.userId,
      ])
    ).map(toAnalysis),
  );
}

/** Latest edit per observation (for showing current wording alongside the original). */
export async function latestEdits(db: Database, p: Principal, caseId: string): Promise<Map<string, ObservationEdit>> {
  await getCase(db, p, caseId);
  const rows = await db.asPrincipal(p, (sql) =>
    sql.query(
      `select distinct on (observation_id) * from observation_edits where case_id = $1 and owner_id = $2
        order by observation_id, version desc`,
      [caseId, p.userId],
    ),
  );
  return new Map(rows.map((r) => [r.observation_id as string, toEdit(r)]));
}

export async function setAiState(db: Database, p: Principal, observationId: string, state: Observation["aiState"]): Promise<void> {
  assertUuid(observationId, "observation id");
  await db.asPrincipal(p, (sql) =>
    sql.query(`update observations set ai_state = $1 where id = $2 and owner_id = $3`, [state, observationId, p.userId]),
  );
}

// ---------------- Safety alerts ----------------

export async function listAlerts(db: Database, p: Principal, caseId: string, opts: { unseenOnly?: boolean } = {}): Promise<SafetyAlert[]> {
  await getCase(db, p, caseId);
  return db.asPrincipal(p, async (sql) =>
    (
      await sql.query(
        `select * from safety_alerts where case_id = $1 and owner_id = $2 ${opts.unseenOnly ? "and seen_at is null" : ""}
         order by created_at desc`,
        [caseId, p.userId],
      )
    ).map(toAlert),
  );
}

/** "I've seen this." Records when; never deletes the note or marks anything resolved. */
export async function markAlertSeen(db: Database, p: Principal, alertId: string): Promise<SafetyAlert> {
  assertUuid(alertId, "alert id");
  return db.asPrincipal(p, async (sql) => {
    const rows = await sql.query(
      `update safety_alerts set seen_at = coalesce(seen_at, now()) where id = $1 and owner_id = $2 returning *`,
      [alertId, p.userId],
    );
    if (rows.length !== 1) throw new NotFoundError("alert");
    return toAlert(rows[0]);
  });
}

// ---------------- AI-derived labels (read) ----------------

/** Latest AI analysis per observation in a case (AI output is stored separately from the original note). */
export async function listAnalyses(db: Database, p: Principal, caseId: string): Promise<Map<string, ObservationAnalysis>> {
  await getCase(db, p, caseId);
  const rows = await db.asPrincipal(p, (sql) =>
    sql.query(
      // A caregiver correction always wins over any AI label (even an AI retry made after the correction).
      `select distinct on (observation_id) * from observation_analyses
        where case_id = $1 and owner_id = $2
        order by observation_id, (source = 'caregiver') desc, created_at desc`,
      [caseId, p.userId],
    ),
  );
  return new Map(rows.map((r) => [r.observation_id as string, toAnalysis(r)]));
}
