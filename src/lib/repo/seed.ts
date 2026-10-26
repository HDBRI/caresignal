/**
 * Materializes a fixture case into the database: a personal demo copy (one per demo
 * visitor session) or a registered user's own copy. Shared fixtures are never written
 * to directly — every visitor gets fresh rows they own, so nobody can overwrite the seed.
 *
 * Deterministic: given the same fixture and anchor, the resulting content and timestamps
 * are identical (only generated row UUIDs and handoff IDs differ).
 */
import type { Database, Principal, Sql } from "../db/client";
import { assertUuid } from "../db/client";
import { seedCase, type CaseFixture } from "../fixtures";
import { GENERATED, generatedFor } from "../generated";
import type { HandoffPayload } from "../models";
import { evaluateSafety } from "../safety/rules";
import { resolveSeedDay, resolveSeedTime } from "../time";
import { newHandoffDisplayId } from "./ids";

export const HANDOFF_DISCLAIMER =
  "Classroom prototype. Synthetic data only. Caregiver-reported observations organized by CareSignal; not medical advice, not a diagnosis, and not reviewed by a clinician. Sent to a simulated receiver — no real care team was contacted.";

interface Target {
  ownerId: string;
  kind: "demo_copy" | "user";
  demoSessionId: string | null;
}

/** Insert every row for one fixture case. Runs inside the caller's (admin) transaction. */
export async function materializeSeedCase(sql: Sql, fixture: CaseFixture, anchor: Date, target: Target): Promise<string> {
  const t = (at: { dayOffset: number; time: string }) => resolveSeedTime(anchor, at);
  const p = fixture.patient;

  const [{ id: caseId }] = await sql.query<{ id: string }>(
    `insert into cases (owner_id, kind, demo_session_id, patient_ref, seed_key, pseudonym, care_context,
                        caregiver_name, caregiver_relationship, synthetic, seed_anchor,
                        age_range, primary_condition, care_phase, care_setting, milestones)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10, $11, $12, $13, $14, $15) returning id`,
    [
      target.ownerId, target.kind, target.demoSessionId, p.patientRef, fixture.seedKey, p.pseudonym, p.careContext,
      fixture.caregiver.name, fixture.caregiver.relationship, anchor.toISOString(),
      p.ageRange, p.primaryCondition, p.carePhase, p.careSetting, p.milestones,
    ],
  );

  for (const b of fixture.baselines) {
    await sql.query(
      `insert into baselines (case_id, owner_id, category, description, origin, synthetic, reported_at)
       values ($1, $2, $3, $4, 'seeded', true, $5)`,
      [caseId, target.ownerId, b.category, b.description, t({ dayOffset: -8, time: "09:00" })],
    );
  }

  const obsIdByFixture = new Map<string, string>();
  for (const o of fixture.observations) {
    const safety = evaluateSafety(o.text);
    const [{ id }] = await sql.query<{ id: string }>(
      `insert into observations (case_id, owner_id, display_id, original_text, entered_at, event_time, author_label,
                                 origin, synthetic, is_test_scenario, safety_tier, safety_rule_ids, safety_rules_version, ai_state)
       values ($1, $2, $3, $4, $5, $6, $7, 'seeded', true, $8, $9, $10, $11, 'not_run') returning id`,
      [
        caseId, target.ownerId, o.fixtureId, o.text, t(o.at), o.eventTime ? t(o.eventTime) : null, o.author,
        o.isTestScenario, safety.tier ?? "none", JSON.stringify(safety.matches.map((m) => m.ruleId)), safety.rulesVersion,
      ],
    );
    obsIdByFixture.set(o.fixtureId, id);
    if (safety.tier) {
      await sql.query(
        `insert into safety_alerts (observation_id, case_id, owner_id, tier, rule_ids, matched_text, rules_version,
                                    is_test_scenario, created_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          id, caseId, target.ownerId, safety.tier, JSON.stringify(safety.matches.map((m) => m.ruleId)),
          JSON.stringify(safety.matches.map((m) => m.matchedText)), safety.rulesVersion, o.isTestScenario, t(o.at),
        ],
      );
    }
  }

  await materializeGeneratedAi(sql, fixture, anchor, caseId, target.ownerId, obsIdByFixture);

  for (const c of fixture.checkins) {
    await sql.query(
      `insert into checkins (case_id, owner_id, day, status, note, responses, origin, synthetic, created_at)
       values ($1, $2, $3, $4, $5, $6, 'seeded', true, $7)`,
      [
        caseId, target.ownerId, resolveSeedDay(anchor, c.dayOffset), c.status, c.note, JSON.stringify(c.responses),
        t({ dayOffset: c.dayOffset, time: "21:00" }),
      ],
    );
  }

  await materializeHandoff(sql, fixture, anchor, caseId, target.ownerId);
  return caseId;
}

/**
 * Copy the real AI output that was generated once for this demo case (npm run seed:ai), if any.
 * It is stored with its original generation time and model, and shown as "prepared with the demo".
 */
async function materializeGeneratedAi(
  sql: Sql,
  fixture: CaseFixture,
  anchor: Date,
  caseId: string,
  ownerId: string,
  obsIdByFixture: Map<string, string>,
) {
  const gen = generatedFor(fixture.seedKey);
  if (!gen) return;
  const generatedAt = GENERATED.generatedAt ?? anchor.toISOString();
  for (const [fixtureId, n] of Object.entries(gen.notes)) {
    const obsId = obsIdByFixture.get(fixtureId);
    if (!obsId) continue;
    await sql.query(
      `insert into observation_analyses (observation_id, case_id, owner_id, primary_category, secondary_categories, facts, model_reported, source, prompt_version, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, 'ai', $8, $9)`,
      [obsId, caseId, ownerId, n.primary, JSON.stringify(n.secondary), JSON.stringify(n.facts), n.modelReported, GENERATED.promptVersions?.categorize ?? null, generatedAt],
    );
    await sql.query(`update observations set ai_state = 'complete' where id = $1`, [obsId]);
  }
  const ins = gen.insights;
  if (!ins) return;
  const [{ id: runId }] = await sql.query<{ id: string }>(
    `insert into insight_runs (case_id, owner_id, status, period_start, period_end, origin, model_reported, generated_at, summary, unknowns,
                               questions, input_source_ids, rejected_items, prompt_version, created_at)
     values ($1, $2, 'complete', $3, $4, 'seeded', $5, $6, $7, $8, $9, $10, $11, $12, $6) returning id`,
    [
      caseId, ownerId, resolveSeedTime(anchor, { dayOffset: -7, time: "00:00" }), anchor.toISOString(), ins.modelReported, generatedAt,
      ins.value.summary, JSON.stringify(ins.value.unknowns), JSON.stringify(ins.value.questions), JSON.stringify(ins.inputSourceIds),
      ins.rejected, GENERATED.promptVersions?.insights ?? null,
    ],
  );
  let pos = 0;
  for (const i of ins.value.insights) {
    await sql.query(
      `insert into insights (run_id, case_id, owner_id, position, kind, statement, support, source_ids, evidence, uncertainty, compares_to_baseline)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        runId, caseId, ownerId, pos++, i.kind, i.statement, i.support, JSON.stringify(i.sourceIds),
        JSON.stringify(i.evidence.map((e) => ({ source_id: e.sourceId, quote: e.quote }))), i.uncertainty, i.comparesToBaseline,
      ],
    );
  }
  for (const q of ins.value.questions) {
    await sql.query(
      `insert into insights (run_id, case_id, owner_id, position, kind, statement, support, source_ids, evidence, uncertainty)
       values ($1, $2, $3, $4, 'question', $5, 'unknown', $6, '[]'::jsonb, null)`,
      [runId, caseId, ownerId, pos++, q.text, JSON.stringify(q.sourceIds)],
    );
  }
}

