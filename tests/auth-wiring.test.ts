/**
 * Wiring tests for the Supabase Auth flows with a stand-in client. These prove CareSignal calls the
 * provider correctly and handles its responses safely. They do NOT prove the provider works —
 * see tests/provider.blocked.test.ts for the live checks.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/db/client";
import { validateRegistration } from "@/lib/auth/registration";
import {
  registerWithSupabase,
  requestPasswordReset,
  RESET_REQUEST_MESSAGE,
  safeNext,
  setNewPassword,
  signInWithSupabase,
  type AuthClient,
} from "@/lib/auth/service";
import { rateLimit, resetRateLimits } from "@/lib/auth/rate-limit";
import { freshDb } from "./helpers/db";
import { randomUUID } from "node:crypto";

function fakeAuth(overrides: Partial<Record<keyof AuthClient, unknown>> = {}): AuthClient {
  return {
    signUp: vi.fn(async () => ({ data: { user: null, session: null }, error: null })),
    signInWithPassword: vi.fn(async () => ({ data: { user: {}, session: {} }, error: null })),
    resetPasswordForEmail: vi.fn(async () => ({ error: null })),
    updateUser: vi.fn(async () => ({ error: null })),
    signOut: vi.fn(async () => ({ error: null })),
    ...overrides,
  } as unknown as AuthClient;
}

const reg = (() => {
  const r = validateRegistration({
    email: "caregiver@example.test",
    username: "fictional_sam",
    password: "longpassword1",
    confirmPassword: "longpassword1",
    acceptTerms: "on",
    acceptPrivacy: "on",
    affirmFictional: "on",
  });
  if (!r.ok) throw new Error("bad fixture");
  return r.data;
})();

let db: Database;
afterEach(async () => {
  await db?.close();
  db = undefined as unknown as Database;
});

async function insertAuthUser(db: Database, id: string) {
  await db.asAdmin((sql) => sql.query(`insert into auth.users (id, email) values ($1, $2)`, [id, `${id}@example.test`]));
}

describe("registration wiring", () => {
  it("signs up with Supabase, then stores the acceptance record for the returned user", async () => {
    db = await freshDb();
    const id = randomUUID();
    await insertAuthUser(db, id); // Supabase would have created this row
    const auth = fakeAuth({ signUp: vi.fn(async () => ({ data: { user: { id, identities: [{}] }, session: { access_token: "t" } }, error: null })) });
    const admin = { deleteUser: vi.fn(async () => ({ error: null })) };
    const out = await registerWithSupabase(auth, admin, db, reg, "https://caresignal.example");
    expect(out).toEqual({ ok: true, next: "signed_in" });
    expect(auth.signUp).toHaveBeenCalledWith({
      email: "caregiver@example.test",
      password: "longpassword1",
      options: { data: { username: "fictional_sam" }, emailRedirectTo: "https://caresignal.example/auth/callback?next=/cases/new" },
    });
    const rows = await db.asAdmin((sql) => sql.query(`select * from terms_acceptances where user_id = $1`, [id]));
    expect(rows).toHaveLength(1);
    expect(admin.deleteUser).not.toHaveBeenCalled();
  });

  it("reports check_email (never 'verified') when the provider requires email confirmation", async () => {
    db = await freshDb();
    const id = randomUUID();
    await insertAuthUser(db, id);
    const auth = fakeAuth({ signUp: vi.fn(async () => ({ data: { user: { id, identities: [{}] }, session: null }, error: null })) });
    const out = await registerWithSupabase(auth, { deleteUser: vi.fn(async () => ({ error: null })) }, db, reg, "http://localhost:3000");
    expect(out).toEqual({ ok: true, next: "check_email" });
  });

  it("handles 'email already registered' (no identities) without saving anything", async () => {
    db = await freshDb();
    const auth = fakeAuth({ signUp: vi.fn(async () => ({ data: { user: { id: randomUUID(), identities: [] }, session: null }, error: null })) });
    const out = await registerWithSupabase(auth, { deleteUser: vi.fn(async () => ({ error: null })) }, db, reg, "http://x");
    expect(out.ok).toBe(false);
    const rows = await db.asAdmin((sql) => sql.query(`select * from terms_acceptances`));
    expect(rows).toHaveLength(0);
  });

  it("rolls back the auth user if the username was taken in the meantime", async () => {
    db = await freshDb();
    const first = randomUUID();
    await insertAuthUser(db, first);
    const ok = fakeAuth({ signUp: vi.fn(async () => ({ data: { user: { id: first, identities: [{}] }, session: {} }, error: null })) });
    await registerWithSupabase(ok, { deleteUser: vi.fn(async () => ({ error: null })) }, db, reg, "http://x");

    const second = randomUUID();
    await insertAuthUser(db, second);
    const admin = { deleteUser: vi.fn(async () => ({ error: null })) };
    const dup = fakeAuth({ signUp: vi.fn(async () => ({ data: { user: { id: second, identities: [{}] }, session: {} }, error: null })) });
    const out = await registerWithSupabase(dup, admin, db, { ...reg, username: "FICTIONAL_SAM" }, "http://x");
    expect(out).toEqual({ ok: false, field: "username", message: "That username is already taken" });
    expect(admin.deleteUser).toHaveBeenCalledWith(second);
  });

  it("maps provider errors to safe messages (no stack traces, no provider internals)", async () => {
    db = await freshDb();
    const auth = fakeAuth({
      signUp: vi.fn(async () => ({ data: { user: null, session: null }, error: { message: "Internal: pg error at row 7", status: 500, code: "unexpected_failure" } })),
    });
    const out = await registerWithSupabase(auth, { deleteUser: vi.fn() as never }, db, reg, "http://x");
    expect(out).toEqual({ ok: false, field: "form", message: "We couldn't create your account. Please try again." });
  });
});

describe("sign-in wiring", () => {
  it("normalizes email and uses one message for wrong email or wrong password", async () => {
    const auth = fakeAuth({ signInWithPassword: vi.fn(async () => ({ data: { user: null, session: null }, error: { message: "Invalid login credentials", status: 400, code: "invalid_credentials" } })) });
    const out = await signInWithSupabase(auth, "  Someone@Example.TEST ", "pw");
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "someone@example.test", password: "pw" });
    expect(out).toEqual({ ok: false, field: "form", message: "Email or password is incorrect." });
  });

  it("tells unconfirmed users to confirm their email", async () => {
    const auth = fakeAuth({ signInWithPassword: vi.fn(async () => ({ data: { user: null, session: null }, error: { message: "x", code: "email_not_confirmed" } })) });
    expect((await signInWithSupabase(auth, "a@b.test", "pw")).ok).toBe(false);
  });

  it("succeeds when the provider returns a session", async () => {
    expect(await signInWithSupabase(fakeAuth(), "a@b.test", "pw")).toEqual({ ok: true, next: "signed_in" });
  });
});

describe("password recovery wiring", () => {
  it("requests a reset email that returns to /auth/callback -> /reset-password", async () => {
    const auth = fakeAuth();
    const out = await requestPasswordReset(auth, " Someone@Example.test ", "https://caresignal.example");
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("someone@example.test", {
      redirectTo: "https://caresignal.example/auth/callback?next=/reset-password",
    });
    expect(out.message).toBe(RESET_REQUEST_MESSAGE);
  });

  it("gives the same answer whether or not the email exists or the provider errors", async () => {
    const failing = fakeAuth({ resetPasswordForEmail: vi.fn(async () => ({ error: { message: "user not found" } })) });
    expect((await requestPasswordReset(failing, "nobody@example.test", "http://x")).message).toBe(RESET_REQUEST_MESSAGE);
    const auth = fakeAuth();
    expect((await requestPasswordReset(auth, "not an email", "http://x")).message).toBe(RESET_REQUEST_MESSAGE);
    expect(auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("validates the new password before calling the provider", async () => {
    const auth = fakeAuth();
    expect((await setNewPassword(auth, "short", "short")).ok).toBe(false);
    expect((await setNewPassword(auth, "longpassword1", "different12")).ok).toBe(false);
    expect(auth.updateUser).not.toHaveBeenCalled();
    expect(await setNewPassword(auth, "longpassword1", "longpassword1")).toEqual({ ok: true, next: "signed_in" });
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "longpassword1" });
  });
});

describe("redirect and rate-limit safety", () => {
  it("only allows same-site relative redirects", () => {
    expect(safeNext("/cases/new")).toBe("/cases/new");
    expect(safeNext("https://evil.example")).toBe("/cases");
    expect(safeNext("//evil.example")).toBe("/cases");
    expect(safeNext("/\\evil.example")).toBe("/cases");
    expect(safeNext(null)).toBe("/cases");
  });

  it("rate limiter blocks after the limit within the window and recovers after it", () => {
    resetRateLimits();
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) expect(rateLimit("k", 5, 60_000, t0 + i)).toBe(true);
    expect(rateLimit("k", 5, 60_000, t0 + 10)).toBe(false);
    expect(rateLimit("k", 5, 60_000, t0 + 61_000)).toBe(true);
  });
});
