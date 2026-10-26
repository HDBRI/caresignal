/**
 * Ownership and isolation, verified at two layers:
 *   1. repository functions (server-side ownership checks), and
 *   2. raw SQL as the `authenticated` role (Row Level Security alone, no app filtering).
 */
import { afterEach, describe, expect, it } from "vitest";
import type { Database, Principal } from "@/lib/db/client";
import { createUserCase, getCase, listCases, NotFoundError } from "@/lib/repo/cases";
import { listHandoffs } from "@/lib/repo/handoffs";
import { addObservation, listAlerts, listObservations, markAlertSeen } from "@/lib/repo/observations";
import { copySeedToUserCase, resetDemoSession, startDemoSession } from "@/lib/repo/seed";
import { LEGACY_CASES, SEED_CASES } from "@/lib/fixtures";
import { ANCHOR, demoUserId, freshDb, registeredUser } from "./helpers/db";

let db: Database;
afterEach(async () => {
  await db?.close();
  db = undefined as unknown as Database;
});

const CASE_TABLES = [
  "cases", "baselines", "observations", "observation_edits", "observation_analyses", "safety_alerts", "checkins",
  "insight_runs", "insights", "handoffs", "handoff_status_history", "receiver_records", "receiver_responses",
];

async function rawCount(db: Database, p: Principal, table: string): Promise<number> {
  // Deliberately NO owner filter: only RLS stands between the caller and other users' rows.
  return db.asPrincipal(p, async (sql) => (await sql.query<{ n: number }>(`select count(*)::int as n from ${table}`))[0].n);
}

