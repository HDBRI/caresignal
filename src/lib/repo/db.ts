/**
 * App-wide database handle (server only). Hosted: DATABASE_URL (Supabase Postgres).
 * Local: PGlite in data/pgdata, migrated and bootstrapped automatically on first use.
 */
import "server-only";
import "../config";
import { createDatabase, type Database } from "../db/client";
import { migrate } from "../db/migrate";
import { SEED_CASES } from "../fixtures";
import { ensureLocalDemoUsers } from "./seed";

const globalForDb = globalThis as unknown as { __caresignalDb?: Promise<Database> };

async function init(): Promise<Database> {
  const db = await createDatabase({ url: process.env.DATABASE_URL || null });
  await migrate(db);
  if (db.driver === "pglite") await ensureLocalDemoUsers(db, SEED_CASES);
  return db;
}

export function getDb(): Promise<Database> {
  globalForDb.__caresignalDb ??= init();
  return globalForDb.__caresignalDb;
}
