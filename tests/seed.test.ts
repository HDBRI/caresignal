import { afterEach, describe, expect, it } from "vitest";
import type { Database } from "@/lib/db/client";
import { SEED_CASES } from "@/lib/fixtures";
import { getCase, listBaselines } from "@/lib/repo/cases";
import { listCheckins } from "@/lib/repo/checkins";
import { listHandoffs } from "@/lib/repo/handoffs";
import { listAlerts, listObservations, markAlertSeen } from "@/lib/repo/observations";
import { copySeedToUserCase, resetDemoSession, startDemoSession } from "@/lib/repo/seed";
import { resolveSeedTime } from "@/lib/time";
import { ANCHOR, demoUserId, freshDb, registeredUser } from "./helpers/db";

let db: Database;
afterEach(async () => {
  await db?.close();
  db = undefined as unknown as Database;
});

/** Everything except generated row ids / handoff ids, for determinism comparisons. */
async function snapshot(db: Database, principal: { userId: string; demoSessionId: string | null }, caseId: string) {
  const c = await getCase(db, principal, caseId);
  const obs = await listObservations(db, principal, caseId);
  const handoffs = await listHandoffs(db, principal, caseId);
  return {
    case: { ...c, id: "x", demoSessionId: "x", createdAt: "x" },
    baselines: (await listBaselines(db, principal, caseId)).map(({ id: _id, caseId: _c, ...b }) => b),
    observations: obs.map(({ id: _id, caseId: _c, ...o }) => o),
    checkins: (await listCheckins(db, principal, caseId)).map(({ id: _id, caseId: _c, createdAt: _t, ...ci }) => ci),
    alerts: (await listAlerts(db, principal, caseId)).map(({ id: _id, caseId: _c, observationId: _o, ...a }) => a),
    handoffs: handoffs.map((h) => ({
      status: h.handoff.status,
      draft: h.handoff.draft,
      sourceIds: h.handoff.sourceIds,
      history: h.history.map((e) => [e.status, e.at]),
      receipt: h.receipt ? { receivedAt: h.receipt.receivedAt, acknowledgedAt: h.receipt.acknowledgedAt } : null,
      responses: h.responses.map((r) => [r.text, r.label, r.at]),
    })),
  };
}

