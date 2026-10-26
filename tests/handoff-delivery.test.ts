/**
 * Task 14 integration tests: POST /api/handoffs request handling against a real Postgres (PGlite) database —
 * successful submission, invalid payload, persistence after reload/restart, duplicate retry, Failed status,
 * explicit acknowledgement, and exact submitted-payload retention.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AiResult } from "@/lib/ai/client";
import { createDatabase, type Database, type Principal } from "@/lib/db/client";
import { migrate } from "@/lib/db/migrate";
import { SEED_CASES } from "@/lib/fixtures";
import { createUserCase } from "@/lib/repo/cases";
import { handleSubmitRequest } from "@/lib/repo/handoff-api";
import { acknowledgeHandoff, approveHandoff, createOrRegenerateDraft, editDraft, getHandoffByDisplayId } from "@/lib/repo/handoff-workflow";
import { listHandoffs } from "@/lib/repo/handoffs";
import { addObservation, listAlerts } from "@/lib/repo/observations";
import { ensureLocalDemoUsers } from "@/lib/repo/seed";
import { freshDb, registeredUser } from "./helpers/db";

let db: Database;
afterEach(async () => {
  await db?.close();
  db = undefined as unknown as Database;
});

const noAi = { chat: vi.fn(async (): Promise<AiResult> => ({ ok: false, reason: "unavailable_missing_key", usage: null })), available: () => false };
const key = () => `key-${randomUUID()}`;

/** A registered user's case with one approved (reviewed) handoff. */
async function approvedHandoff(u: Principal, text = "Needed help getting out of the chair") {
  const c = await createUserCase(db, u, { pseudonym: "Fictional" });
  await addObservation(db, u, { caseId: c.id, text });
  const { handoff } = await createOrRegenerateDraft(db, u, c.id, noAi);
  const approved = await approveHandoff(db, u, handoff.id, true);
  return { caseId: c.id, handoff: approved };
}

const receiptRows = (caseId: string) =>
  db.asAdmin((sql) => sql.query<{ n: number }>(`select count(*)::int as n from receiver_records where case_id = $1`, [caseId])).then((r) => Number(r[0].n));

