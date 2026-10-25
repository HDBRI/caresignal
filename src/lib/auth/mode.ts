/**
 * Which access modes are available.
 *   supabase        — registered accounts via Supabase Auth + hosted Postgres (DATABASE_URL). Demo access too.
 *   local_demo_only — no Supabase configured: the three demo cases work, account registration is disabled.
 *                     CareSignal never implements its own password storage.
 */
export type AuthMode = "supabase" | "local_demo_only";

export function supabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      process.env.DATABASE_URL,
  );
}

export function authMode(): AuthMode {
  return supabaseConfigured() ? "supabase" : "local_demo_only";
}
