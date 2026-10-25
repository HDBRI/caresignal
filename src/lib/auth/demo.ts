/**
 * Shared demo access. NOT secure personal authentication — these credentials are public
 * (README + "Demo access" panel) and only open a fresh, private copy of a synthetic case.
 *
 * Demo visitors never receive a Supabase session, so they cannot change the shared
 * demo password, delete the demo account, or reach registered users' data.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { SEED_CASES, seedCaseByUsername, type CaseFixture } from "../fixtures";

/** Public demo password (documented). Can be changed per deployment with DEMO_PASSWORD. */
export const DEFAULT_DEMO_PASSWORD = "CareSignal-Demo-2026";

export function demoPassword(): string {
  return process.env.DEMO_PASSWORD?.trim() || DEFAULT_DEMO_PASSWORD;
}

export interface DemoCredential {
  username: string;
  password: string;
  seedKey: string;
  title: string;
  pseudonym: string;
}

export function demoCredentials(): DemoCredential[] {
  return SEED_CASES.map((c) => ({
    username: c.demoAccount.username,
    password: demoPassword(),
    seedKey: c.seedKey,
    title: c.title,
    pseudonym: c.patient.pseudonym,
  }));
}

const digest = (s: string) => createHash("sha256").update(s, "utf8").digest();

/** Returns the matching case fixture, or null. Constant-time password comparison. */
export function verifyDemoCredentials(username: string, password: string): CaseFixture | null {
  const fixture = seedCaseByUsername(username ?? "");
  const ok = timingSafeEqual(digest(password ?? ""), digest(demoPassword()));
  return fixture && ok ? fixture : null;
}
