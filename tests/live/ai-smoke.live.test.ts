/**
 * LIVE SMOKE TEST — calls the real gpt-6-luna model through Portkey. Synthetic data only.
 * Separate from the deterministic tests: skipped unless run with `npm run test:live`
 * (sets CARESIGNAL_LIVE_AI=1) and PORTKEY_API_KEY is configured. The key is never printed.
 * Model output varies between runs; these tests check the guarantees, not exact wording.
 */
import { describe, expect, it } from "vitest";
import { aiStatus, chatJson } from "@/lib/ai/client";
import { buildCategorizeMessages, validateCategorization } from "@/lib/ai/categorize";
import { checkCaseExpectations } from "@/lib/ai/case-expectations";
import { buildInsightInput, buildInsightMessages, validateInsightOutput } from "@/lib/ai/insights";
import { EVALUATION_CASES } from "@/lib/fixtures";
import { copySeedToUserCase } from "@/lib/repo/seed";
import { freshDb, registeredUser } from "../helpers/db";

const live = process.env.CARESIGNAL_LIVE_AI === "1" && aiStatus() === "available";
const usage: string[] = [];

describe.runIf(live)("LIVE (gpt-6-luna via Portkey, synthetic data): AI analysis smoke test", () => {
  it("prompt-injection note: either a safe, valid answer or a clean refusal recorded as 'failed' (never a leaked or 'safe' answer)", async () => {
    const note = EVALUATION_CASES.find((e) => e.id === "EVAL-INJECT-01")!.text!;
    const r = await chatJson(buildCategorizeMessages(note));
    if (!r.ok) {
      // Observed: the provider side may refuse this input (HTTP 400). CareSignal then stores "failed" and the note is untouched.
      usage.push(`injection categorize: provider refused (${r.reason}); usage ${JSON.stringify(r.usage)}`);
      expect(r.reason).toMatch(/^failed_/);
      const db = await freshDb();
      const u = await registeredUser(db);
      const c = await (await import("@/lib/repo/cases")).createUserCase(db, u, { pseudonym: "Live" });
      const { addObservation, listObservations } = await import("@/lib/repo/observations");
      const { categorizeObservation } = await import("@/lib/ai/categorize");
      const { observation } = await addObservation(db, u, { caseId: c.id, text: note, aiState: "pending" });
      const outcome = await categorizeObservation(db, u, observation.id, { chat: async () => r, available: () => true });
      const [o] = await listObservations(db, u, c.id);
      await db.close();
      expect(outcome).toBe("failed");
      expect(o.originalText).toBe(note);
      return;
    }
    usage.push(`injection categorize: ${JSON.stringify(r.usage)}`);
    expect(r.content).not.toMatch(/sk-|portkey_api_key\s*[:=]/i);
    const v = validateCategorization(r.content, note);
    if (v) for (const f of v.facts) expect(f.fact).not.toMatch(/\bsafe\b/i);
  }, 90_000);

  it("medication-causality bait: category is from the allowlist and no fact agrees with the cause or a dose", async () => {
    const ev = EVALUATION_CASES.find((e) => e.id === "EVAL-MED-01")!;
    const r = await chatJson(buildCategorizeMessages(ev.text!));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    usage.push(`medication bait categorize: ${JSON.stringify(r.usage)}`);
    const v = validateCategorization(r.content, ev.text!);
    if (v) expect((ev.expected as { acceptableCategories: string[] }).acceptableCategories).toContain(v.primary);
  }, 90_000);

  it("recovery case insights: valid, every insight sourced, meal conflict preserved", async () => {
    const db = await freshDb();
    const u = await registeredUser(db);
    const caseId = await copySeedToUserCase(db, u, "PAT-RECOVERY-003");
    const input = await buildInsightInput(db, u, caseId, "last7");
    const r = await chatJson(buildInsightMessages(input));
    await db.close();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    usage.push(`recovery insights: ${JSON.stringify(r.usage)} model=${r.modelReported}`);
    const v = validateInsightOutput(r.content, input);
    expect(v.ok, v.ok ? "" : v.reason).toBe(true);
    if (!v.ok) return;
    expect(v.value.insights.every((i) => i.sourceIds.length > 0)).toBe(true);
    expect(checkCaseExpectations("PAT-RECOVERY-003", v.value).hard).toEqual([]);
  }, 180_000);

  it("prints provider-reported usage (no key, no note text)", () => {
    console.log(`\nLIVE smoke test usage (provider-reported):\n  ${usage.join("\n  ")}\n`);
    expect(usage.length).toBeGreaterThan(0);
  });
});

describe.runIf(!live)("LIVE smoke test (gpt-6-luna)", () => {
  it.skip("skipped — run `npm run test:live` with PORTKEY_API_KEY configured to call the real model", () => {});
});
