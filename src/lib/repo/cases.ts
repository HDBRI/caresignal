/**
 * Case-level reads/writes. Every function takes a Principal and runs under RLS,
 * and every query also filters by owner_id explicitly (defense in depth).
 */
import { z } from "zod";
import type { Database, Principal } from "../db/client";
import { assertUuid } from "../db/client";
import { AGE_RANGES, BASELINE_DOMAIN_IDS, CARE_PHASES, CARE_SETTINGS } from "../onboarding";
import type { Baseline, PatientCase } from "../models";
import { newUserPatientRef } from "./ids";
import { toBaseline, toCase } from "./mappers";

export class NotFoundError extends Error {
  constructor(what = "record") {
    super(`${what} not found`);
  }
}

export async function listCases(db: Database, p: Principal): Promise<PatientCase[]> {
  return db.asPrincipal(p, async (sql) =>
    (await sql.query(`select * from cases where owner_id = $1 order by created_at`, [p.userId])).map(toCase),
  );
}

/** Throws NotFoundError if the case does not exist OR is not visible to this principal. */
export async function getCase(db: Database, p: Principal, caseId: string): Promise<PatientCase> {
  assertUuid(caseId, "case id");
  const rows = await db.asPrincipal(p, (sql) =>
    sql.query(`select * from cases where id = $1 and owner_id = $2`, [caseId, p.userId]),
  );
  if (rows.length !== 1) throw new NotFoundError("case");
  return toCase(rows[0]);
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)); // blank -> NULL ("Not provided")

const optionalEnum = (ids: readonly string[]) =>
  z
    .union([z.enum(ids as [string, ...string[]]), z.literal("")])
    .nullish()
    .transform((v) => (v ? v : null));

export const newCaseInput = z.object({
  pseudonym: z
    .string()
    .trim()
    .min(1, "Enter a fictional name or nickname")
    .max(60, "Keep the name under 60 characters"),
  caregiverName: optionalText(60),
  caregiverRelationship: optionalText(60),
  ageRange: optionalEnum(AGE_RANGES.map((a) => a.id)),
  primaryCondition: optionalText(80),
  carePhase: optionalEnum(CARE_PHASES.map((a) => a.id)),
  careSetting: optionalEnum(CARE_SETTINGS.map((a) => a.id)),
  careContext: optionalText(1000),
  milestones: optionalText(1000),
  baselines: z
    .array(z.object({ category: z.enum(BASELINE_DOMAIN_IDS as [string, ...string[]]), description: z.string().trim().max(500) }))
    .max(BASELINE_DOMAIN_IDS.length)
    .optional()
    .transform((list) => (list ?? []).filter((b) => b.description.length > 0)), // blank baseline -> not stored
});
export type NewCaseInput = z.input<typeof newCaseInput>;

/** Registered users create their own fictional case. Demo visitors cannot. */
export async function createUserCase(db: Database, p: Principal, input: NewCaseInput): Promise<PatientCase> {
  if (p.demoSessionId) throw new Error("demo sessions cannot create private cases");
  const data = newCaseInput.parse(input);
  return db.asPrincipal(p, async (sql) => {
    const [row] = await sql.query(
      `insert into cases (owner_id, kind, patient_ref, pseudonym, care_context, caregiver_name, caregiver_relationship,
                          age_range, primary_condition, care_phase, care_setting, milestones, synthetic)
       values ($1, 'user', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true) returning *`,
      [
        p.userId, newUserPatientRef(), data.pseudonym, data.careContext, data.caregiverName, data.caregiverRelationship,
        data.ageRange, data.primaryCondition, data.carePhase, data.careSetting, data.milestones,
      ],
    );
    for (const b of data.baselines) {
      await sql.query(
        `insert into baselines (case_id, owner_id, category, description, origin, synthetic) values ($1, $2, $3, $4, 'session', true)`,
        [row.id, p.userId, b.category, b.description],
      );
    }
    return toCase(row);
  });
}

/** Update care context fields of the caller's own case (Settings). */
export async function updateCaseDetails(db: Database, p: Principal, caseId: string, input: NewCaseInput): Promise<PatientCase> {
  await getCase(db, p, caseId);
  const data = newCaseInput.parse(input);
  return db.asPrincipal(p, async (sql) => {
    const rows = await sql.query(
      `update cases set pseudonym = $3, care_context = $4, caregiver_name = $5, caregiver_relationship = $6, age_range = $7,
              primary_condition = $8, care_phase = $9, care_setting = $10, milestones = $11
       where id = $1 and owner_id = $2 returning *`,
      [
        caseId, p.userId, data.pseudonym, data.careContext, data.caregiverName, data.caregiverRelationship, data.ageRange,
        data.primaryCondition, data.carePhase, data.careSetting, data.milestones,
      ],
    );
    if (rows.length !== 1) throw new NotFoundError("case");
    return toCase(rows[0]);
  });
}

export async function listBaselines(db: Database, p: Principal, caseId: string): Promise<Baseline[]> {
  await getCase(db, p, caseId);
  return db.asPrincipal(p, async (sql) =>
    (await sql.query(`select * from baselines where case_id = $1 and owner_id = $2 order by category`, [caseId, p.userId])).map(
      toBaseline,
    ),
  );
}

export async function deleteUserCase(db: Database, p: Principal, caseId: string): Promise<void> {
  const c = await getCase(db, p, caseId);
  if (c.kind !== "user") throw new Error("demo copies are reset, not deleted");
  await db.asPrincipal(p, (sql) => sql.query(`delete from cases where id = $1 and owner_id = $2`, [caseId, p.userId]));
}

/** Replace the caregiver-reported baseline. Blank descriptions are removed (shown as "Not provided"). */
export async function saveBaselines(
  db: Database,
  p: Principal,
  caseId: string,
  entries: { category: string; description: string }[],
): Promise<Baseline[]> {
  await getCase(db, p, caseId);
  const clean = z
    .array(z.object({ category: z.enum(BASELINE_DOMAIN_IDS as [string, ...string[]]), description: z.string().trim().max(500) }))
    .parse(entries);
  return db.asPrincipal(p, async (sql) => {
    for (const e of clean) {
      if (!e.description) {
        await sql.query(`delete from baselines where case_id = $1 and owner_id = $2 and category = $3`, [caseId, p.userId, e.category]);
      } else {
        await sql.query(
          `insert into baselines (case_id, owner_id, category, description, origin, synthetic) values ($1, $2, $3, $4, 'session', true)
           on conflict (case_id, category) do update set description = excluded.description, origin = 'session', reported_at = now()`,
          [caseId, p.userId, e.category, e.description],
        );
      }
    }
    return (await sql.query(`select * from baselines where case_id = $1 and owner_id = $2 order by category`, [caseId, p.userId])).map(toBaseline);
  });
}

/** In-app reminder preference only (no email/SMS/push). Default "off". */
export async function setReminderPref(db: Database, p: Principal, caseId: string, pref: "off" | "in_app_daily"): Promise<void> {
  await getCase(db, p, caseId);
  if (pref !== "off" && pref !== "in_app_daily") throw new Error("invalid preference");
  await db.asPrincipal(p, (sql) => sql.query(`update cases set reminder_pref = $3 where id = $1 and owner_id = $2`, [caseId, p.userId, pref]));
}
