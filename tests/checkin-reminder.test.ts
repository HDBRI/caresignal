/** Task 11: optional daily check-in states, notes, persistence, missing-response semantics, in-app reminder. */
import { afterEach, describe, expect, it } from "vitest";
import type { Database } from "@/lib/db/client";
import { buildInsightInput } from "@/lib/ai/insights";
import { CHECKIN_STATUSES, NO_RESPONSE_LABEL, checkinStatusLabel } from "@/lib/repo/checkin-labels";
import { checkinGrid, listCheckins, upsertCheckin } from "@/lib/repo/checkins";
import { createUserCase, getCase, setReminder } from "@/lib/repo/cases";
import { addObservation, listObservations } from "@/lib/repo/observations";
import { formatTime12, isReminderDue, REMINDER_LIMITATION } from "@/lib/reminder";
import { freshDb, registeredUser } from "./helpers/db";

let db: Database;
afterEach(async () => {
  await db?.close();
  db = undefined as unknown as Database;
});

async function setup() {
  db = await freshDb();
  const u = await registeredUser(db);
  const c = await createUserCase(db, u, { pseudonym: "Fictional" });
  return { u, caseId: c.id };
}

describe("four explicit check-in states", () => {
  it("offers exactly the four required answers", () => {
    expect(CHECKIN_STATUSES.map((s) => s.option)).toEqual([
      "No meaningful change",
      "I noticed a change",
      "I have a concern or question",
      "Skip today",
    ]);
  });

  it.each(CHECKIN_STATUSES.map((s) => [s.id, s.label]))("persists %s with a response timestamp", async (status, label) => {
    const { u, caseId } = await setup();
    const before = Date.now();
    const ci = await upsertCheckin(db, u, { caseId, day: "2026-10-20", status: status as "no_change" });
    expect(ci.status).toBe(status);
    expect(new Date(ci.respondedAt).getTime()).toBeGreaterThanOrEqual(before - 2000);
    const [stored] = await listCheckins(db, u, caseId);
    expect(stored.status).toBe(status);
    expect(checkinStatusLabel(stored.status)).toBe(label);
  });

  it("'No meaningful change', 'Skipped today' and no response are three different things", () => {
    const labels = new Set([checkinStatusLabel("no_change"), checkinStatusLabel("skipped"), checkinStatusLabel(undefined)]);
    expect(labels.size).toBe(3);
    expect(checkinStatusLabel(undefined)).toBe(NO_RESPONSE_LABEL);
  });

  it("changing today's answer updates the same day (one row) and refreshes the timestamp", async () => {
    const { u, caseId } = await setup();
    const first = await upsertCheckin(db, u, { caseId, day: "2026-10-20", status: "skipped" });
    await new Promise((r) => setTimeout(r, 20));
    const second = await upsertCheckin(db, u, { caseId, day: "2026-10-20", status: "concern", note: "Worried about fluids" });
    expect(await listCheckins(db, u, caseId)).toHaveLength(1);
    expect(second.status).toBe("concern");
    expect(new Date(second.respondedAt).getTime()).toBeGreaterThan(new Date(first.respondedAt).getTime());
  });
});

describe("optional free text", () => {
  it("is kept for 'I noticed a change' and 'I have a concern or question'", async () => {
    const { u, caseId } = await setup();
    expect((await upsertCheckin(db, u, { caseId, day: "2026-10-19", status: "noticed_change", note: "Walked less" })).note).toBe("Walked less");
    expect((await upsertCheckin(db, u, { caseId, day: "2026-10-20", status: "concern", note: "Question about fluids" })).note).toBe("Question about fluids");
  });
  it("is optional (blank is fine) and is dropped for 'No meaningful change' and 'Skip today'", async () => {
    const { u, caseId } = await setup();
    expect((await upsertCheckin(db, u, { caseId, day: "2026-10-18", status: "noticed_change", note: "" })).note).toBeNull();
    expect((await upsertCheckin(db, u, { caseId, day: "2026-10-19", status: "no_change", note: "should not be stored" })).note).toBeNull();
    expect((await upsertCheckin(db, u, { caseId, day: "2026-10-20", status: "skipped", note: "should not be stored" })).note).toBeNull();
  });
  it("a check-in never creates an observation by itself (saving one is a separate, explicit choice)", async () => {
    const { u, caseId } = await setup();
    await upsertCheckin(db, u, { caseId, day: "2026-10-20", status: "concern", note: "Hard to wake him" });
    expect(await listObservations(db, u, caseId)).toHaveLength(0);
  });
});