describe("POST /api/handoffs", () => {
  it("successful submission: 201 with a receipt (server handoff ID, received timestamp, status) only after it is persisted", async () => {
    db = await freshDb();
    const u = await registeredUser(db);
    const { caseId, handoff } = await approvedHandoff(u);
    expect(handoff.displayId).toMatch(/^HO-[A-Z0-9]{8}$/); // generated on the server

    const res = await handleSubmitRequest(db, u, { caseId, handoffId: handoff.displayId, idempotencyKey: key() });
    expect(res.status).toBe(201);
    const r = res.body.receipt!;
    expect(r).toMatchObject({ handoffId: handoff.displayId, status: "received", simulated: true, version: 1 });
    expect(r.receiptId).toMatch(/^RC-[A-Z0-9]{10}$/);
    expect(Number.isNaN(Date.parse(r.receivedAt))).toBe(false);
    expect(r.message).toMatch(/No real care team was contacted/);

    const [b] = await listHandoffs(db, u, caseId);
    expect(b.handoff.status).toBe("received");
    expect(b.receipt!.receivedAt).toBe(r.receivedAt);
    expect(b.history.filter((e) => e.event === "status").map((e) => e.status)).toEqual(["draft", "reviewed", "submitted", "received"]);
  });

  it("invalid requests and invalid payloads are rejected with nothing received and nothing changed", async () => {
    db = await freshDb();
    const u = await registeredUser(db);
    const { caseId, handoff } = await approvedHandoff(u);

    expect((await handleSubmitRequest(db, u, { caseId, handoffId: handoff.displayId })).status).toBe(400); // no key
    expect((await handleSubmitRequest(db, u, { caseId, handoffId: "HO-NOTREAL1", idempotencyKey: key() })).status).toBe(404);
    expect((await handleSubmitRequest(db, u, { caseId, handoffId: handoff.displayId, idempotencyKey: key(), payload: {} })).status).toBe(400); // client can't send a payload

    // A tampered snapshot (no longer matches what the caregiver approved) -> 422.
    await db.asAdmin((sql) =>
      sql.query(`update handoffs set approved_payload_text = replace(approved_payload_text, 'Fictional', 'Someone else') where id = $1`, [handoff.id]),
    );
    const tampered = await handleSubmitRequest(db, u, { caseId, handoffId: handoff.displayId, idempotencyKey: key() });
    expect(tampered.status).toBe(422);
    expect(tampered.body.error).toBe("invalid_payload");
    expect(tampered.body.handoffStatus).toBe("reviewed");
    expect(await receiptRows(caseId)).toBe(0);
  });

  it("rejects a payload citing an observation that belongs to a different patient", async () => {
    db = await freshDb();
    const u = await registeredUser(db);
    const other = await createUserCase(db, u, { pseudonym: "Other patient" });
    const { observation: foreign } = await addObservation(db, u, { caseId: other.id, text: "A note about someone else" });
    const { caseId, handoff } = await approvedHandoff(u);
    expect(foreign.displayId).toBe(handoff.approvedPayload!.items[0].sourceIds[0]); // same ID text (OBS-0001), different patient
    // Point the payload at a source ID that does not exist for THIS patient.
    const forged = { ...handoff.approvedPayload!, items: [{ statement: "x", support: "supported", sourceIds: ["OBS-0002"] }] };
    await db.asAdmin((sql) => sql.query(`update handoffs set approved_payload = $1, approved_payload_text = null where id = $2`, [JSON.stringify(forged), handoff.id]));
    const res = await handleSubmitRequest(db, u, { caseId, handoffId: handoff.displayId, idempotencyKey: key() });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe("unknown_source");
    expect(await receiptRows(caseId)).toBe(0);
  });

  it("another user can't submit someone else's handoff", async () => {
    db = await freshDb();
    const u = await registeredUser(db);
    const intruder = await registeredUser(db, "Intruder");
    const { caseId, handoff } = await approvedHandoff(u);
    const res = await handleSubmitRequest(db, intruder, { caseId, handoffId: handoff.displayId, idempotencyKey: key() });
    expect(res.status).toBe(404); // not "forbidden": other users' handoffs don't exist for them
    expect(await receiptRows(caseId)).toBe(0);
  });

  it("duplicate retry with the same key returns the original receipt; a different key can't create a second one", async () => {
    db = await freshDb();
    const u = await registeredUser(db);
    const { caseId, handoff } = await approvedHandoff(u);
    const k = key();
    const body = { caseId, handoffId: handoff.displayId, idempotencyKey: k };
    const [a, b] = await Promise.all([handleSubmitRequest(db, u, body), handleSubmitRequest(db, u, body)]); // double click
    const again = await handleSubmitRequest(db, u, body); // retry after a lost response
    const ids = [a, b, again].filter((x) => x.body.receipt).map((x) => x.body.receipt!.receiptId);
    expect(new Set(ids).size).toBe(1);
    expect(again.status).toBe(200);
    expect(again.body.duplicate).toBe(true);
    const other = await handleSubmitRequest(db, u, { ...body, idempotencyKey: key() });
    expect(other.status).toBe(409);
    expect(other.body.error).toBe("already_received");
    expect(await receiptRows(caseId)).toBe(1);
  });

  it("failure status: a failed delivery is marked Failed (never Received), nothing is saved, and a retry succeeds", async () => {
    db = await freshDb();
    const u = await registeredUser(db);
    const { caseId, handoff } = await approvedHandoff(u, "He can't catch his breath right now");
    const k = key();
    const fail = await handleSubmitRequest(db, u, { caseId, handoffId: handoff.displayId, idempotencyKey: k, simulateFailure: true });
    expect(fail.status).toBe(502);
    expect(fail.body.handoffStatus).toBe("failed");
    expect(fail.body.receipt).toBeUndefined();
    expect(await receiptRows(caseId)).toBe(0);
    const failed = await getHandoffByDisplayId(db, u, caseId, handoff.displayId);
    expect(failed.status).toBe("failed");
    expect(failed.lastError).toMatch(/Simulated receiver unavailable/);

    // Urgent guidance is independent of delivery: the emergency alert is there regardless.
    expect((await listAlerts(db, u, caseId, { unseenOnly: true }))[0].tier).toBe("emergency");

    const ok = await handleSubmitRequest(db, u, { caseId, handoffId: handoff.displayId, idempotencyKey: k });
    expect(ok.status).toBe(201);
    const [b] = await listHandoffs(db, u, caseId);
    expect(b.handoff.submitAttempts).toBe(2);
    expect(b.history.filter((e) => e.event === "status").map((e) => e.status)).toEqual(["draft", "reviewed", "submitted", "failed", "submitted", "received"]);
  });

  it("acknowledgement is a separate explicit action — submitting never acknowledges", async () => {
    db = await freshDb();
    const u = await registeredUser(db);
    const { caseId, handoff } = await approvedHandoff(u);
    await expect(acknowledgeHandoff(db, u, handoff.id)).rejects.toMatchObject({ code: "not_received" }); // not before receipt
    await handleSubmitRequest(db, u, { caseId, handoffId: handoff.displayId, idempotencyKey: key() });
    let [b] = await listHandoffs(db, u, caseId);
    expect(b.handoff.status).toBe("received");
    expect(b.receipt!.acknowledgedAt).toBeNull();
    await acknowledgeHandoff(db, u, handoff.id);
    [b] = await listHandoffs(db, u, caseId);
    expect(b.handoff.status).toBe("acknowledged");
    expect(b.receipt!.acknowledgedAt).not.toBeNull();
    expect(b.history.at(-1)!.note).toMatch(/no clinician acted/);
  });

  it("exact payload retention: the receipt holds the approved text byte for byte; later versions don't change it", async () => {
    db = await freshDb();
    const u = await registeredUser(db);
    const { caseId, handoff } = await approvedHandoff(u);
    const res = await handleSubmitRequest(db, u, { caseId, handoffId: handoff.displayId, idempotencyKey: key() });
    let [b] = await listHandoffs(db, u, caseId);
    expect(b.receipt!.payloadText).toBe(handoff.approvedPayloadText);
    expect(b.receipt!.payloadSha256).toBe(createHash("sha256").update(handoff.approvedPayloadText!).digest("hex"));
    expect(res.body.receipt!.payloadSha256).toBe(handoff.approvedPayloadSha256);

    await new Promise((r) => setTimeout(r, 5));
    await addObservation(db, u, { caseId, text: "Needed help again" });
    const v2 = (await createOrRegenerateDraft(db, u, caseId, noAi)).handoff;
    await editDraft(db, u, v2.id, { summary: "A different summary", items: v2.draft.items.map((i) => ({ statement: i.statement, remove: false })), questions: [], newQuestions: [], missingInfo: [] });
    b = (await listHandoffs(db, u, caseId)).find((x) => x.handoff.id === handoff.id)!;
    expect(b.receipt!.payloadText).toBe(handoff.approvedPayloadText);
    expect(b.handoff.approvedPayloadText).toBe(handoff.approvedPayloadText);
  });
});

describe("persistence after reload / restart", () => {
  it("status, history and receipt survive closing and reopening the database", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cs-handoff-"));
    try {
      db = await createDatabase({ dataDir: dir });
      await migrate(db);
      await ensureLocalDemoUsers(db, SEED_CASES);
      const u = await registeredUser(db);
      const { caseId, handoff } = await approvedHandoff(u);
      const res = await handleSubmitRequest(db, u, { caseId, handoffId: handoff.displayId, idempotencyKey: key() });
      await db.close();

      db = await createDatabase({ dataDir: dir }); // "restart"
      const [b] = await listHandoffs(db, u, caseId);
      expect(b.handoff.status).toBe("received");
      expect(b.receipt!.receiptCode).toBe(res.body.receipt!.receiptId);
      expect(b.history.map((e) => e.status)).toEqual(["draft", "reviewed", "submitted", "received"]);
    } finally {
      await db?.close();
      db = undefined as unknown as Database;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
