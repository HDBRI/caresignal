import { afterAll, describe, expect, it } from "vitest";
import cases from "./fixtures/safety-cases.json";
import { NO_MATCH_MESSAGE, SAFETY_LIMITATION, evaluateSafety } from "@/lib/safety/rules";

/** Denominator report printed after the run — used as evidence in the report's Safety section. */
const tally: Record<string, { pass: number; total: number }> = {};
function record(group: string, ok: boolean) {
  tally[group] ??= { pass: 0, total: 0 };
  tally[group].total += 1;
  if (ok) tally[group].pass += 1;
}

describe("deterministic safety rules (predefined synthetic test set)", () => {
  it.each(cases.emergency)("emergency: %s", (text) => {
    const r = evaluateSafety(text);
    record("emergency caught", r.tier === "emergency");
    expect(r.tier).toBe("emergency");
  });

  it.each(cases.contact_care_team)("contact care team: %s", (text) => {
    const r = evaluateSafety(text);
    record("contact-care-team caught", r.tier === "contact_care_team");
    expect(r.tier).toBe("contact_care_team");
  });

  it.each(cases.review)("review: %s", (text) => {
    const r = evaluateSafety(text);
    record("review caught", r.tier === "review");
    expect(r.tier).toBe("review");
  });

  it.each(cases.routine)("routine (no alert expected): %s", (text) => {
    const r = evaluateSafety(text);
    record("routine with no false alarm", r.tier === null);
    expect(r.tier).toBeNull();
  });

  it.each(cases.negated)("negated (no alert expected): %s", (text) => {
    const r = evaluateSafety(text);
    record("negated with no false alarm", r.tier === null);
    expect(r.tier).toBeNull();
  });

  it.each(cases.known_misses)("documented known miss: %s", (text) => {
    // These phrasings are NOT caught. The test pins that fact so the limitation stays documented.
    const r = evaluateSafety(text);
    record("known misses (documented, not caught)", r.tier === null);
    expect(r.tier).toBeNull();
  });

  it("Case 2 urgent note triggers emergency with both rules", () => {
    const r = evaluateSafety("Hard to wake him this morning and his breathing seemed difficult");
    expect(r.tier).toBe("emergency");
    expect(r.matches.map((m) => m.ruleId).sort()).toEqual(["EMG-BREATHING", "EMG-HARD-TO-WAKE"]);
  });

  it("runs with no network or AI (pure function, no key needed)", () => {
    const saved = process.env.PORTKEY_API_KEY;
    delete process.env.PORTKEY_API_KEY;
    expect(evaluateSafety("She is having difficulty breathing").tier).toBe("emergency");
    if (saved !== undefined) process.env.PORTKEY_API_KEY = saved;
  });

  it("limitation copy never claims safety", () => {
    for (const s of [SAFETY_LIMITATION, NO_MATCH_MESSAGE]) {
      expect(s.toLowerCase()).toContain("does not mean");
    }
  });

  afterAll(() => {
    const lines = Object.entries(tally).map(([g, t]) => `  ${g}: ${t.pass}/${t.total}`);
    console.log(`\nSafety rule test set (synthetic phrases):\n${lines.join("\n")}\n`);
  });
});
