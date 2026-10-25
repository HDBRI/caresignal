/**
 * Environment loading for CareSignal (server-side only).
 *
 * Order: `.env` in the project folder first, then `.env` in the parent folder.
 * A value found earlier is never overwritten by a later file, and values already
 * set in the real environment (e.g. on the hosting platform) always win.
 *
 * This module never prints or returns secret values. `describeEnv()` reports
 * only file paths and whether each expected key is present.
 */
import fs from "node:fs";
import path from "node:path";
import { parse } from "dotenv";

export const EXPECTED_KEYS = [
  "PORTKEY_API_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
  "AI_DAILY_LIMIT_PER_USER",
  "AI_DAILY_LIMIT_GLOBAL",
] as const;

export interface EnvLoadReport {
  filesChecked: { path: string; found: boolean }[];
  keysPresent: Record<string, boolean>;
}

let loaded = false;
let lastReport: EnvLoadReport | null = null;

export function envFileCandidates(projectDir: string = process.cwd()): string[] {
  return [path.join(projectDir, ".env"), path.join(projectDir, "..", ".env")];
}

/** Load .env files into process.env without overriding existing values. Idempotent. */
export function loadEnv(projectDir: string = process.cwd(), force = false): EnvLoadReport {
  if (loaded && !force && lastReport) return lastReport;

  const filesChecked: EnvLoadReport["filesChecked"] = [];
  for (const file of envFileCandidates(projectDir)) {
    const found = fs.existsSync(/*turbopackIgnore: true*/ file);
    filesChecked.push({ path: file, found });
    if (!found) continue;
    const parsed = parse(fs.readFileSync(/*turbopackIgnore: true*/ file));
    for (const [key, value] of Object.entries(parsed)) {
      // Only fill unset variables. An explicitly empty value (e.g. tests blanking DATABASE_URL) is respected.
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }

  loaded = true;
  lastReport = { filesChecked, keysPresent: keysPresent() };
  return lastReport;
}

export function keysPresent(): Record<string, boolean> {
  return Object.fromEntries(EXPECTED_KEYS.map((k) => [k, Boolean(process.env[k]?.trim())]));
}
