import { afterEach, describe, expect, it } from "vitest";
import type { Database } from "@/lib/db/client";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";
import {
  isUsernameAvailable,
  recordRegistration,
  UsernameTakenError,
  validateRegistration,
  type RegisterInput,
} from "@/lib/auth/registration";
import { freshDb } from "./helpers/db";
import { randomUUID } from "node:crypto";

const valid: RegisterInput = {
  email: "Fictional.Caregiver@Example.test",
  username: "sam_caregiver",
  password: "longpassword1",
  confirmPassword: "longpassword1",
  acceptTerms: "on",
  acceptPrivacy: "on",
  affirmFictional: "on",
};

describe("registration validation", () => {
  it("accepts a valid registration and normalizes the email", () => {
    const r = validateRegistration(valid);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.email).toBe("fictional.caregiver@example.test");
  });

  it.each([
    ["email", { email: "not-an-email" }],
    ["username", { username: "ab" }],
    ["username", { username: "has space" }],
    ["username", { username: "_starts_with_underscore" }],
    ["username", { username: "x".repeat(31) }],
    ["username", { username: "demo-cancer" }],
    ["password", { password: "short1", confirmPassword: "short1" }],
    ["password", { password: "nodigitsatall", confirmPassword: "nodigitsatall" }],
    ["password", { password: "1234567890123", confirmPassword: "1234567890123" }],
    ["confirmPassword", { confirmPassword: "different123" }],
  ])("rejects bad %s: %j", (field, override) => {
    const r = validateRegistration({ ...valid, ...override } as RegisterInput);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[field as keyof typeof r.errors]).toBeTruthy();
  });

  it.each(["acceptTerms", "acceptPrivacy", "affirmFictional"] as const)("requires %s (unchecked box is rejected)", (box) => {
    for (const unchecked of [undefined, "", "off", false]) {
      const r = validateRegistration({ ...valid, [box]: unchecked } as unknown as RegisterInput);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors[box]).toBeTruthy();
    }
  });

  it("reports a password mismatch together with other errors", () => {
    const r = validateRegistration({ ...valid, confirmPassword: "other123456", acceptTerms: undefined } as unknown as RegisterInput);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.confirmPassword).toBe("Passwords do not match");
      expect(r.errors.acceptTerms).toBeTruthy();
    }
  });

  it("never echoes the password in error messages", () => {
    const r = validateRegistration({ ...valid, password: "abcdefghijk", confirmPassword: "abcdefghijk" });
    expect(JSON.stringify(r)).not.toContain("abcdefghijk");
  });
});

describe("acceptance record and username uniqueness", () => {
  let db: Database;
  afterEach(async () => {
    await db?.close();
    db = undefined as unknown as Database;
  });

  async function authUser(db: Database) {
    const id = randomUUID();
    await db.asAdmin((sql) => sql.query(`insert into auth.users (id, email) values ($1, $2)`, [id, `${id}@example.test`]));
    return id;
  }

  it("persists profile + acceptance record with versions, timestamp and fictional-data affirmation", async () => {
    db = await freshDb();
    const userId = await authUser(db);
    const before = Date.now();
    const r = validateRegistration(valid);
    if (!r.ok) throw new Error("expected valid");
    const rec = await recordRegistration(db, userId, r.data);
    expect(rec.termsVersion).toBe(TERMS_VERSION);
    expect(rec.privacyVersion).toBe(PRIVACY_VERSION);
    expect(new Date(rec.acceptedAt).getTime()).toBeGreaterThanOrEqual(before - 1000);

    const rows = await db.asAdmin((sql) =>
      sql.query<{ terms_version: string; privacy_version: string; fictional_data_affirmed: boolean }>(
        `select terms_version, privacy_version, fictional_data_affirmed from terms_acceptances where user_id = $1`,
        [userId],
      ),
    );
    expect(rows).toEqual([{ terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION, fictional_data_affirmed: true }]);
    const [profile] = await db.asAdmin((sql) => sql.query(`select username, account_kind from profiles where user_id = $1`, [userId]));
    expect(profile).toEqual({ username: "sam_caregiver", account_kind: "registered" });
  });

  it("the user can read their own acceptance record under RLS, but not someone else's", async () => {
    db = await freshDb();
    const a = await authUser(db);
    const b = await authUser(db);
    const r = validateRegistration(valid);
    if (!r.ok) throw new Error("expected valid");
    await recordRegistration(db, a, r.data);
    const own = await db.asPrincipal({ userId: a, demoSessionId: null }, (sql) => sql.query(`select * from terms_acceptances`));
    const other = await db.asPrincipal({ userId: b, demoSessionId: null }, (sql) => sql.query(`select * from terms_acceptances`));
    expect(own).toHaveLength(1);
    expect(other).toHaveLength(0);
  });

  it("the database refuses an acceptance record without the fictional-data affirmation", async () => {
    db = await freshDb();
    const userId = await authUser(db);
    await expect(
      db.asAdmin((sql) =>
        sql.query(`insert into terms_acceptances (user_id, terms_version, privacy_version, fictional_data_affirmed) values ($1, 'v', 'v', false)`, [userId]),
      ),
    ).rejects.toThrow();
  });

  it("rejects duplicate usernames case-insensitively", async () => {
    db = await freshDb();
    const r = validateRegistration(valid);
    if (!r.ok) throw new Error("expected valid");
    await recordRegistration(db, await authUser(db), r.data);
    expect(await isUsernameAvailable(db, "SAM_Caregiver")).toBe(false);
    expect(await isUsernameAvailable(db, "someone_else")).toBe(true);
    await expect(recordRegistration(db, await authUser(db), { ...r.data, username: "Sam_Caregiver" })).rejects.toBeInstanceOf(UsernameTakenError);
  });

  it("demo usernames are already taken by the demo accounts", async () => {
    db = await freshDb();
    expect(await isUsernameAvailable(db, "demo-cancer")).toBe(false);
  });
});
