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
import type { Observation, ObservationEdit, SafetyAlert } from "../models";
import { evaluateSafety, type SafetyResult } from "../safety/rules";
import { getCase, NotFoundError } from "./cases";
import { sessionObservationDisplayId } from "./ids";
import { toAlert, toEdit, toObservation } from "./mappers";

export const newObservationInput = z.object({
  caseId: z.string().uuid(),
  // Not trimmed or normalized: stored exactly as entered.
  text: z.string().refine((s) => s.trim().length > 0, "Note cannot be empty").refine((s) => s.length <= 4000, "Note is too long"),
  eventTime: z.string().datetime({ offset: true }).optional().nullable(),
  authorLabel: z.string().trim().max(60).optional().nullable(),
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
       values ($1, $2, $3, $4, $5, $6, 'session', true, false, $7, $8, $9, 'pending') returning *`,
      [
        data.caseId, p.userId, sessionObservationDisplayId(n + 1), data.text, data.eventTime ?? null, data.authorLabel ?? null,
        safety.tier ?? "none", JSON.stringify(ruleIds), safety.rulesVersion,
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

/** Edits never change the original; they add a new version. */
export async function addObservationEdit(db: Database, p: Principal, observationId: string, editedText: string): Promise<ObservationEdit> {
  assertUuid(observationId, "observation id");
  if (!editedText.trim() || editedText.length > 4000) throw new Error("invalid edit");
  return db.asPrincipal(p, async (sql) => {
    const obs = await sql.query<{ case_id: string }>(`select case_id from observations where id = $1 and owner_id = $2`, [observationId, p.userId]);
    if (obs.length !== 1) throw new NotFoundError("observation");
    const [{ v }] = await sql.query<{ v: number }>(
      `select coalesce(max(version), 1)::int as v from observation_edits where observation_id = $1`,
      [observationId],
    );
    const [row] = await sql.query(
      `insert into observation_edits (observation_id, case_id, owner_id, version, edited_text) values ($1, $2, $3, $4, $5) returning *`,
      [observationId, obs[0].case_id, p.userId, v + 1, editedText],
    );
    return toEdit(row);
  });
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
