/** Server-side configuration. Import only from server code (route handlers, server components, scripts). */
import "server-only";
import { loadEnv } from "./env";

loadEnv();

/** Course-required model. Never switched silently. */
export const MODEL_NAME = "gpt-6-luna";
export const PORTKEY_BASE_URL = "https://api.portkey.ai/v1";
export const AI_TIMEOUT_MS = 20_000;

/** Documented defaults; override with env vars. See docs/IMPLEMENTATION_PLAN.md D3. */
export const DEFAULT_AI_DAILY_LIMIT_PER_USER = 25;
export const DEFAULT_AI_DAILY_LIMIT_GLOBAL = 500;

function positiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export function aiLimits() {
  return {
    perUser: positiveInt(process.env.AI_DAILY_LIMIT_PER_USER, DEFAULT_AI_DAILY_LIMIT_PER_USER),
    global: positiveInt(process.env.AI_DAILY_LIMIT_GLOBAL, DEFAULT_AI_DAILY_LIMIT_GLOBAL),
  };
}

/** "hosted" (Supabase Postgres via DATABASE_URL) or "local" (PGlite Postgres in data/pgdata). */
export function dataBackend(): "hosted" | "local" {
  return process.env.DATABASE_URL ? "hosted" : "local";
}