describe("seeding demo copies", () => {
  it("materializes every fixture row with synthetic flags and seeded origin", async () => {
    db = await freshDb();
    for (const fixture of SEED_CASES) {
      const uid = demoUserId(fixture.seedKey);
      const { demoSessionId, caseId } = await startDemoSession(db, uid, fixture.seedKey, ANCHOR);
      const p = { userId: uid, demoSessionId };
      const obs = await listObservations(db, p, caseId);
      expect(obs).toHaveLength(fixture.observations.length);
      expect(obs.every((o) => o.synthetic && o.origin === "seeded")).toBe(true);
      expect(obs.map((o) => o.originalText).sort()).toEqual(fixture.observations.map((o) => o.text).sort());
      // Real pre-generated labels (npm run seed:ai) make a note "complete"; otherwise it is honestly "not_run".
      const gen = (await import("@/lib/generated")).generatedFor(fixture.seedKey);
      // Monthly dataset notes carry their own scenario categories, never the AI output generated for the earlier notes.
      for (const o of obs) expect(o.aiState, o.displayId).toBe(!fixture.dataset && gen?.notes[o.displayId] ? "complete" : "not_run");
      const c = await getCase(db, p, caseId);
      expect(c.synthetic).toBe(true);
      expect(c.patientRef).toBe(fixture.patient.patientRef);
      expect((await listCheckins(db, p, caseId)).every((ci) => ci.synthetic)).toBe(true);
      const [h] = await listHandoffs(db, p, caseId);
      expect(h.handoff.synthetic).toBe(true);
      expect(h.handoff.draftedBy).toBe("seed_fixture");
      if (h.receipt) expect(h.receipt.synthetic).toBe(true);
      for (const r of h.responses) expect(r.synthetic).toBe(true);
    }
  });

  it("is deterministic: same fixture + same anchor = identical content and timestamps", async () => {
    db = await freshDb();
    for (const fixture of SEED_CASES) {
      const uid = demoUserId(fixture.seedKey);
      const a = await startDemoSession(db, uid, fixture.seedKey, ANCHOR);
      const b = await startDemoSession(db, uid, fixture.seedKey, ANCHOR);
      const sa = await snapshot(db, { userId: uid, demoSessionId: a.demoSessionId }, a.caseId);
      const sb = await snapshot(db, { userId: uid, demoSessionId: b.demoSessionId }, b.caseId);
      expect(sa).toEqual(sb);
    }
  });

  it("resolves relative dates from the anchor and keeps gaps when the anchor moves", async () => {
    db = await freshDb();
    const f = SEED_CASES[2];
    const uid = demoUserId(f.seedKey);
    const s = await startDemoSession(db, uid, f.seedKey, ANCHOR);
    const p = { userId: uid, demoSessionId: s.demoSessionId };
    const before = await listObservations(db, p, s.caseId);
    for (const o of f.observations) {
      const row = before.find((r) => r.displayId === o.fixtureId)!;
      expect(row.enteredAt).toBe(resolveSeedTime(ANCHOR, o.at));
      expect(row.eventTime).toBe(o.eventTime ? resolveSeedTime(ANCHOR, o.eventTime) : null);
      expect(new Date(row.enteredAt).getTime()).toBeLessThan(ANCHOR.getTime());
    }
    const later = new Date(ANCHOR.getTime() + 9 * 86_400_000);
    await resetDemoSession(db, p, later);
    const [after] = await (await import("@/lib/repo/cases")).listCases(db, p);
    const afterObs = await listObservations(db, p, after.id);
    const gap = (rows: typeof before, a: string, b: string) =>
      new Date(rows.find((r) => r.displayId === b)!.enteredAt).getTime() - new Date(rows.find((r) => r.displayId === a)!.enteredAt).getTime();
    expect(gap(afterObs, "OBS-C3-01", "OBS-C3-09")).toBe(gap(before, "OBS-C3-01", "OBS-C3-09"));
    expect(new Date(afterObs[0].enteredAt).getTime() - new Date(before[0].enteredAt).getTime()).toBe(9 * 86_400_000);
  });

  it("the week view is populated for every case (notes in the last 7 days of the anchor)", async () => {
    db = await freshDb();
    for (const f of SEED_CASES) {
      const uid = demoUserId(f.seedKey);
      const s = await startDemoSession(db, uid, f.seedKey, ANCHOR);
      const obs = await listObservations(db, { userId: uid, demoSessionId: s.demoSessionId }, s.caseId);
      const weekAgo = ANCHOR.getTime() - 8 * 86_400_000;
      expect(obs.filter((o) => new Date(o.enteredAt).getTime() > weekAgo).length).toBeGreaterThanOrEqual(5);
    }
  });

  it("seeds the expected dashboard state for each case", async () => {
    db = await freshDb();
    const states: Record<string, unknown> = {};
    for (const f of SEED_CASES) {
      const uid = demoUserId(f.seedKey);
      const s = await startDemoSession(db, uid, f.seedKey, ANCHOR);
      const p = { userId: uid, demoSessionId: s.demoSessionId };
      const [h] = await listHandoffs(db, p, s.caseId);
      const alerts = await listAlerts(db, p, s.caseId);
      states[f.seedKey] = {
        handoff: h.handoff.status,
        hasReceipt: Boolean(h.receipt),
        responses: h.responses.length,
        alertTiers: alerts.map((a) => a.tier).sort(),
      };
    }
    expect(states).toEqual({
      "PAT-CANCER-001": { handoff: "acknowledged", hasReceipt: true, responses: 1, alertTiers: [] },
      "PAT-SURGERY-002": { handoff: "draft", hasReceipt: false, responses: 0, alertTiers: ["emergency", "review"] },
      "PAT-RECOVERY-003": { handoff: "reviewed", hasReceipt: false, responses: 0, alertTiers: [] },
    });
  });

  it("Case 2 urgent alert is stored as an unseen, flagged test-scenario emergency", async () => {
    db = await freshDb();
    const uid = demoUserId("PAT-SURGERY-002");
    const s = await startDemoSession(db, uid, "PAT-SURGERY-002", ANCHOR);
    const alerts = await listAlerts(db, { userId: uid, demoSessionId: s.demoSessionId }, s.caseId, { unseenOnly: true });
    const emergency = alerts.find((a) => a.tier === "emergency")!;
    expect(emergency.isTestScenario).toBe(true);
    expect(emergency.ruleIds.sort()).toEqual(["EMG-HARD-TO-WAKE", "REV-CONFUSION"]);
    expect(emergency.seenAt).toBeNull();
  });

  it("reset restores the known state after a visitor changes things", async () => {
    db = await freshDb();
    const uid = demoUserId("PAT-SURGERY-002");
    const s = await startDemoSession(db, uid, "PAT-SURGERY-002", ANCHOR);
    const p = { userId: uid, demoSessionId: s.demoSessionId };
    const original = await snapshot(db, p, s.caseId);
    const [alert] = await listAlerts(db, p, s.caseId, { unseenOnly: true });
    await markAlertSeen(db, p, alert.id);
    const { addObservation } = await import("@/lib/repo/observations");
    await addObservation(db, p, { caseId: s.caseId, text: "Visitor note" });
    const newCaseId = await resetDemoSession(db, p, ANCHOR);
    expect(await snapshot(db, p, newCaseId)).toEqual(original);
  });

  it("registered users can start a private copy of a demo scenario", async () => {
    db = await freshDb();
    const user = await registeredUser(db);
    const caseId = await copySeedToUserCase(db, user, "PAT-RECOVERY-003", ANCHOR);
    const c = await getCase(db, user, caseId);
    expect(c.kind).toBe("user");
    expect(c.ownerId).toBe(user.userId);
    expect(await listObservations(db, user, caseId)).toHaveLength(SEED_CASES[2].observations.length);
  });
});