async function materializeHandoff(sql: Sql, fixture: CaseFixture, anchor: Date, caseId: string, ownerId: string) {
  const h = fixture.handoff;
  const t = (at: { dayOffset: number; time: string }) => resolveSeedTime(anchor, at);
  const timeline = h.statusTimeline;
  const final = timeline[timeline.length - 1];
  const at = (s: string) => timeline.find((e) => e.status === s);
  const displayId = newHandoffDisplayId();
  const periodStart = t({ dayOffset: h.period.fromDayOffset, time: "00:00" });
  const periodEnd = t({ dayOffset: h.period.toDayOffset, time: "23:59" });
  const sourceIds = [...new Set([...h.content.items, ...h.content.questions].flatMap((i) => i.sourceIds))].sort();

  const reviewed = final.status !== "draft";
  const payload: HandoffPayload | null = reviewed
    ? {
        handoffId: displayId,
        patientRef: fixture.patient.patientRef,
        pseudonym: fixture.patient.pseudonym,
        periodStart,
        periodEnd,
        ...h.content,
        safetyNotes: fixture.observations
          .filter((o) => sourceIds.includes(o.fixtureId))
          .map((o) => ({ sourceId: o.fixtureId, tier: evaluateSafety(o.text).tier }))
          .filter((n): n is { sourceId: string; tier: NonNullable<typeof n.tier> } => n.tier !== null),
        synthetic: true,
        disclaimer: HANDOFF_DISCLAIMER,
      }
    : null;

  const [{ id: handoffId }] = await sql.query<{ id: string }>(
    `insert into handoffs (display_id, case_id, owner_id, status, period_start, period_end, draft, drafted_by,
                           approved_payload, source_ids, origin, synthetic, reviewed_at, submitted_at, created_at, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'seeded', true, $11, $12, $13, $14) returning id`,
    [
      displayId, caseId, ownerId, final.status, periodStart, periodEnd, JSON.stringify(h.content), h.draftedBy,
      payload ? JSON.stringify(payload) : null, JSON.stringify(sourceIds),
      at("reviewed") ? t(at("reviewed")!.at) : null, at("submitted") ? t(at("submitted")!.at) : null,
      t(timeline[0].at), t(final.at),
    ],
  );

  for (const e of timeline) {
    await sql.query(
      `insert into handoff_status_history (handoff_id, case_id, owner_id, status, note, at) values ($1, $2, $3, $4, $5, $6)`,
      [handoffId, caseId, ownerId, e.status, e.note, t(e.at)],
    );
  }

  const received = at("received");
  if (received && payload) {
    const acknowledged = at("acknowledged");
    await sql.query(
      `insert into receiver_records (handoff_id, case_id, owner_id, payload, received_at, acknowledged_at, synthetic)
       values ($1, $2, $3, $4, $5, $6, true)`,
      [handoffId, caseId, ownerId, JSON.stringify(payload), t(received.at), acknowledged ? t(acknowledged.at) : null],
    );
  }

  if (h.receiverResponse) {
    const r = h.receiverResponse;
    await sql.query(
      `insert into receiver_responses (handoff_id, case_id, owner_id, kind, text, label, synthetic, at)
       values ($1, $2, $3, $4, $5, $6, true, $7)`,
      [handoffId, caseId, ownerId, r.kind, r.text, r.label, t(r.at)],
    );
  }
}