describe("missing response semantics", () => {
  it("a day with no row is 'No response recorded' — never treated as fine", async () => {
    const { u, caseId } = await setup();
    await upsertCheckin(db, u, { caseId, day: "2026-10-19", status: "no_change" });
    const grid = checkinGrid(await listCheckins(db, u, caseId), "2026-10-18", "2026-10-20");
    expect(grid.map((g) => Object.values(g.states).every((s) => s === "not_reported"))).toEqual([true, true, true]);
    expect(checkinStatusLabel((await listCheckins(db, u, caseId)).find((c) => c.day === "2026-10-18")?.status)).toBe(NO_RESPONSE_LABEL);
  });
  it("the AI only receives check-ins that were actually given; missing days are listed as unknown", async () => {
    const { u, caseId } = await setup();
    await addObservation(db, u, { caseId, text: "A note today" });
    const input = await buildInsightInput(db, u, caseId, "last7");
    expect(input.checkins).toEqual([]);
    expect(input.daysWithoutNotes.length).toBeGreaterThan(0);
  });
});

describe("in-app reminder preference", () => {
  it("is off by default with no time", async () => {
    const { u, caseId } = await setup();
    const c = await getCase(db, u, caseId);
    expect([c.reminderPref, c.reminderTime]).toEqual(["off", null]);
  });

  it("turning it on requires one valid daily time; the device time zone is stored", async () => {
    const { u, caseId } = await setup();
    await expect(setReminder(db, u, caseId, { pref: "in_app_daily", time: null })).rejects.toThrow();
    await expect(setReminder(db, u, caseId, { pref: "in_app_daily", time: "25:00" })).rejects.toThrow();
    await setReminder(db, u, caseId, { pref: "in_app_daily", time: "19:30", timeZone: "America/Los_Angeles" });
    const c = await getCase(db, u, caseId);
    expect([c.reminderPref, c.reminderTime, c.reminderTz]).toEqual(["in_app_daily", "19:30", "America/Los_Angeles"]);
    await setReminder(db, u, caseId, { pref: "off" });
    const off = await getCase(db, u, caseId);
    expect([off.reminderPref, off.reminderTime]).toEqual(["off", null]);
  });

  it("an invalid time zone falls back safely", async () => {
    const { u, caseId } = await setup();
    await setReminder(db, u, caseId, { pref: "in_app_daily", time: "08:00", timeZone: "Not/A_Zone; drop table" });
    expect((await getCase(db, u, caseId)).reminderTz).toBe("America/New_York");
  });

  it("shows only when on, after the chosen local time, and only if today's check-in is missing", () => {
    const on = { reminderPref: "in_app_daily" as const, reminderTime: "20:00", reminderTz: "America/New_York" };
    const at = (iso: string) => new Date(iso);
    expect(isReminderDue({ ...on, reminderPref: "off" }, at("2026-10-26T02:00:00Z"), false)).toBe(false); // off by default
    expect(isReminderDue(on, at("2026-10-25T23:00:00Z"), false)).toBe(false); // 19:00 New York
    expect(isReminderDue(on, at("2026-10-26T01:30:00Z"), false)).toBe(true); // 21:30 New York
    expect(isReminderDue(on, at("2026-10-26T01:30:00Z"), true)).toBe(false); // already answered today
    // Same instant, different caregiver time zone
    expect(isReminderDue({ ...on, reminderTz: "America/Los_Angeles" }, at("2026-10-26T01:30:00Z"), false)).toBe(false); // 18:30 LA
  });

  it("never claims email, SMS, push or phone notifications", () => {
    expect(REMINDER_LIMITATION).toMatch(/does not send email, text messages, push or phone notifications/);
    expect(formatTime12("20:00")).toBe("8:00 PM");
    expect(formatTime12("08:05")).toBe("8:05 AM");
  });

  it("does not block or limit note logging", async () => {
    const { u, caseId } = await setup();
    await setReminder(db, u, caseId, { pref: "in_app_daily", time: "00:00" });
    for (let i = 0; i < 5; i++) await addObservation(db, u, { caseId, text: `note ${i}` });
    expect(await listObservations(db, u, caseId)).toHaveLength(5);
  });
});
