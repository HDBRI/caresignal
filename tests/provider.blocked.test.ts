/**
 * LIVE provider tests — BLOCKED until a Supabase project is configured.
 *
 * These run against a real Supabase project and are skipped (reported as skipped, never as passed)
 * unless all of these are set in the environment:
 *   SUPABASE_TEST_URL, SUPABASE_TEST_ANON_KEY, SUPABASE_TEST_SERVICE_ROLE_KEY
 * Use a throwaway test project or the course project; the test creates and then deletes its own user.
 */
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const url = process.env.SUPABASE_TEST_URL;
const anon = process.env.SUPABASE_TEST_ANON_KEY;
const service = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
const configured = Boolean(url && anon && service);

describe.skipIf(!configured)("BLOCKED until Supabase is configured: live auth provider", () => {
  const email = `caresignal-test-${Date.now()}@example.com`;
  const password = "LiveTestPassword123";

  it("sign up -> sign in -> session restored in a new client -> sign out -> session gone", async () => {
    const admin = createClient(url!, service!, { auth: { persistSession: false } }).auth.admin;
    const created = await admin.createUser({ email, password, email_confirm: true });
    expect(created.error).toBeNull();
    const userId = created.data.user!.id;
    try {
      // Browser A signs in
      const a = createClient(url!, anon!, { auth: { persistSession: false } });
      const signIn = await a.auth.signInWithPassword({ email, password });
      expect(signIn.error).toBeNull();
      const session = signIn.data.session!;

      // "Different browser/device": a fresh client restores the session from its tokens
      const b = createClient(url!, anon!, { auth: { persistSession: false } });
      const restored = await b.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
      expect(restored.data.user?.id).toBe(userId);

      // Sign out revokes the refresh token
      await b.auth.signOut();
      const after = await createClient(url!, anon!, { auth: { persistSession: false } }).auth.refreshSession({ refresh_token: session.refresh_token });
      expect(after.data.session).toBeNull();
    } finally {
      await admin.deleteUser(userId);
    }
  });

  it("password recovery request is accepted by the provider", async () => {
    const client = createClient(url!, anon!, { auth: { persistSession: false } });
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: "http://localhost:3000/auth/callback?next=/reset-password" });
    // Rate limits are the only acceptable failure; anything else means the flow is misconfigured.
    if (error) expect(error.status).toBe(429);
  });
});

describe.runIf(!configured)("live auth provider status", () => {
  it.skip("BLOCKED: set SUPABASE_TEST_URL / SUPABASE_TEST_ANON_KEY / SUPABASE_TEST_SERVICE_ROLE_KEY to run live sign-up, sign-in, session restoration, sign-out and password-recovery tests", () => {});
});