// ---------------- Demo accounts and sessions ----------------

/** Local mode only: make sure the three demo users and their profiles exist. Idempotent. */
export async function ensureLocalDemoUsers(db: Database, fixtures: CaseFixture[]): Promise<void> {
  await db.asAdmin(async (sql) => {
    for (const f of fixtures) {
      await sql.query(`insert into auth.users (id, email) values ($1, $2) on conflict (id) do nothing`, [
        f.demoAccount.userId,
        f.demoAccount.email,
      ]);
      await sql.query(
        `insert into profiles (user_id, display_name, username, account_kind) values ($1, $2, $3, 'demo')
         on conflict (user_id) do update set display_name = excluded.display_name, username = excluded.username`,
        [f.demoAccount.userId, f.demoAccount.displayName, f.demoAccount.username],
      );
    }
  });
}

/** Start a fresh, isolated demo copy for one visitor of a shared demo login. */
export async function startDemoSession(
  db: Database,
  demoUserId: string,
  seedKey: string,
  anchor: Date = new Date(),
): Promise<{ demoSessionId: string; caseId: string }> {
  assertUuid(demoUserId, "user id");
  const fixture = seedCase(seedKey);
  if (fixture.demoAccount.userId !== demoUserId) throw new Error("demo account does not match this case");
  return db.asAdmin(async (sql) => {
    const [{ id: demoSessionId }] = await sql.query<{ id: string }>(
      `insert into demo_sessions (owner_id, seed_key) values ($1, $2) returning id`,
      [demoUserId, seedKey],
    );
    const caseId = await materializeSeedCase(sql, fixture, anchor, { ownerId: demoUserId, kind: "demo_copy", demoSessionId });
    return { demoSessionId, caseId };
  });
}

/**
 * Reset the caller's own demo copy to the known seeded state (new anchor).
 * Clears: this copy's notes, alerts and acknowledgements, check-ins, insights, handoffs, receipts.
 * Does not touch any other visitor's copy or any registered user's data.
 */
export async function resetDemoSession(db: Database, principal: Principal, anchor: Date = new Date()): Promise<string> {
  if (!principal.demoSessionId) throw new Error("not a demo session");
  // Ownership check under RLS first: the session must be visible to this principal.
  const session = await db.asPrincipal(principal, (sql) =>
    sql.query<{ seed_key: string }>(`select seed_key from demo_sessions where id = $1 and owner_id = $2`, [
      principal.demoSessionId,
      principal.userId,
    ]),
  );
  if (session.length !== 1) throw new Error("demo session not found");
  const fixture = seedCase(session[0].seed_key);
  return db.asAdmin(async (sql) => {
    await sql.query(`delete from cases where demo_session_id = $1 and owner_id = $2`, [principal.demoSessionId, principal.userId]);
    await sql.query(`update demo_sessions set last_seen_at = now() where id = $1`, [principal.demoSessionId]);
    return materializeSeedCase(sql, fixture, anchor, {
      ownerId: principal.userId,
      kind: "demo_copy",
      demoSessionId: principal.demoSessionId,
    });
  });
}

/** Registered users can start a private case from a demo scenario. */
export async function copySeedToUserCase(
  db: Database,
  principal: Principal,
  seedKey: string,
  anchor: Date = new Date(),
): Promise<string> {
  if (principal.demoSessionId) throw new Error("demo sessions cannot create private cases");
  assertUuid(principal.userId, "user id");
  const fixture = seedCase(seedKey);
  return db.asAdmin((sql) =>
    materializeSeedCase(sql, fixture, anchor, { ownerId: principal.userId, kind: "user", demoSessionId: null }),
  );
}
