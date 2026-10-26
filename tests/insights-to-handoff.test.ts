/**
 * Task 18: carrying an evidence-linked finding from Insights into the open weekly draft.
 * No AI call, no submission, sources limited to the draft's own notes, approval cleared, history recorded.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AiResult } from "@/lib/ai/client";
import type { Database } from "@/lib/db/client";
import { createUserCase } from "@/lib/repo/cases";
import { addFindingToDraft, approveHandoff, createOrRegenerateDraft } from "@/lib/repo/handoff-workflow";
import { listHandoffs } from "@/lib/repo/handoffs";
import { addObservation } from "@/lib/repo/observations";
import { freshDb, registeredUser } from "./helpers/db";

let db: Database;
afterEach(async () => {
  await db?.close();
  db = undefined as unknown as Database;
});

const chat = vi.fn(async (): Promise<AiResult> => ({ ok: false, reason: "unavailable_missing_key", usage: null }));
const noAi = { chat, available: () => false };

describe("add a finding to the weekly draft", () => {
  it("appends to the open draft only, clears approval, records history, never sends, never calls the AI", async () => {
    db = await freshDb();
    const u = await registeredUser(db);
    const c = await createUserCase(db, u, { pseudonym: "Fictional" });
    await addObservation(db, u, { caseId: c.id, text: "Needed help with the stairs" });
    await addObservation(db, u, { caseId: c.id, text: "Needed help with the stairs again" });

    await expect(addFindingToDraft(db, u, c.id, { statement: "x", support: "supported", kind: "recording_activity", sourceIds: ["OBS-0001"] })).rejects.toMatchObject({ code: "not_open" });

    const { handoff } = await createOrRegenerateDraft(db, u, c.id, noAi);
    await approveHandoff(db, u, handoff.id, true);
    chat.mockClear();
    const finding = { statement: "Mobility came up in several notes: 2 observations on 1 day.", support: "supported" as const, kind: "recording_activity" as const, uncertainty: "Counts, not health.", sourceIds: ["OBS-0001", "OBS-0002"] };
    const r = await addFindingToDraft(db, u, c.id, finding);
    expect(r.added).toBe(true);
    expect(r.handoff.status).toBe("draft");
    expect(r.handoff.approvedPayload).toBeNull();
    expect(r.handoff.draft.items.at(-1)).toMatchObject({ statement: finding.statement, kind: "recording_activity", addedFrom: "insights", sourceIds: ["OBS-0001", "OBS-0002"] });
    expect((await addFindingToDraft(db, u, c.id, finding)).added).toBe(false); // no duplicates
    expect(chat).not.toHaveBeenCalled();

    const [b] = await listHandoffs(db, u, c.id);
    expect(b.receipt).toBeNull(); // nothing was sent
    expect(b.history.some((e) => e.event === "edited" && /Finding added from Insights.*approval cleared/.test(e.note ?? ""))).toBe(true);
  });

  it("refuses sources that are not part of the draft (another patient's or another period's notes)", async () => {
    db = await freshDb();
    const u = await registeredUser(db);
    const a = await createUserCase(db, u, { pseudonym: "Patient A" });
    const b = await createUserCase(db, u, { pseudonym: "Patient B" });
    await addObservation(db, u, { caseId: a.id, text: "Walked to the mailbox" });
    await addObservation(db, u, { caseId: b.id, text: "Walked to the mailbox" });
    await addObservation(db, u, { caseId: b.id, text: "Walked to the garden" });
    await createOrRegenerateDraft(db, u, a.id, noAi);
    await expect(
      addFindingToDraft(db, u, a.id, { statement: "Something", support: "supported", kind: "pattern", sourceIds: ["OBS-0002"] }), // exists only in patient B
    ).rejects.toMatchObject({ code: "unknown_source" });
    const other = await registeredUser(db, "Other");
    await expect(addFindingToDraft(db, other, a.id, { statement: "x", support: "supported", kind: "pattern", sourceIds: ["OBS-0001"] })).rejects.toMatchObject({ code: "not_open" });
  });
});
