/**
 * Supabase Auth flows, written against a minimal client interface so the wiring can be unit-tested.
 * Never logs or returns passwords/tokens. Error messages shown to users are generic and safe.
 */
import type { Database } from "../db/client";
import { recordRegistration, UsernameTakenError, type ValidRegistration } from "./registration";

/** The subset of the Supabase auth client CareSignal uses. */
export interface AuthClient {
  signUp(args: {
    email: string;
    password: string;
    options?: { data?: Record<string, unknown>; emailRedirectTo?: string };
  }): Promise<{ data: { user: { id: string; identities?: unknown[] | null } | null; session: unknown | null }; error: { message: string; status?: number; code?: string } | null }>;
  signInWithPassword(args: { email: string; password: string }): Promise<{ data: { user: unknown | null; session: unknown | null }; error: { message: string; status?: number; code?: string } | null }>;
  resetPasswordForEmail(email: string, options?: { redirectTo?: string }): Promise<{ error: { message: string } | null }>;
  updateUser(args: { password: string }): Promise<{ error: { message: string; code?: string } | null }>;
  signOut(): Promise<{ error: unknown | null }>;
}

export interface AdminClient {
  deleteUser(id: string): Promise<{ error: { message: string } | null }>;
}

export type AuthOutcome =
  | { ok: true; next: "signed_in" | "check_email" }
  | { ok: false; field?: "email" | "username" | "password" | "form"; message: string };

/** Only allow same-site relative redirects. */
export function safeNext(next: string | null | undefined, fallback = "/cases"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}

export async function registerWithSupabase(
  auth: AuthClient,
  admin: AdminClient,
  db: Database,
  data: ValidRegistration,
  siteUrl: string,
): Promise<AuthOutcome> {
  const { data: res, error } = await auth.signUp({
    email: data.email,
    password: data.password,
    options: { data: { username: data.username }, emailRedirectTo: `${siteUrl}/auth/callback?next=/cases/new` },
  });
  if (error) return mapSignUpError(error);
  const user = res.user;
  // Supabase returns a user with no identities when the email is already registered (enumeration protection).
  if (!user || (Array.isArray(user.identities) && user.identities.length === 0)) {
    return { ok: false, field: "email", message: "This email may already have an account. Try signing in or resetting your password." };
  }
  try {
    await recordRegistration(db, user.id, data);
  } catch (err) {
    // Roll back the auth user so the account never exists without its acceptance record.
    await admin.deleteUser(user.id).catch(() => undefined);
    await auth.signOut().catch(() => undefined);
    if (err instanceof UsernameTakenError) return { ok: false, field: "username", message: err.message };
    console.error("[auth] could not save registration record");
    return { ok: false, field: "form", message: "We couldn't finish creating your account. Please try again." };
  }
  return { ok: true, next: res.session ? "signed_in" : "check_email" };
}

function mapSignUpError(error: { message: string; status?: number; code?: string }): AuthOutcome {
  const code = error.code ?? "";
  if (code === "weak_password") return { ok: false, field: "password", message: "That password is too weak. Try a longer one." };
  if (code === "email_address_invalid") return { ok: false, field: "email", message: "Enter a valid email address." };
  if (code === "user_already_exists" || code === "email_exists")
    return { ok: false, field: "email", message: "This email may already have an account. Try signing in or resetting your password." };
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || error.status === 429)
    return { ok: false, field: "form", message: "Too many attempts right now. Please wait a minute and try again." };
  if (code === "signup_disabled") return { ok: false, field: "form", message: "New sign-ups are currently turned off for this prototype." };
  return { ok: false, field: "form", message: "We couldn't create your account. Please try again." };
}

export async function signInWithSupabase(auth: AuthClient, email: string, password: string): Promise<AuthOutcome> {
  if (!email?.trim() || !password) return { ok: false, field: "form", message: "Enter your email and password." };
  const { error } = await auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (!error) return { ok: true, next: "signed_in" };
  if (error.code === "email_not_confirmed")
    return { ok: false, field: "form", message: "Please confirm your email first — check your inbox for the link." };
  if (error.status === 429 || error.code === "over_request_rate_limit")
    return { ok: false, field: "form", message: "Too many attempts. Please wait a minute and try again." };
  // Same message for unknown email and wrong password.
  return { ok: false, field: "form", message: "Email or password is incorrect." };
}

export const RESET_REQUEST_MESSAGE =
  "If an account exists for that email, a password reset link is on its way. The link opens CareSignal so you can choose a new password.";

export async function requestPasswordReset(auth: AuthClient, email: string, siteUrl: string): Promise<{ message: string }> {
  const trimmed = email?.trim().toLowerCase();
  if (trimmed && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    const { error } = await auth.resetPasswordForEmail(trimmed, { redirectTo: `${siteUrl}/auth/callback?next=/reset-password` });
    if (error) console.error("[auth] password reset request failed");
  }
  return { message: RESET_REQUEST_MESSAGE }; // never reveals whether the email exists
}

export async function setNewPassword(auth: AuthClient, password: string, confirm: string): Promise<AuthOutcome> {
  if (password.length < 10 || password.length > 72 || !/[A-Za-z]/.test(password) || !/\d/.test(password))
    return { ok: false, field: "password", message: "Password must be 10–72 characters with at least one letter and one number." };
  if (password !== confirm) return { ok: false, field: "password", message: "Passwords do not match." };
  const { error } = await auth.updateUser({ password });
  if (error) {
    if (error.code === "same_password") return { ok: false, field: "password", message: "Choose a password you haven't used before." };
    return { ok: false, field: "form", message: "Your reset link may have expired. Request a new one and try again." };
  }
  return { ok: true, next: "signed_in" };
}
