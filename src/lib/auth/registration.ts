/**
 * Registration validation and the durable acceptance record.
 * Passwords are validated here but never stored or logged by CareSignal — Supabase Auth stores them.
 */
import { z } from "zod";
import type { Database } from "../db/client";
import { assertUuid } from "../db/client";
import { PRIVACY_VERSION, TERMS_VERSION } from "../legal";

export const USERNAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{2,29}$/;

const mustAccept = (message: string) =>
  z.union([z.literal("on"), z.literal(true), z.literal("true")], { error: () => message }).transform(() => true as const);

export const registerInput = z
  .object({
    email: z.string().trim().toLowerCase().email("Enter a valid email address").max(254),
    username: z
      .string()
      .trim()
      .regex(USERNAME_RE, "Username must be 3–30 characters: letters, numbers, dots, dashes or underscores, starting with a letter or number")
      .refine((u) => !/^demo-/i.test(u), "Usernames starting with “demo-” are reserved for the shared demo accounts"),
    password: z
      .string()
      .min(10, "Password must be at least 10 characters")
      .max(72, "Password must be at most 72 characters")
      .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), "Password must include at least one letter and one number"),
    confirmPassword: z.string(),
    acceptTerms: mustAccept("Please accept the Terms of Use"),
    acceptPrivacy: mustAccept("Please accept the Privacy Notice"),
    affirmFictional: mustAccept("Please confirm you will enter fictional data only"),
  })
  .refine((d) => d.password === d.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });

export type RegisterInput = z.input<typeof registerInput>;
export type ValidRegistration = z.output<typeof registerInput>;

export type FieldErrors = Partial<Record<keyof RegisterInput | "form", string>>;

export function validateRegistration(input: RegisterInput): { ok: true; data: ValidRegistration } | { ok: false; errors: FieldErrors } {
  const r = registerInput.safeParse(input);
  if (r.success) return { ok: true, data: r.data };
  const errors: FieldErrors = {};
  for (const issue of r.error.issues) {
    const key = (issue.path[0] as keyof RegisterInput) ?? "form";
    errors[key] ??= issue.message;
  }
  // The object-level match check is skipped while other fields fail; report it anyway so users see every problem at once.
  if (input.password !== input.confirmPassword) errors.confirmPassword ??= "Passwords do not match";
  return { ok: false, errors };
}

export class UsernameTakenError extends Error {
  constructor() {
    super("That username is already taken");
  }
}

export async function isUsernameAvailable(db: Database, username: string): Promise<boolean> {
  const rows = await db.asAdmin((sql) => sql.query(`select 1 from profiles where lower(username) = lower($1)`, [username.trim()]));
  return rows.length === 0;
}

/**
 * Persist the profile and the acceptance record for a newly created auth user.
 * Server-side only; the record is the durable proof of acceptance (not the browser checkbox).
 */
export async function recordRegistration(
  db: Database,
  userId: string,
  data: Pick<ValidRegistration, "username" | "acceptTerms" | "acceptPrivacy" | "affirmFictional">,
): Promise<{ acceptedAt: string; termsVersion: string; privacyVersion: string }> {
  assertUuid(userId, "user id");
  if (!(data.acceptTerms && data.acceptPrivacy && data.affirmFictional)) throw new Error("consent required");
  try {
    return await db.asAdmin(async (sql) => {
      await sql.query(
        `insert into profiles (user_id, display_name, username, account_kind) values ($1, $2, $2, 'registered')`,
        [userId, data.username],
      );
      const [row] = await sql.query<{ accepted_at: Date | string; terms_version: string; privacy_version: string }>(
        `insert into terms_acceptances (user_id, terms_version, privacy_version, fictional_data_affirmed)
         values ($1, $2, $3, true) returning accepted_at, terms_version, privacy_version`,
        [userId, TERMS_VERSION, PRIVACY_VERSION],
      );
      return {
        acceptedAt: new Date(row.accepted_at).toISOString(),
        termsVersion: row.terms_version,
        privacyVersion: row.privacy_version,
      };
    });
  } catch (err) {
    if (/profiles_username_lower|duplicate key/i.test(String((err as Error)?.message))) throw new UsernameTakenError();
    throw err;
  }
}
