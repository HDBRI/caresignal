"use server";
/**
 * Access actions. Server Actions are POST-only and Next.js checks the Origin header against the host,
 * which protects these forms against cross-site request forgery.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyDemoCredentials } from "@/lib/auth/demo";
import { authMode } from "@/lib/auth/mode";
import { rateLimit } from "@/lib/auth/rate-limit";
import { validateRegistration, type FieldErrors } from "@/lib/auth/registration";
import {
  registerWithSupabase,
  requestPasswordReset,
  safeNext,
  setNewPassword,
  signInWithSupabase,
  type AuthClient,
} from "@/lib/auth/service";
import { clientIp, DEMO_COOKIE, demoCookieOptions, getActor, principalOf, siteUrl } from "@/lib/auth/session";
import { getDb } from "@/lib/repo/db";
import { resetDemoSession, startDemoSession } from "@/lib/repo/seed";

export interface FormState {
  errors?: FieldErrors & Record<string, string | undefined>;
  message?: string;
  values?: Record<string, string>;
}

const str = (fd: FormData, k: string) => (typeof fd.get(k) === "string" ? (fd.get(k) as string) : "");

async function signOutSupabaseIfAny() {
  if (authMode() !== "supabase") return;
  const { serverClient } = await import("@/lib/auth/supabase");
  await (await serverClient()).auth.signOut();
}

// ---------------- Demo ----------------

export async function enterDemo(_prev: FormState, fd: FormData): Promise<FormState> {
  const username = str(fd, "username").trim();
  if (!rateLimit(`demo:${await clientIp()}`, 20, 60_000)) {
    return { errors: { form: "Too many attempts. Please wait a minute and try again." }, values: { username } };
  }
  const fixture = verifyDemoCredentials(username, str(fd, "password"));
  if (!fixture) return { errors: { form: "Demo username or password is incorrect." }, values: { username } };

  await signOutSupabaseIfAny(); // a demo visit never shares a browser session with a registered account
  const db = await getDb();
  const { demoSessionId, caseId } = await startDemoSession(db, fixture.demoAccount.userId, fixture.seedKey);
  (await cookies()).set(DEMO_COOKIE, demoSessionId, demoCookieOptions());
  redirect(`/cases/${caseId}/overview`);
}

export async function resetMyDemo(): Promise<void> {
  const actor = await getActor();
  if (!actor || actor.kind !== "demo") redirect("/demo");
  const caseId = await resetDemoSession(await getDb(), principalOf(actor));
  redirect(`/cases/${caseId}/overview?reset=1`);
}

// ---------------- Registered accounts (Supabase Auth) ----------------

async function supabaseAuth(): Promise<AuthClient> {
  const { serverClient } = await import("@/lib/auth/supabase");
  return (await serverClient()).auth as unknown as AuthClient;
}

function requireSupabase(): FormState | null {
  return authMode() === "supabase"
    ? null
    : { errors: { form: "Accounts are not available in this local copy. Use the hosted CareSignal link, or explore a demo." } };
}

export async function register(_prev: FormState, fd: FormData): Promise<FormState> {
  const values = { email: str(fd, "email"), username: str(fd, "username") };
  const blocked = requireSupabase();
  if (blocked) return { ...blocked, values };
  if (!rateLimit(`register:${await clientIp()}`, 5, 10 * 60_000)) {
    return { errors: { form: "Too many sign-up attempts. Please wait a few minutes." }, values };
  }
  const v = validateRegistration({
    email: values.email,
    username: values.username,
    password: str(fd, "password"),
    confirmPassword: str(fd, "confirmPassword"),
    acceptTerms: str(fd, "acceptTerms") as "on",
    acceptPrivacy: str(fd, "acceptPrivacy") as "on",
    affirmFictional: str(fd, "affirmFictional") as "on",
  });
  if (!v.ok) return { errors: v.errors, values };

  const db = await getDb();
  const { isUsernameAvailable } = await import("@/lib/auth/registration");
  if (!(await isUsernameAvailable(db, v.data.username))) {
    return { errors: { username: "That username is already taken" }, values };
  }
  const { adminClient } = await import("@/lib/auth/supabase");
  const admin = adminClient().auth.admin;
  const result = await registerWithSupabase(await supabaseAuth(), { deleteUser: (id) => admin.deleteUser(id) }, db, v.data, await siteUrl());
  if (!result.ok) return { errors: { [result.field ?? "form"]: result.message }, values };

  (await cookies()).delete(DEMO_COOKIE);
  if (result.next === "check_email") redirect("/register/check-email");
  redirect("/cases/new?welcome=1");
}

export async function signIn(_prev: FormState, fd: FormData): Promise<FormState> {
  const values = { email: str(fd, "email") };
  const blocked = requireSupabase();
  if (blocked) return { ...blocked, values };
  if (!rateLimit(`signin:${await clientIp()}`, 10, 60_000)) {
    return { errors: { form: "Too many attempts. Please wait a minute and try again." }, values };
  }
  const result = await signInWithSupabase(await supabaseAuth(), values.email, str(fd, "password"));
  if (!result.ok) return { errors: { form: result.message }, values };
  (await cookies()).delete(DEMO_COOKIE);
  redirect(safeNext(str(fd, "next"), "/cases"));
}

export async function forgotPassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const blocked = requireSupabase();
  if (blocked) return blocked;
  if (!rateLimit(`reset:${await clientIp()}`, 5, 10 * 60_000)) {
    return { errors: { form: "Too many requests. Please wait a few minutes." } };
  }
  const { message } = await requestPasswordReset(await supabaseAuth(), str(fd, "email"), await siteUrl());
  return { message };
}

export async function resetPassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const blocked = requireSupabase();
  if (blocked) return blocked;
  const result = await setNewPassword(await supabaseAuth(), str(fd, "password"), str(fd, "confirmPassword"));
  if (!result.ok) return { errors: { [result.field ?? "form"]: result.message } };
  redirect("/cases?password=updated");
}

export async function deleteAccount(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await getActor();
  if (!actor || actor.kind !== "registered") return { errors: { form: "Only registered accounts can be deleted." } };
  if (str(fd, "confirm").trim() !== "DELETE") return { errors: { confirm: "Type DELETE to confirm." } };
  const { adminClient } = await import("@/lib/auth/supabase");
  const { error } = await adminClient().auth.admin.deleteUser(actor.userId); // cascades to all CareSignal rows
  if (error) return { errors: { form: "We couldn't delete the account. Please try again." } };
  await signOutSupabaseIfAny();
  redirect("/?account=deleted");
}
