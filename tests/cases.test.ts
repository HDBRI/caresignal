import { afterEach, describe, expect, it } from "vitest";
import type { Database } from "@/lib/db/client";
import { createUserCase, getCase, listBaselines, NotFoundError, updateCaseDetails, deleteUserCase } from "@/lib/repo/cases";
import { listHandoffs } from "@/lib/repo/handoffs";
import { addObservation, getObservationByDisplayId, markAlertSeen, listAlerts } from "@/lib/repo/observations";
import { freshDb, registeredUser } from "./helpers/db";

let db: Database;
afterEach(async () => {
  await db?.close();
  db = undefined as unknown as Database;
});

describe("case creation (onboarding)", () => {
  it("stores every onboarding field; blanks stay NULL (Not provided)", async () => {
    db = await freshDb();
    const u = await registeredUser(db);
    const c = await createUserCase(db, u, {
      pseudonym: "  Grandpa J.  ",
      caregiverName: "Sam",
      caregiverRelationship: "",
      ageRange: "65_79",
      primaryCondition: "Not sure",
      carePhase: "recovering",
      careSetting: "",
      careContext: "   ",
      milestones: "Follow-up next week",
    });
    expect(c).toMatchObject({
      pseudonym: "Grandpa J.",
      caregiverName: "Sam",
      caregiverRelationship: null,
      ageRange: "65_79",
      primaryCondition: "Not sure",
      carePhase: "recovering",
      careSetting: null,
      careContext: null,
      milestones: "Follow-up next week",
      kind: "user",
      synthetic: true,
    });
    expect(c.patientRef).toMatch(/^PAT-USER-[A-Z2-9]{6}$/);
  });

  it("only the pseudonym is required", async () => {
    db = await freshDb();
    const u = await registeredUser(db);
    const c = await createUserCase(db, u, { pseudonym: "Pat (fictional)" });
    expect([c.ageRange, c.carePhase, c.careSetting, c.primaryCondition]).toEqual([null, null, null, null]);
    await expect(createUserCase(db, u, { pseudonym: "   " })).rejects.toThrow();
    await expect(createUserCase(db, u, { pseudonym: "x", ageRange: "ancient" })).rejects.toThrow();
  });

  it("persists only the baseline domains the caregiver filled in", async () => {
    db = await freshDb();
    const u = await registeredUser(db);
    const c = await createUserCase(db, u, {
      pseudonym: "Pat",
      baselines: [
        { category: "mobility_function", description: "Walks around the house alone" },
        { category: "eating_drinking", description: "" },
        { category: "memory_attention", description: "Keeps track of appointments" },
      ],
    });
    const b = await listBaselines(db, u, c.id);
    expect(b.map((x) => [x.category, x.description, x.origin, x.synthetic])).toEqual([
      ["memory_attention", "Keeps track of appointments", "session", true],
      ["mobility_function", "Walks around the house alone", "session", true],
    ]);
  });

  it("owner can update care details; another user cannot", async () => {
    db = await freshDb();
    const a = await registeredUser(db);
    const b = await registeredUser(db);
    const c = await createUserCase(db, a, { pseudonym: "A's case" });
    await updateCaseDetails(db, a, c.id, { pseudonym: "Renamed", careSetting: "home" });
    expect((await getCase(db, a, c.id)).pseudonym).toBe("Renamed");
    await expect(updateCaseDetails(db, b, c.id, { pseudonym: "Hijacked" })).rejects.toBeInstanceOf(NotFoundError);
    expect((await getCase(db, a, c.id)).pseudonym).toBe("Renamed");
  });
});

describe("guessing IDs never reaches another user's records", () => {
  it("read, update, delete and acknowledge all fail for user B", async () => {
    db = await freshDb();
    const a = await registeredUser(db);
    const b = await registeredUser(db);
    const c = await createUserCase(db, a, { pseudonym: "A's case" });
    const { observation } = await addObservation(db, a, { caseId: c.id, text: "She has trouble breathing" });
    const [alert] = await listAlerts(db, a, c.id);

    await expect(getObservationByDisplayId(db, b, c.id, observation.displayId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(markAlertSeen(db, b, alert.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(deleteUserCase(db, b, c.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(listHandoffs(db, b, c.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getCase(db, b, "not-a-uuid")).rejects.toThrow();
    // A's data is untouched
    expect((await listAlerts(db, a, c.id))[0].seenAt).toBeNull();
    expect((await getCase(db, a, c.id)).pseudonym).toBe("A's case");
  });

  it("deleting a case removes all its rows (owner only)", async () => {
    db = await freshDb();
    const a = await registeredUser(db);
    const c = await createUserCase(db, a, { pseudonym: "Temp" });
    await addObservation(db, a, { caseId: c.id, text: "note" });
    await deleteUserCase(db, a, c.id);
    await expect(getCase(db, a, c.id)).rejects.toBeInstanceOf(NotFoundError);
    const [{ n }] = await db.asAdmin((sql) => sql.query<{ n: number }>(`select count(*)::int as n from observations where case_id = $1`, [c.id]));
    expect(n).toBe(0);
  });

  it("deleting the auth user deletes every row they own (account deletion)", async () => {
    db = await freshDb();
    const a = await registeredUser(db);
    const c = await createUserCase(db, a, { pseudonym: "Temp" });
    await addObservation(db, a, { caseId: c.id, text: "note" });
    await db.asAdmin((sql) => sql.query(`delete from auth.users where id = $1`, [a.userId]));
    for (const t of ["profiles", "cases", "observations", "safety_alerts"]) {
      const col = t === "profiles" ? "user_id" : "owner_id";
      const [{ n }] = await db.asAdmin((sql) => sql.query<{ n: number }>(`select count(*)::int as n from ${t} where ${col} = $1`, [a.userId]));
      expect(n, t).toBe(0);
    }
  });
});