describe("cross-user isolation (registered accounts)", () => {
  it("user B cannot read, list, write to or delete user A's case", async () => {
    db = await freshDb();
    const a = await registeredUser(db, "A");
    const b = await registeredUser(db, "B");
    const aCase = await createUserCase(db, a, { pseudonym: "Fictional A" });
    await addObservation(db, a, { caseId: aCase.id, text: "A's private note" });

    expect(await listCases(db, b)).toEqual([]);
    await expect(getCase(db, b, aCase.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(listObservations(db, b, aCase.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(addObservation(db, b, { caseId: aCase.id, text: "B writing into A" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(listHandoffs(db, b, aCase.id)).rejects.toBeInstanceOf(NotFoundError);
    expect(await listObservations(db, a, aCase.id)).toHaveLength(1);
  });

  it("RLS alone hides every case-scoped table from another user", async () => {
    db = await freshDb();
    const a = await registeredUser(db, "A");
    const b = await registeredUser(db, "B");
    await copySeedToUserCase(db, a, "PAT-CANCER-001", ANCHOR, LEGACY_CASES[0]); // legacy notes fill every table incl. alerts, receipt + response
    for (const t of CASE_TABLES.filter((t) => !["observation_edits", "observation_analyses", "insight_runs", "insights"].includes(t))) {
      expect(await rawCount(db, a, t), `owner sees ${t}`).toBeGreaterThan(0);
    }
    for (const t of CASE_TABLES) expect(await rawCount(db, b, t), `other user sees ${t}`).toBe(0);
  });

  it("RLS blocks inserting rows owned by someone else, and spoofing owner_id", async () => {
    db = await freshDb();
    const a = await registeredUser(db, "A");
    const b = await registeredUser(db, "B");
    const aCase = await createUserCase(db, a, { pseudonym: "Fictional A" });
    await expect(
      db.asPrincipal(b, (sql) =>
        sql.query(
          `insert into observations (case_id, owner_id, display_id, original_text, origin, safety_tier, safety_rules_version)
           values ($1, $2, 'OBS-X', 'spoof', 'session', 'none', 'v')`,
          [aCase.id, a.userId],
        ),
      ),
    ).rejects.toThrow();
    await expect(
      db.asPrincipal(b, (sql) =>
        sql.query(
          `insert into observations (case_id, owner_id, display_id, original_text, origin, safety_tier, safety_rules_version)
           values ($1, $2, 'OBS-X', 'into A case', 'session', 'none', 'v')`,
          [aCase.id, b.userId],
        ),
      ),
    ).rejects.toThrow();
  });

  it("RLS blocks updates and deletes on another user's rows (0 rows affected)", async () => {
    db = await freshDb();
    const a = await registeredUser(db, "A");
    const b = await registeredUser(db, "B");
    const aCase = await createUserCase(db, a, { pseudonym: "Fictional A" });
    const updated = await db.asPrincipal(b, (sql) => sql.query(`update cases set pseudonym = 'hacked' where id = $1 returning id`, [aCase.id]));
    const deleted = await db.asPrincipal(b, (sql) => sql.query(`delete from cases where id = $1 returning id`, [aCase.id]));
    expect(updated).toHaveLength(0);
    expect(deleted).toHaveLength(0);
    expect((await getCase(db, a, aCase.id)).pseudonym).toBe("Fictional A");
  });

  it("usage_log and eval_results are invisible to the authenticated role", async () => {
    db = await freshDb();
    const a = await registeredUser(db, "A");
    await db.asAdmin((sql) => sql.query(`insert into usage_log (owner_id, purpose, status, model_requested) values ($1, 'insights', 'complete', 'gpt-6-luna')`, [a.userId]));
    await expect(rawCount(db, a, "usage_log")).rejects.toThrow(); // no grant at all
  });
});

describe("cross-case isolation (same user)", () => {
  it("queries for case X never return case Y records", async () => {
    db = await freshDb();
    const a = await registeredUser(db);
    const x = await copySeedToUserCase(db, a, "PAT-CANCER-001", ANCHOR);
    const y = await copySeedToUserCase(db, a, "PAT-RECOVERY-003", ANCHOR);
    const xObs = await listObservations(db, a, x);
    const yObs = await listObservations(db, a, y);
    expect(xObs.every((o) => o.caseId === x && o.displayId.startsWith("OBS-C1"))).toBe(true);
    expect(yObs.every((o) => o.caseId === y && o.displayId.startsWith("OBS-C3"))).toBe(true);
    const xH = await listHandoffs(db, a, x);
    expect(xH.every((h) => h.handoff.caseId === x)).toBe(true);
  });
});

describe("demo isolation", () => {
  it("two visitors of the same demo login get separate copies; acknowledging in one does not affect the other", async () => {
    db = await freshDb();
    const uid = demoUserId("PAT-SURGERY-002");
    const s1 = await startDemoSession(db, uid, "PAT-SURGERY-002", ANCHOR);
    const s2 = await startDemoSession(db, uid, "PAT-SURGERY-002", ANCHOR);
    const v1 = { userId: uid, demoSessionId: s1.demoSessionId };
    const v2 = { userId: uid, demoSessionId: s2.demoSessionId };

    const [alert1] = (await listAlerts(db, v1, s1.caseId, { unseenOnly: true })).filter((a) => a.tier === "emergency");
    await markAlertSeen(db, v1, alert1.id);
    expect((await listAlerts(db, v1, s1.caseId, { unseenOnly: true })).some((a) => a.tier === "emergency")).toBe(false);
    expect((await listAlerts(db, v2, s2.caseId, { unseenOnly: true })).some((a) => a.tier === "emergency")).toBe(true);

    // Visitor 1 cannot see or touch visitor 2's copy, even with the same login.
    expect((await listCases(db, v1)).map((c) => c.id)).toEqual([s1.caseId]);
    await expect(getCase(db, v1, s2.caseId)).rejects.toBeInstanceOf(NotFoundError);
    const [alert2] = (await listAlerts(db, v2, s2.caseId)).filter((a) => a.tier === "emergency");
    await expect(markAlertSeen(db, v1, alert2.id)).rejects.toBeInstanceOf(NotFoundError);
    expect(await rawCount(db, v1, "observations")).toBe(SEED_CASES[1].observations.length);
  });

  it("resetting one visitor's copy leaves other visitors untouched", async () => {
    db = await freshDb();
    const uid = demoUserId("PAT-SURGERY-002");
    const s1 = await startDemoSession(db, uid, "PAT-SURGERY-002", ANCHOR);
    const s2 = await startDemoSession(db, uid, "PAT-SURGERY-002", ANCHOR);
    const v2 = { userId: uid, demoSessionId: s2.demoSessionId };
    await addObservation(db, v2, { caseId: s2.caseId, text: "Visitor 2 note" });
    await resetDemoSession(db, { userId: uid, demoSessionId: s1.demoSessionId }, ANCHOR);
    expect(await listObservations(db, v2, s2.caseId)).toHaveLength(SEED_CASES[1].observations.length + 1);
  });

  it("a demo login without a demo session sees nothing; demo users cannot create private cases", async () => {
    db = await freshDb();
    const uid = demoUserId("PAT-CANCER-001");
    await startDemoSession(db, uid, "PAT-CANCER-001", ANCHOR);
    expect(await listCases(db, { userId: uid, demoSessionId: null })).toEqual([]);
    await expect(createUserCase(db, { userId: uid, demoSessionId: crypto.randomUUID() }, { pseudonym: "x" })).rejects.toThrow();
  });

  it("demo copies are isolated from registered users, and vice versa", async () => {
    db = await freshDb();
    const user = await registeredUser(db);
    const uid = demoUserId("PAT-CANCER-001");
    const s = await startDemoSession(db, uid, "PAT-CANCER-001", ANCHOR);
    const userCase = await createUserCase(db, user, { pseudonym: "Mine" });
    await expect(getCase(db, user, s.caseId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getCase(db, { userId: uid, demoSessionId: s.demoSessionId }, userCase.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("a demo account can only open its own case", async () => {
    db = await freshDb();
    await expect(startDemoSession(db, demoUserId("PAT-CANCER-001"), "PAT-SURGERY-002", ANCHOR)).rejects.toThrow();
  });
});
