import { describe, expect, it } from "vitest";
import { CATEGORY_IDS } from "@/lib/categories";
import { EVALUATION_CASES, SEED_CASES } from "@/lib/fixtures";
import { evaluateSafety } from "@/lib/safety/rules";

const allObs = SEED_CASES.flatMap((c) => c.observations.map((o) => ({ ...o, seedKey: c.seedKey })));

describe("synthetic data package", () => {
  it("has exactly the three locked cases with the locked names and IDs", () => {
    expect(SEED_CASES.map((c) => [c.seedKey, c.patient.patientRef, c.patient.pseudonym])).toEqual([
      ["PAT-CANCER-001", "PAT-CANCER-001", "Jordan Lee"],
      ["PAT-SURGERY-002", "PAT-SURGERY-002", "Morgan Patel"],
      ["PAT-RECOVERY-003", "PAT-RECOVERY-003", "Alex Rivera"],
    ]);
  });

  it("marks every patient, observation, check-in, handoff and receiver response synthetic", () => {
    for (const c of SEED_CASES) {
      expect(c.synthetic).toBe(true);
      expect(c.patient.synthetic).toBe(true);
      expect(c.handoff.synthetic).toBe(true);
      for (const o of c.observations) expect(o.synthetic).toBe(true);
      for (const ci of c.checkins) expect(ci.synthetic).toBe(true);
      if (c.handoff.receiverResponse) expect(c.handoff.receiverResponse.synthetic).toBe(true);
      expect(c.patient.careContext.startsWith("Fictional.")).toBe(true);
    }
  });

  it("has at least 15 observations and covers all seven categories", () => {
    expect(allObs.length).toBeGreaterThanOrEqual(15);
    const used = new Set(allObs.flatMap((o) => [o.expected.primaryCategory, ...o.expected.secondaryCategories]));
    expect([...used].sort()).toEqual([...CATEGORY_IDS].sort());
  });

  it("uses unique observation IDs and unique demo accounts", () => {
    const ids = allObs.map((o) => o.fixtureId);
    expect(new Set(ids).size).toBe(ids.length);
    const accounts = SEED_CASES.map((c) => c.demoAccount.userId);
    expect(new Set(accounts).size).toBe(3);
    expect(new Set(EVALUATION_CASES.map((e) => e.id)).size).toBe(EVALUATION_CASES.length);
  });

  it("observation IDs belong to their own case (C1/C2/C3 prefix)", () => {
    for (const [i, c] of SEED_CASES.entries()) {
      for (const o of c.observations) expect(o.fixtureId.startsWith(`OBS-C${i + 1}-`)).toBe(true);
    }
  });

  it("every source reference resolves to an observation in the same case", () => {
    for (const c of SEED_CASES) {
      const ids = new Set(c.observations.map((o) => o.fixtureId));
      const refs = [
        ...c.handoff.content.items.flatMap((i) => i.sourceIds),
        ...c.handoff.content.questions.flatMap((q) => q.sourceIds),
        ...c.expectedOutcome.supported.flatMap((s) => s.sourceIds),
        ...c.expectedOutcome.possibleUnconfirmed.flatMap((s) => s.sourceIds),
        ...c.expectedOutcome.conflicts.flat(),
        ...(c.expectedOutcome.urgent ? [c.expectedOutcome.urgent.sourceId] : []),
      ];
      for (const r of refs) expect(ids, `${c.seedKey} -> ${r}`).toContain(r);
    }
    for (const e of EVALUATION_CASES.filter((e) => e.kind === "case")) {
      const c = SEED_CASES.find((s) => s.seedKey === e.seedKey)!;
      expect(c, e.id).toBeDefined();
      const ids = new Set(c.observations.map((o) => o.fixtureId));
      const expected = e.expected as { mustMentionSourceIds?: string[]; mustKeepConflict?: string[][] };
      for (const r of [...(expected.mustMentionSourceIds ?? []), ...(expected.mustKeepConflict ?? []).flat()]) {
        expect(ids, `${e.id} -> ${r}`).toContain(r);
      }
    }
  });

  it("expected safety tiers match the deterministic rules exactly", () => {
    for (const o of allObs) {
      expect(evaluateSafety(o.text).tier ?? "none", o.fixtureId).toBe(o.expected.safetyTier);
    }
    for (const e of EVALUATION_CASES.filter((e) => e.kind === "observation")) {
      const tier = (e.expected as { safetyTier?: string }).safetyTier;
      if (tier) expect(evaluateSafety(e.text!).tier ?? "none", e.id).toBe(tier);
    }
  });

  it("Case 2 urgent scenario is a flagged synthetic test scenario caught by both emergency rules", () => {
    const c2 = SEED_CASES[1];
    const urgent = c2.observations.find((o) => o.isTestScenario)!;
    expect(urgent.fixtureId).toBe(c2.expectedOutcome.urgent!.sourceId);
    const r = evaluateSafety(urgent.text);
    expect(r.tier).toBe("emergency");
    expect(r.matches.map((m) => m.ruleId).sort()).toEqual([...c2.expectedOutcome.urgent!.ruleIds].sort());
    expect(c2.observations.filter((o) => o.isTestScenario)).toHaveLength(1);
  });

  it("includes every required note type", () => {
    const tags = new Set(allObs.flatMap((o) => o.expected.tags));
    for (const t of ["ordinary", "multi_category", "ambiguous", "conflicting_report", "missing_context", "routine_safety_example", "urgent_scenario"]) {
      expect(tags, t).toContain(t);
    }
    expect(EVALUATION_CASES.some((e) => e.id.startsWith("EVAL-INJECT"))).toBe(true);
  });

  it("Case 3 keeps the meal conflict and lists unknowns", () => {
    const c3 = SEED_CASES[2];
    expect(c3.expectedOutcome.conflicts).toContainEqual(["OBS-C3-06", "OBS-C3-07"]);
    const conflictItem = c3.handoff.content.items.find((i) => i.support === "conflicting")!;
    expect(conflictItem.sourceIds.sort()).toEqual(["OBS-C3-06", "OBS-C3-07"]);
    expect(c3.observations.find((o) => o.fixtureId === "OBS-C3-07")!.eventTime).toBeNull();
    expect(c3.expectedOutcome.unknowns.length).toBeGreaterThan(0);
  });

  it("Case 1 clinician response is labeled fictional and contains no drug names or doses", () => {
    const r = SEED_CASES[0].handoff.receiverResponse!;
    expect(r.text).toBe("In this fictional scenario, the care team reviewed the handoff and adjusted the plan.");
    expect(r.label).toBe("Simulated scenario outcome — not an AI recommendation or a real clinical event.");
    expect(r.text).not.toMatch(/\d+\s?(mg|mcg|ml|units?)\b/i);
    expect(r.text).not.toMatch(/\b(dose|dosage|increase|decrease|stop|start|prescrib\w*|chemo\w*|tablet|pill)\b/i);
  });

  it("seeded text never claims safety or a cause", () => {
    const banned = /\b(patient is safe|all clear|no risk|no action needed|caused by|because of the (medication|pill|chemo))\b/i;
    for (const c of SEED_CASES) {
      const text = JSON.stringify([c.handoff.content, c.handoff.receiverResponse, c.observations.map((o) => o.text)]);
      expect(text).not.toMatch(banned);
    }
  });

  it("no seeded note is in the future relative to its anchor", () => {
    for (const o of allObs) {
      expect(o.at.dayOffset).toBeLessThanOrEqual(-1);
      if (o.eventTime) expect(o.eventTime.dayOffset).toBeLessThanOrEqual(o.at.dayOffset);
    }
  });
});
