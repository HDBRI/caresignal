import { afterEach, describe, expect, it } from "vitest";
import type { Database } from "@/lib/db/client";
import { DEFAULT_DEMO_PASSWORD, demoCredentials, verifyDemoCredentials } from "@/lib/auth/demo";
import { resolveDemoSession } from "@/lib/auth/session";
import { createUserCase, listCases } from "@/lib/repo/cases";
import { listObservations } from "@/lib/repo/observations";
import { startDemoSession } from "@/lib/repo/seed";
import { freshDb, registeredUser } from "./helpers/db";

let db: Database;
afterEach(async () => {
  await db?.close();
  db = undefined as unknown as Database;
});

describe("demo credentials", () => {
  it("there are exactly three, one per seeded case, all with the documented password", () => {
    const creds = demoCredentials();
    expect(creds.map((c) => [c.username, c.seedKey])).toEqual([
      ["demo-cancer", "PAT-CANCER-001"],
      ["demo-surgery", "PAT-SURGERY-002"],
      ["demo-recovery", "PAT-RECOVERY-003"],
    ]);
    expect(new Set(creds.map((c) => c.password))).toEqual(new Set([DEFAULT_DEMO_PASSWORD]));
  });

  it("each username maps to its own case; wrong password or unknown username fails", () => {
    expect(verifyDemoCredentials("demo-cancer", DEFAULT_DEMO_PASSWORD)?.seedKey).toBe("PAT-CANCER-001");
    expect(verifyDemoCredentials(" Demo-Surgery ", DEFAULT_DEMO_PASSWORD)?.seedKey).toBe("PAT-SURGERY-002");
    expect(verifyDemoCredentials("demo-recovery", DEFAULT_DEMO_PASSWORD)?.seedKey).toBe("PAT-RECOVERY-003");
    expect(verifyDemoCredentials("demo-cancer", "wrong")).toBeNull();
    expect(verifyDemoCredentials("demo-cancer", "")).toBeNull();
    expect(verifyDemoCredentials("someone", DEFAULT_DEMO_PASSWORD)).toBeNull();
  });

  it("DEMO_PASSWORD overrides the default for a deployment", () => {
    process.env.DEMO_PASSWORD = "Another-Demo-Pass-9";
    expect(verifyDemoCredentials("demo-cancer", DEFAULT_DEMO_PASSWORD)).toBeNull();
    expect(verifyDemoCredentials("demo-cancer", "Another-Demo-Pass-9")?.seedKey).toBe("PAT-CANCER-001");
    delete process.env.DEMO_PASSWORD;
  });
});

describe("demo sessions (cookie -> principal)", () => {
  it("a valid demo-session cookie resolves to that visitor's demo copy only", async () => {
    db = await freshDb();
    const fixture = verifyDemoCredentials("demo-surgery", DEFAULT_DEMO_PASSWORD)!;
    const { demoSessionId, caseId } = await startDemoSession(db, fixture.demoAccount.userId, fixture.seedKey);
    const resolved = await resolveDemoSession(db, demoSessionId);
    expect(resolved).toMatchObject({ userId: fixture.demoAccount.userId, demoSessionId, seedKey: "PAT-SURGERY-002" });
    const cases = await listCases(db, { userId: resolved!.userId, demoSessionId });
    expect(cases.map((c) => c.id)).toEqual([caseId]);
    expect(cases[0].kind).toBe("demo_copy");
    expect(await listObservations(db, { userId: resolved!.userId, demoSessionId }, caseId)).toHaveLength(8);
  });

  it("garbage, unknown or malformed cookies resolve to nobody", async () => {
    db = await freshDb();
    expect(await resolveDemoSession(db, undefined)).toBeNull();
    expect(await resolveDemoSession(db, "not-a-uuid")).toBeNull();
    expect(await resolveDemoSession(db, "' or 1=1 --")).toBeNull();
    expect(await resolveDemoSession(db, crypto.randomUUID())).toBeNull();
  });

  it("demo visitors cannot create private cases", async () => {
    db = await freshDb();
    const f = verifyDemoCredentials("demo-cancer", DEFAULT_DEMO_PASSWORD)!;
    const s = await startDemoSession(db, f.demoAccount.userId, f.seedKey);
    await expect(createUserCase(db, { userId: f.demoAccount.userId, demoSessionId: s.demoSessionId }, { pseudonym: "x" })).rejects.toThrow();
  });

  it("a registered user's id can never be reached through a demo cookie", async () => {
    db = await freshDb();
    const user = await registeredUser(db);
    const c = await createUserCase(db, user, { pseudonym: "Mine" });
    // Even if someone forged a demo_sessions row id, it must join to a *demo* profile.
    await db.asAdmin((sql) => sql.query(`insert into demo_sessions (id, owner_id, seed_key) values ($1, $2, 'PAT-CANCER-001')`, [c.id, user.userId]));
    expect(await resolveDemoSession(db, c.id)).toBeNull();
  });
});
