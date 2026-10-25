import { randomUUID } from "node:crypto";
import { createDatabase, type Database, type Principal } from "@/lib/db/client";
import { migrate } from "@/lib/db/migrate";
import { SEED_CASES } from "@/lib/fixtures";
import { ensureLocalDemoUsers } from "@/lib/repo/seed";

/** Fresh in-memory Postgres (PGlite) with all migrations + demo accounts. */
export async function freshDb(): Promise<Database> {
  const db = await createDatabase({ dataDir: null });
  await migrate(db);
  await ensureLocalDemoUsers(db, SEED_CASES);
  return db;
}

/** Create a registered (non-demo) user and return their principal. */
export async function registeredUser(db: Database, name = "Test User"): Promise<Principal> {
  const id = randomUUID();
  await db.asAdmin(async (sql) => {
    await sql.query(`insert into auth.users (id, email) values ($1, $2)`, [id, `${id}@example.test`]);
    await sql.query(`insert into profiles (user_id, display_name, account_kind) values ($1, $2, 'registered')`, [id, name]);
  });
  return { userId: id, demoSessionId: null };
}

export const demoUserId = (seedKey: string) => SEED_CASES.find((c) => c.seedKey === seedKey)!.demoAccount.userId;

/** Fixed anchor so seeded timestamps are reproducible in tests. */
export const ANCHOR = new Date("2026-10-20T16:00:00Z");
