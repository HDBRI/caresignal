import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadEnv } from "@/lib/env";

const KEY = "CARESIGNAL_TEST_KEY";
const ONLY_PARENT = "CARESIGNAL_TEST_PARENT_ONLY";

describe("env loading (project folder first, then parent)", () => {
  let root: string;
  let project: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "caresignal-env-"));
    project = path.join(root, "project");
    fs.mkdirSync(project);
    delete process.env[KEY];
    delete process.env[ONLY_PARENT];
  });
  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
    delete process.env[KEY];
    delete process.env[ONLY_PARENT];
  });

  it("prefers the project .env over the parent .env", () => {
    fs.writeFileSync(path.join(project, ".env"), `${KEY}=from-project\n`);
    fs.writeFileSync(path.join(root, ".env"), `${KEY}=from-parent\n${ONLY_PARENT}=parent-value\n`);
    loadEnv(project, true);
    expect(process.env[KEY]).toBe("from-project");
    expect(process.env[ONLY_PARENT]).toBe("parent-value");
  });

  it("falls back to the parent .env when the project has none", () => {
    fs.writeFileSync(path.join(root, ".env"), `${KEY}=from-parent\n`);
    const report = loadEnv(project, true);
    expect(process.env[KEY]).toBe("from-parent");
    expect(report.filesChecked.map((f) => f.found)).toEqual([false, true]);
  });

  it("never overrides a value already set in the real environment", () => {
    process.env[KEY] = "from-host";
    fs.writeFileSync(path.join(project, ".env"), `${KEY}=from-project\n`);
    loadEnv(project, true);
    expect(process.env[KEY]).toBe("from-host");
  });

  it("report contains presence flags only, never secret values", () => {
    fs.writeFileSync(path.join(project, ".env"), `PORTKEY_API_KEY=super-secret-value-123\n`);
    const saved = process.env.PORTKEY_API_KEY;
    delete process.env.PORTKEY_API_KEY;
    const report = loadEnv(project, true);
    expect(JSON.stringify(report)).not.toContain("super-secret-value-123");
    expect(report.keysPresent.PORTKEY_API_KEY).toBe(true);
    if (saved === undefined) delete process.env.PORTKEY_API_KEY;
    else process.env.PORTKEY_API_KEY = saved;
  });
});

describe("tests never use the live database", () => {
  it("DATABASE_URL and Supabase keys are blank inside the test run, even though .env has them", async () => {
    const { loadEnv } = await import("@/lib/env");
    loadEnv(process.cwd(), true);
    expect(process.env.DATABASE_URL).toBe("");
    expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBe("");
  });
});
