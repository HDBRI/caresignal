import { afterEach, describe, expect, it } from "vitest";
import type { Database } from "@/lib/db/client";
import { createUserCase } from "@/lib/repo/cases";
import { checkinGrid, listCheckins, upsertCheckin } from "@/lib/repo/checkins";
import {
  addObservation,
  addObservationEdit,
  getObservationByDisplayId,
  listObservations,
  setAiState,
} from "@/lib/repo/observations";
import { freshDb, registeredUser } from "./helpers/db";

let db: Database;
afterEach(async () => {
  await db?.close();
  db = undefined as unknown as Database;
});

async function setup() {
  db = await freshDb();
  const user = await registeredUser(db);
  const c = await createUserCase(db, user, { pseudonym: "Fictional Person" });
  return { user, caseId: c.id };
}

describe("observations", () => {
  it("stores the original text exactly as entered (whitespace, punctuation, emoji)", async () => {
    const { user, caseId } = await setup();
    const text = "  Ate half a sandwich —  \"tastes odd\" 🙁\nSecond line  ";
    const { observation } = await addObservation(db, user, { caseId, text });
    expect(observation.originalText).toBe(text);
    expect(observation.displayId).toBe("OBS-0001");
    expect(observation.origin).toBe("session");
  });

  it("refuses to overwrite the original; edits become new versions", async () => {
    const { user, caseId } = await setup();
    const { observation } = await addObservation(db, user, { caseId, text: "Original wording" });
    await expect(
      db.asPrincipal(user, (sql) => sql.query(`update observations set original_text = 'changed' where id = $1`, [observation.id])),
    ).rejects.toThrow(/immutable/);
    const e = await addObservationEdit(db, user, observation.id, "Corrected wording");
    expect(e.version).toBe(2);
    const detail = await getObservationByDisplayId(db, user, caseId, "OBS-0001");
    expect(detail.observation.originalText).toBe("Original wording");
    expect(detail.edits.map((x) => x.editedText)).toEqual(["Corrected wording"]);
  });

  it("AI state can change without touching the original", async () => {
    const { user, caseId } = await setup();
    const { observation } = await addObservation(db, user, { caseId, text: "Note" });
    await setAiState(db, user, observation.id, "unavailable_limit");
    const [o] = await listObservations(db, user, caseId);
    expect(o.aiState).toBe("unavailable_limit");
    expect(o.originalText).toBe("Note");
  });

  it("leaves event time empty when not provided, and stores it exactly when given", async () => {
    const { user, caseId } = await setup();
    const a = await addObservation(db, user, { caseId, text: "No time given" });
    expect(a.observation.eventTime).toBeNull();
    const b = await addObservation(db, user, { caseId, text: "With time", eventTime: "2026-10-20T13:15:00.000Z" });
    expect(b.observation.eventTime).toBe("2026-10-20T13:15:00.000Z");
    expect(b.observation.enteredAt).not.toBe(b.observation.eventTime);
  });

  it("runs safety rules on save and stores an emergency alert — with no AI key", async () => {
    const saved = process.env.PORTKEY_API_KEY;
    delete process.env.PORTKEY_API_KEY;
    const { user, caseId } = await setup();
    const r = await addObservation(db, user, { caseId, text: "She's hard to wake and breathing is difficult" });
    expect(r.safety.tier).toBe("emergency");
    expect(r.observation.safetyTier).toBe("emergency");
    expect(r.alert?.tier).toBe("emergency");
    expect(r.alert?.seenAt).toBeNull();
    if (saved !== undefined) process.env.PORTKEY_API_KEY = saved;
  });

  it("note entry is unlimited (50 in a row all save)", async () => {
    const { user, caseId } = await setup();
    for (let i = 0; i < 50; i++) await addObservation(db, user, { caseId, text: `Note ${i}` });
    const all = await listObservations(db, user, caseId);
    expect(all).toHaveLength(50);
    expect(new Set(all.map((o) => o.displayId)).size).toBe(50);
  });

  it("rejects empty notes, oversize notes, and future event times", async () => {
    const { user, caseId } = await setup();
    await expect(addObservation(db, user, { caseId, text: "   " })).rejects.toThrow();
    await expect(addObservation(db, user, { caseId, text: "x".repeat(4001) })).rejects.toThrow();
    const future = new Date(Date.now() + 86_400_000).toISOString();
    await expect(addObservation(db, user, { caseId, text: "x", eventTime: future })).rejects.toThrow();
  });
});

describe("check-ins", () => {
  it("missing days and unanswered categories are not_reported, never fine", async () => {
    const { user, caseId } = await setup();
    await upsertCheckin(db, user, {
      caseId,
      day: "2026-10-18",
      status: "concern",
      note: "Worried about fluids",
      responses: { eating_drinking: { state: "answered", value: "Less than usual" }, mood_cognition: { state: "skipped" } },
    });
    const grid = checkinGrid(await listCheckins(db, user, caseId), "2026-10-17", "2026-10-19");
    expect(grid.map((g) => g.day)).toEqual(["2026-10-17", "2026-10-18", "2026-10-19"]);
    expect(Object.values(grid[0].states).every((s) => s === "not_reported")).toBe(true);
    expect(grid[1].states).toEqual({
      eating_drinking: "answered",
      energy_sleep: "not_reported",
      mobility_function: "not_reported",
      mood_cognition: "skipped",
    });
  });
});
