/**
 * Task 13: weekly handoff drafts — empty weeks, source traceability, review-before-submit, version preservation,
 * urgent-event handling, uncertainty/conflict retention, and the fictional receiver response.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AiResult } from "@/lib/ai/client";
import { NO_OBSERVATIONS } from "@/lib/ai/handoff";
import type { Database, Principal } from "@/lib/db/client";
import { SEED_CASES } from "@/lib/fixtures";
import { createUserCase } from "@/lib/repo/cases";
import {
  acknowledgeHandoff,
  addFictionalResponse,
  approveHandoff,
  createOrRegenerateDraft,
  editDraft,
  HandoffError,
  submitHandoff,
} from "@/lib/repo/handoff-workflow";
import { listHandoffs } from "@/lib/repo/handoffs";
import { addObservation, listAlerts, listObservations } from "@/lib/repo/observations";
import { startDemoSession } from "@/lib/repo/seed";
import { freshDb, registeredUser } from "./helpers/db";

let db: Database;
afterEach(async () => {
  await db?.close();
  db = undefined as unknown as Database;
});

const noAi = { chat: vi.fn(async (): Promise<AiResult> => ({ ok: false, reason: "unavailable_missing_key", usage: null })), available: () => false };
const timeoutAi = () => ({ chat: vi.fn(async (): Promise<AiResult> => ({ ok: false, reason: "failed_timeout", usage: null })), available: () => true });

async function demo(seedKey: string): Promise<{ p: Principal; caseId: string }> {
  db = await freshDb();
  const f = SEED_CASES.find((c) => c.seedKey === seedKey)!;
  const s = await startDemoSession(db, f.demoAccount.userId, f.seedKey);
  return { p: { userId: f.demoAccount.userId, demoSessionId: s.demoSessionId }, caseId: s.caseId };
}

const receiptCount = async (p: Principal, caseId: string) => (await listHandoffs(db, p, caseId)).filter((h) => h.receipt).length;
const err = (code: string) => expect.objectContaining({ code }) as unknown as HandoffError;

describe("empty week", () => {
  it('says "No observations were logged for this period." — no AI call, no reassurance', async () => {
    db = await freshDb();
    const u = await registeredUser(db);
    const c = await createUserCase(db, u, { pseudonym: "Fictional" });
    const deps = timeoutAi();
    const { handoff } = await createOrRegenerateDraft(db, u, c.id, deps);
    expect(handoff.draft.summary).toBe(NO_OBSERVATIONS);
    expect(handoff.draft.items).toEqual([]);
    expect(deps.chat).not.toHaveBeenCalled();
    expect(JSON.stringify(handoff.draft)).not.toMatch(/doing well|is fine|stable|safe|low risk/i);
    expect(handoff.status).toBe("draft");
  });
});

describe("source traceability (Case 1 — supported pattern + questions)", () => {
  it("every statement and question cites notes from this case and period; the validated AI run is reused offline", async () => {
    const { p, caseId } = await demo("PAT-CANCER-001");
    const { status, handoff } = await createOrRegenerateDraft(db, p, caseId, noAi);
    expect(status).toBe("created"); // the seeded v1 was submitted; new notes arrived after it, so v2 is allowed
    expect(handoff.version).toBe(2);
    expect(handoff.draftedBy).toBe("ai");
    expect(handoff.generation.reusedRun).toBe(true);
    const caseIds = new Set((await listObservations(db, p, caseId)).map((o) => o.displayId));
    const cited = [...handoff.draft.items.flatMap((i) => i.sourceIds), ...handoff.draft.questions.flatMap((q) => q.sourceIds)];
    expect(cited.length).toBeGreaterThan(0);
    for (const id of cited) {
      expect(caseIds.has(id)).toBe(true);
      expect(handoff.sourceIds).toContain(id);
    }
    expect(handoff.draft.items.some((i) => i.kind === "pattern" && i.support === "supported" && i.sourceIds.length >= 2)).toBe(true);
    expect(handoff.draft.questions.length).toBeGreaterThan(0);
    expect(handoff.draft.categories!.flatMap((g) => g.sourceIds).sort()).toEqual(expect.arrayContaining(handoff.sourceIds));
    expect(JSON.stringify(handoff.draft)).not.toMatch(/\b\d+\s?mg\b|reduce the dose|stop (?:the )?medication|diagnos/i);
  });

  it("a fabricated source reference is rejected at submit — nothing is received", async () => {
    const { p, caseId } = await demo("PAT-CANCER-001");
    const { handoff } = await createOrRegenerateDraft(db, p, caseId, noAi);
    const approved = await approveHandoff(db, p, handoff.id, true);
    const forged = { ...approved.approvedPayload!, items: [{ statement: "Invented", support: "supported", sourceIds: ["OBS-C9-99"] }] };
    await db.asAdmin((sql) => sql.query(`update handoffs set approved_payload = $1 where id = $2`, [JSON.stringify(forged), handoff.id]));
    await expect(submitHandoff(db, p, handoff.id, "key-forged-0001")).rejects.toEqual(err("unknown_source"));
    const after = (await listHandoffs(db, p, caseId)).find((h) => h.handoff.id === handoff.id)!;
    expect(after.handoff.status).toBe("reviewed");
    expect(after.receipt).toBeNull();
  });
});

describe("review before submit; never auto-sent", () => {
  it("draft -> reviewed -> submitted -> received, with a history row for each step and one receipt", async () => {
    db = await freshDb();
    const u = await registeredUser(db);
    const c = await createUserCase(db, u, { pseudonym: "Fictional" });
    await addObservation(db, u, { caseId: c.id, text: "Walked to the mailbox and back" });
    const { handoff } = await createOrRegenerateDraft(db, u, c.id, noAi);
    expect(await receiptCount(u, c.id)).toBe(0); // drafting never sends

    await expect(submitHandoff(db, u, handoff.id, "key-draft-00001")).rejects.toEqual(err("not_reviewed"));
    await expect(approveHandoff(db, u, handoff.id, false)).rejects.toEqual(err("not_confirmed"));
    expect(await receiptCount(u, c.id)).toBe(0);

    const approved = await approveHandoff(db, u, handoff.id, true);
    expect(approved.status).toBe("reviewed");
    expect(approved.approvedPayload!.synthetic).toBe(true);
    expect(await receiptCount(u, c.id)).toBe(0); // approving doesn't send either

    const first = await submitHandoff(db, u, handoff.id, "key-submit-0001");
    expect(first.handoff.status).toBe("received");
    expect(first.receipt.payload).toEqual(approved.approvedPayload);
    const again = await submitHandoff(db, u, handoff.id, "key-submit-0001"); // retry with same key
    expect(again.duplicate).toBe(true);
    expect(again.receipt.id).toBe(first.receipt.id);
    await expect(submitHandoff(db, u, handoff.id, "key-other-00001")).rejects.toEqual(err("not_reviewed"));
    expect(await receiptCount(u, c.id)).toBe(1);

    await acknowledgeHandoff(db, u, handoff.id);
    const [b] = await listHandoffs(db, u, c.id);
    expect(b.history.filter((e) => e.event === "status").map((e) => e.status)).toEqual(["draft", "reviewed", "submitted", "received", "acknowledged"]);
    expect(b.receipt!.acknowledgedAt).not.toBeNull();
  });

  it("edits keep sources, are recorded, and editing an approved handoff sends it back to draft", async () => {
    db = await freshDb();
    const u = await registeredUser(db);
    const c = await createUserCase(db, u, { pseudonym: "Fictional" });
    await addObservation(db, u, { caseId: c.id, text: "Ate half of dinner" });
    await addObservation(db, u, { caseId: c.id, text: "Slept most of the afternoon" });
    const { handoff } = await createOrRegenerateDraft(db, u, c.id, noAi);
    await approveHandoff(db, u, handoff.id, true);
    const edited = await editDraft(db, u, handoff.id, {
      summary: "My own summary for the care team.",
      items: [{ statement: handoff.draft.items[0].statement, remove: false }, { statement: "", remove: true }],
      questions: [],
      newQuestions: ["Should we keep a food diary?"],
      missingInfo: ["Weight was not measured."],
    });
    expect(edited.status).toBe("draft");
    expect(edited.approvedPayload).toBeNull();
    expect(edited.draft.summary).toBe("My own summary for the care team.");
    expect(edited.draft.items).toHaveLength(1);
    expect(edited.draft.items[0].sourceIds).toEqual(handoff.draft.items[0].sourceIds);
    expect(edited.draft.questions).toEqual([{ text: "Should we keep a food diary?", sourceIds: [] }]);
    expect(edited.generatedContent!.summary).toBe(handoff.draft.summary); // the generated version is kept for comparison
    await expect(editDraft(db, u, handoff.id, { summary: "x", items: [], questions: [], newQuestions: [], missingInfo: [] })).rejects.toEqual(err("bad_edit"));
    const [b] = await listHandoffs(db, u, c.id);
    expect(b.history.some((e) => e.event === "edited" && /approval cleared/.test(e.note ?? ""))).toBe(true);
  });
});

describe("version preservation", () => {
  it("a submitted version is frozen; new information makes a new version; no change -> no new draft", async () => {
    db = await freshDb();
    const u = await registeredUser(db);
    const c = await createUserCase(db, u, { pseudonym: "Fictional" });
    await addObservation(db, u, { caseId: c.id, text: "Needed help with the stairs" });
    const v1 = (await createOrRegenerateDraft(db, u, c.id, noAi)).handoff;
    await approveHandoff(db, u, v1.id, true);
    const { receipt } = await submitHandoff(db, u, v1.id, "key-version-001");

    expect((await createOrRegenerateDraft(db, u, c.id, noAi)).status).toBe("unchanged");
    await expect(editDraft(db, u, v1.id, { summary: "changed", items: [{ statement: "x", remove: false }], questions: [], newQuestions: [], missingInfo: [] })).rejects.toEqual(err("not_open"));

    await new Promise((r) => setTimeout(r, 5));
    await addObservation(db, u, { caseId: c.id, text: "Needed help with the stairs again" });
    const v2 = await createOrRegenerateDraft(db, u, c.id, noAi);
    expect(v2.status).toBe("created");
    expect(v2.handoff.version).toBe(2);
    expect(v2.handoff.id).not.toBe(v1.id);

    const all = await listHandoffs(db, u, c.id);
    const old = all.find((h) => h.handoff.id === v1.id)!;
    expect(old.handoff.status).toBe("received");
    expect(old.receipt!.id).toBe(receipt.id);
    expect(old.receipt!.payload.items).toHaveLength(1); // v1 payload unchanged
    expect(v2.handoff.draft.items).toHaveLength(2);

    const regen = await createOrRegenerateDraft(db, u, c.id, noAi); // the open v2 is regenerated in place
    expect(regen.status).toBe("regenerated");
    expect(regen.handoff.id).toBe(v2.handoff.id);
    expect((await listHandoffs(db, u, c.id)).length).toBe(2);
  });
});

describe("urgent events are not deferred to the weekly handoff", () => {
  it("Case 2: the emergency alert exists before any handoff; the draft lists it and the payload carries it", async () => {
    const { p, caseId } = await demo("PAT-SURGERY-002");
    const alerts = await listAlerts(db, p, caseId, { unseenOnly: true });
    expect(alerts.some((a) => a.tier === "emergency")).toBe(true); // guidance is already showing, no handoff needed
    const { handoff } = await createOrRegenerateDraft(db, p, caseId, noAi);
    expect(handoff.draft.urgent).toEqual(expect.arrayContaining([expect.objectContaining({ sourceId: "OBS-C2-08", tier: "emergency", seenAt: null })]));
    const approved = await approveHandoff(db, p, handoff.id, true);
    expect(approved.approvedPayload!.safetyNotes).toContainEqual({ sourceId: "OBS-C2-08", tier: "emergency" });
  });

  it("a new urgent note alerts immediately on save, whether or not a handoff draft exists", async () => {
    db = await freshDb();
    const u = await registeredUser(db);
    const c = await createUserCase(db, u, { pseudonym: "Fictional" });
    const { handoff } = await createOrRegenerateDraft(db, u, c.id, noAi);
    const saved = await addObservation(db, u, { caseId: c.id, text: "He is hard to wake and breathing is difficult" });
    expect(saved.alert?.tier).toBe("emergency");
    const [b] = await listHandoffs(db, u, c.id);
    expect(b.handoff.id).toBe(handoff.id);
    expect(b.handoff.draft.summary).toBe(NO_OBSERVATIONS); // the old draft did not "absorb" the urgent note
  });
});

describe("uncertainty and conflicting reports are kept", () => {
  it("Case 3: the contradictory meal reports stay as a conflict with both sources, plus what is unknown", async () => {
    const { p, caseId } = await demo("PAT-RECOVERY-003");
    const { status, handoff } = await createOrRegenerateDraft(db, p, caseId, noAi);
    expect(status).toBe("regenerated"); // the seeded reviewed draft is the open one
    const conflict = handoff.draft.items.find((i) => i.support === "conflicting")!;
    expect(conflict.kind).toBe("conflict");
    expect(conflict.sourceIds.sort()).toEqual(["OBS-C3-06", "OBS-C3-07"]);
    expect(conflict.uncertainty).toMatch(/unclear/i);
    expect(handoff.draft.missingInfo.some((m) => /OBS-C3-07|dinner/i.test(m))).toBe(true);
    const [b] = await listHandoffs(db, p, caseId);
    expect(b.history.some((e) => e.event === "regenerated" && /approval was cleared/.test(e.note ?? ""))).toBe(true);
  });

  it("without AI, conflicting notes are both listed exactly as written and the draft says nothing was analyzed", async () => {
    db = await freshDb();
    const u = await registeredUser(db);
    const c = await createUserCase(db, u, { pseudonym: "Fictional" });
    await addObservation(db, u, { caseId: c.id, text: "Ate a full plate of pasta at dinner", authorLabel: "Sam" });
    await addObservation(db, u, { caseId: c.id, text: "Barely touched dinner", authorLabel: "Lee" });
    const deps = timeoutAi();
    const { handoff } = await createOrRegenerateDraft(db, u, c.id, deps);
    expect(deps.chat).toHaveBeenCalledTimes(1);
    expect(handoff.draftedBy).toBe("records");
    expect(handoff.generation.aiStatus).toBe("failed");
    expect(handoff.draft.items.map((i) => i.statement)).toEqual(
      expect.arrayContaining(["Caregiver reported: “Ate a full plate of pasta at dinner”", "Caregiver reported: “Barely touched dinner”"]),
    );
    expect(handoff.draft.missingInfo.join(" ")).toMatch(/conflicting reports were not analyzed/i);
  });
});

describe("simulated receiver response (Case 1 only, labeled fictional)", () => {
  it("can be added after the handoff is received, and is labeled as a simulated scenario outcome", async () => {
    const { p, caseId } = await demo("PAT-CANCER-001");
    const { handoff } = await createOrRegenerateDraft(db, p, caseId, noAi);
    await expect(addFictionalResponse(db, p, handoff.id)).rejects.toEqual(err("not_received"));
    await approveHandoff(db, p, handoff.id, true);
    await submitHandoff(db, p, handoff.id, "key-response-01");
    await addFictionalResponse(db, p, handoff.id);
    await addFictionalResponse(db, p, handoff.id); // second click does nothing
    const b = (await listHandoffs(db, p, caseId)).find((h) => h.handoff.id === handoff.id)!;
    expect(b.responses).toHaveLength(1);
    expect(b.responses[0].label).toMatch(/^Simulated scenario outcome — not an AI recommendation or a real clinical event\.$/);
    expect(b.handoff.status).toBe("received"); // a response does not change the status
  });

  it("is not offered for the recovery case", async () => {
    const { p, caseId } = await demo("PAT-RECOVERY-003");
    const { handoff } = await createOrRegenerateDraft(db, p, caseId, noAi);
    await approveHandoff(db, p, handoff.id, true);
    await submitHandoff(db, p, handoff.id, "key-response-03");
    await expect(addFictionalResponse(db, p, handoff.id)).rejects.toEqual(err("no_response"));
  });
});
