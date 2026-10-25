/**
 * Database bootstrap commands.
 *   npm run db:setup   apply migrations (+ local demo accounts in local mode). Safe to re-run.
 *   npm run db:reset   LOCAL ONLY: delete data/pgdata and rebuild the known starting state.
 *   npm run db:status  show driver, applied migrations and row counts (no secrets).
 *
 * Hosted mode is selected by DATABASE_URL. Stop `npm run dev` before db:reset (PGlite holds the folder).
 */
import fs from "node:fs";
import { loadEnv } from "../src/lib/env";
import { createDatabase, localDataDir } from "../src/lib/db/client";
import { migrate } from "../src/lib/db/migrate";
import { SEED_CASES } from "../src/lib/fixtures";
import { ensureLocalDemoUsers } from "../src/lib/repo/seed";

loadEnv();
const command = process.argv[2] ?? "setup";
const url = process.env.DATABASE_URL || null;

/**
 * Hosted mode: make sure the three demo users exist in Supabase Auth (fixed ids) with profiles.
 * They get long random passwords nobody knows — demo visitors never sign in to Supabase as them;
 * demo access is checked by CareSignal's server against the public demo credentials instead.
 */
async function ensureHostedDemoUsers(db: Awaited<ReturnType<typeof createDatabase>>) {
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supaUrl || !serviceKey) {
    console.log("Skipping demo users: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set.");
    return;
  }
  const { createClient } = await import("@supabase/supabase-js");
  const { randomBytes } = await import("node:crypto");
  const admin = createClient(supaUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }).auth.admin;
  for (const f of SEED_CASES) {
    const existing = await admin.getUserById(f.demoAccount.userId);
    if (!existing.data.user) {
      const { error } = await admin.createUser({
        id: f.demoAccount.userId,
        email: f.demoAccount.email,
        password: randomBytes(32).toString("base64url"),
        email_confirm: true,
        user_metadata: { demo: true },
      } as Parameters<typeof admin.createUser>[0]);
      if (error) throw new Error(`could not create demo user ${f.demoAccount.username}: ${error.message}`);
    }
    await db.asAdmin((sql) =>
      sql.query(
        `insert into profiles (user_id, display_name, username, account_kind) values ($1, $2, $3, 'demo')
         on conflict (user_id) do update set display_name = excluded.display_name, username = excluded.username, account_kind = 'demo'`,
        [f.demoAccount.userId, f.demoAccount.displayName, f.demoAccount.username],
      ),
    );
  }
  console.log(`Hosted demo accounts ready: ${SEED_CASES.map((c) => c.demoAccount.username).join(", ")}`);
}

async function setup() {
  const db = await createDatabase({ url });
  const applied = await migrate(db);
  if (db.driver === "pglite") await ensureLocalDemoUsers(db, SEED_CASES);
  else await ensureHostedDemoUsers(db);
  console.log(`Driver: ${db.driver === "pglite" ? `PGlite (local, ${localDataDir()})` : "Postgres (DATABASE_URL)"}`);
  console.log(applied.length ? `Applied: ${applied.join(", ")}` : "Migrations already up to date.");
  if (db.driver === "pglite") console.log(`Demo accounts ready: ${SEED_CASES.map((c) => c.demoAccount.username).join(", ")}`);
  await db.close();
}

async function status() {
  const db = await createDatabase({ url });
  await db.asAdmin(async (sql) => {
    const migs = await sql.query<{ name: string }>("select name from schema_migrations order by name").catch(() => []);
    console.log(`Driver: ${db.driver}`);
    console.log(`Migrations: ${migs.map((m) => m.name).join(", ") || "none"}`);
    for (const t of ["cases", "observations", "safety_alerts", "checkins", "handoffs", "receiver_records", "usage_log"]) {
      const [{ n }] = await sql.query<{ n: number }>(`select count(*)::int as n from ${t}`).catch(() => [{ n: -1 }]);
      console.log(`  ${t.padEnd(18)} ${n === -1 ? "(missing)" : n}`);
    }
  });
  await db.close();
}

async function reset() {
  if (url) {
    console.error("db:reset only resets the LOCAL database. For hosted mode, demo visitors reset their own copy in the app.");
    process.exit(1);
  }
  const dir = localDataDir();
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
  console.log("Local database deleted. Rebuilding known starting state...");
  await setup();
  console.log("Done. Demo copies are created fresh when a visitor opens a demo case, with dates relative to that moment.");
}

const commands: Record<string, () => Promise<void>> = { setup, status, reset };
if (!commands[command]) {
  console.error(`Unknown command "${command}". Use setup | status | reset.`);
  process.exit(1);
}
commands[command]().catch((err) => {
  console.error(`Database ${command} failed: ${err instanceof Error ? err.message : "unknown error"}`);
  process.exit(1);
});
