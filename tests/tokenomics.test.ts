/**
 * Task 17: usage accounting, missing usage fields, estimate calculations, and caching / invalidation.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import costAssumptions from "../config/cost-assumptions.json";
import { readUsage, type AiResult, type ChatMessage } from "@/lib/ai/client";
import { categorizeObservation } from "@/lib/ai/categorize";
import { buildHandoffDraft } from "@/lib/ai/handoff";
import { generateInsights, MAX_INSIGHT_NOTE_CHARS, buildInsightInput } from "@/lib/ai/insights";
import type { Database } from "@/lib/db/client";
import { createUserCase } from "@/lib/repo/cases";
import { addObservation, addObservationEdit } from "@/lib/repo/observations";
import { recordUsage, usageSummary } from "@/lib/repo/usage";
import { callCostUsd, estimateForUsers, measuredAverages, perUserMonthly, type Pricing, type UsageAssumptions } from "@/lib/tokenomics";
import { freshDb, registeredUser } from "./helpers/db";

let db: Database;
afterEach(async () => {
  await db?.close();
  db = undefined as unknown as Database;
});

const usage = { promptTokens: 400, cachedTokens: 0, completionTokens: 150, totalTokens: 550 };

describe("usage accounting", () => {
  it("records every attempted request with its task type; tokens exactly as reported; scoped by owner and case", async () => {
    db = await freshDb();
    const u = await registeredUser(db);
    const other = await registeredUser(db, "Other");
    const c = await createUserCase(db, u, { pseudonym: "Fictional" });
    const base = { ownerId: u.userId, caseId: c.id, modelRequested: "gpt-6-luna", modelReported: "gpt-6-luna-x", providerRequestId: null, latencyMs: 10 };
    await recordUsage(db, { ...base, purpose: "observation_analysis", status: "complete", usage });
    await recordUsage(db, { ...base, purpose: "observation_analysis", status: "complete", usage });
    await recordUsage(db, { ...base, purpose: "insights", status: "complete", usage: { ...usage, promptTokens: 1000, completionTokens: 2000, reasoningTokens: 1500 } });
    await recordUsage(db, { ...base, purpose: "handoff_draft", status: "failed", usage: null, failureReason: "failed_timeout" });
    await recordUsage(db, { ...base, ownerId: other.userId, purpose: "insights", status: "complete", usage });

    const rows = await usageSummary(db, { ownerId: u.userId, caseId: c.id });
    const by = Object.fromEntries(rows.map((r) => [r.purpose, r]));
    expect(by.observation_analysis).toMatchObject({ requests: 2, withUsage: 2, promptTokens: 800, completionTokens: 300 });
    expect(by.insights).toMatchObject({ requests: 1, promptTokens: 1000, completionTokens: 2000, reasoningTokens: 1500 });
    expect(by.handoff_draft).toMatchObject({ requests: 1, withUsage: 0, promptTokens: null, completionTokens: null }); // counted, not guessed
    expect(rows.every((r) => r.providerCostUsd === null)).toBe(true); // no provider cost -> none invented
    expect((await usageSummary(db, { ownerId: other.userId })).map((r) => r.requests)).toEqual([1]);
  });

  it("no row when no request was sent (no API key configured)", async () => {
    db = await freshDb();
    const u = await registeredUser(db);
    const id = await recordUsage(db, { ownerId: u.userId, caseId: null, purpose: "insights", status: "failed", modelRequested: "gpt-6-luna", modelReported: null, providerRequestId: null, usage: null, latencyMs: 0, failureReason: "unavailable_missing_key" });
    expect(id).toBeNull();
    expect(await usageSummary(db, { ownerId: u.userId })).toEqual([]);
  });

  it("stores no note text, prompt or key in usage rows", async () => {
    db = await freshDb();
    const u = await registeredUser(db);
    const c = await createUserCase(db, u, { pseudonym: "Fictional" });
    await recordUsage(db, { ownerId: u.userId, caseId: c.id, purpose: "insights", status: "complete", modelRequested: "gpt-6-luna", modelReported: null, providerRequestId: "req-1", usage, latencyMs: 5 });
    const [row] = await db.asAdmin((sql) => sql.query(`select * from usage_log`));
    expect(Object.keys(row).sort()).toEqual(
      ["cached_tokens", "case_id", "completion_tokens", "created_at", "failure_reason", "id", "latency_ms", "model_reported", "model_requested", "owner_id", "prompt_tokens", "provider_cost_usd", "provider_request_id", "purpose", "reasoning_tokens", "status", "total_tokens", "usage_reported"].sort(),
    );
  });
});

describe("missing usage fields", () => {
  it("keeps anything the provider did not return as null — never 0, never estimated", () => {
    expect(readUsage(null)).toBeNull();
    expect(readUsage(undefined)).toBeNull();
    expect(readUsage({})).toEqual({ promptTokens: null, cachedTokens: null, completionTokens: null, totalTokens: null, reasoningTokens: null, costUsd: null });
    expect(readUsage({ prompt_tokens: 12, completion_tokens: "7" })).toMatchObject({ promptTokens: 12, completionTokens: null });
    expect(readUsage({ prompt_tokens: 1, completion_tokens: 2, total_tokens: 3, completion_tokens_details: { reasoning_tokens: 1 } })).toMatchObject({ reasoningTokens: 1, costUsd: null });
    expect(readUsage({ prompt_tokens: 1, completion_tokens: 2, total_tokens: 3, cost: 0.00042 })!.costUsd).toBe(0.00042); // only if the provider sends it
  });

  it("averages only calls that reported usage", () => {
    const avg = measuredAverages([
      { purpose: "categorize", promptTokens: 400, completionTokens: 100 },
      { purpose: "categorize", promptTokens: null, completionTokens: null },
      { purpose: "categorize", promptTokens: 600, completionTokens: 300 },
    ]);
    expect(avg.categorize).toEqual({ calls: 3, withUsage: 2, avgInput: 500, avgOutput: 200 });
    expect(measuredAverages([{ purpose: "insights", promptTokens: null, completionTokens: null }]).insights).toEqual({ calls: 1, withUsage: 0, avgInput: null, avgOutput: null });
  });
});

describe("estimate calculations (illustrative)", () => {
  const pricing: Pricing = { model: "test", status: "illustrative", inputUsdPerMillionTokens: 1, cachedInputUsdPerMillionTokens: 0.1, outputUsdPerMillionTokens: 10, source: "test", dateChecked: "test" };
  const a: UsageAssumptions = {
    observationsPerUserPerMonth: 10,
    categorizationCallsPerObservation: 1,
    insightRequestsPerUserPerMonth: 4,
    insightCacheHitShare: 0.5,
    handoffDraftsPerUserPerMonth: 2,
    handoffDraftsNeedingNewAiCall: 0.5,
    retryRate: 0.1,
    tokensPerCall: { categorize: { input: 1000, output: 100 }, insights: { input: 2000, output: 1000 } },
  };

  it("cost per call = (input × input price + output × output price) / 1M, with cached input priced separately", () => {
    expect(callCostUsd({ input: 1000, output: 100 }, pricing)).toBeCloseTo(0.002, 10);
    expect(callCostUsd({ input: 1000, output: 100 }, pricing, 1000)).toBeCloseTo(0.0011, 10);
  });

  it("calls per user include retries and exclude cache hits / reused handoff runs", () => {
    const per = perUserMonthly(a, pricing);
    expect(per.map((t) => +t.callsPerUser.toFixed(4))).toEqual([11, 2.2, 1.1]);
    expect(per.reduce((n, t) => n + t.costPerUserUsd, 0)).toBeCloseTo(0.0616, 10);
  });

  it("scales linearly to 100 and 10,000 users", () => {
    expect(estimateForUsers(100, a, pricing).costPerMonthUsd).toBeCloseTo(6.16, 6);
    expect(estimateForUsers(10_000, a, pricing).costPerMonthUsd).toBeCloseTo(616, 6);
    expect(estimateForUsers(100, a, pricing).callsPerMonth).toBeCloseTo(1430, 6);
  });

  it("the shipped assumptions are labeled illustrative and state their source", () => {
    expect(costAssumptions.pricing.status).toBe("illustrative");
    expect(costAssumptions.pricing.source).toMatch(/not a verified price/i);
    expect(costAssumptions.pricing.dateChecked).toMatch(/not verified/i);
  });
});

/** A valid insights reply citing OBS-0001 (exact quote), used to count calls. */
const insightsReply = async (): Promise<AiResult> => ({
  ok: true,
  content: JSON.stringify({
    summary: "Caregiver logged notes about meals.",
    insights: [
      { kind: "change", statement: "Caregiver reported eating half of dinner.", support: "supported", source_ids: ["OBS-0001"], evidence: [{ source_id: "OBS-0001", quote: "Ate half of dinner" }], uncertainty: null, compares_to_baseline: false },
    ],
    unknowns: [],
    questions: [{ text: "How should meals be tracked?", source_ids: ["OBS-0001"] }],
  }),
  modelReported: "gpt-6-luna-test",
  providerRequestId: null,
  usage,
});

describe("caching and invalidation", () => {
  it("same notes -> cached (no call); new note, wording correction or explicit regeneration -> new call", async () => {
    db = await freshDb();
    const u = await registeredUser(db);
    const c = await createUserCase(db, u, { pseudonym: "Fictional" });
    const { observation } = await addObservation(db, u, { caseId: c.id, text: "Ate half of dinner." });
    const chat = vi.fn(insightsReply);
    const deps = { chat, available: () => true };

    const first = await generateInsights(db, u, c.id, "last7", deps);
    expect(first).toMatchObject({ status: "complete" });
    const second = await generateInsights(db, u, c.id, "last7", deps);
    expect(second).toMatchObject({ status: "complete", cached: true });
    expect(chat).toHaveBeenCalledTimes(1);

    await addObservationEdit(db, u, observation.id, "Ate about half of dinner."); // caregiver corrects the wording
    expect(await generateInsights(db, u, c.id, "last7", deps)).not.toHaveProperty("cached", true);
    expect(chat).toHaveBeenCalledTimes(2);

    await addObservation(db, u, { caseId: c.id, text: "Slept most of the afternoon." }); // new note
    await generateInsights(db, u, c.id, "last7", deps);
    expect(chat).toHaveBeenCalledTimes(3);

    expect((await generateInsights(db, u, c.id, "last7", deps)).status).toBe("complete"); // unchanged -> cached
    expect(chat).toHaveBeenCalledTimes(3);
    await generateInsights(db, u, c.id, "last7", deps, { force: true }); // explicit regeneration
    expect(chat).toHaveBeenCalledTimes(4);

    const [row] = await usageSummary(db, { ownerId: u.userId, caseId: c.id });
    expect(row).toMatchObject({ purpose: "insights", requests: 4 }); // cache hits made no request
  });

  it("never reuses a result across patients, even with identical note text", async () => {
    db = await freshDb();
    const u = await registeredUser(db);
    const other = await registeredUser(db, "Other");
    const a = await createUserCase(db, u, { pseudonym: "Patient A" });
    const b = await createUserCase(db, u, { pseudonym: "Patient B" });
    const x = await createUserCase(db, other, { pseudonym: "Patient X" });
    for (const [p, c] of [[u, a], [u, b], [other, x]] as const) await addObservation(db, p, { caseId: c.id, text: "Ate half of dinner." });
    const chat = vi.fn(insightsReply);
    for (const [p, c] of [[u, a], [u, b], [other, x]] as const) {
      const r = await generateInsights(db, p, c.id, "last7", { chat, available: () => true });
      expect(r).not.toHaveProperty("cached", true);
    }
    expect(chat).toHaveBeenCalledTimes(3);
  });

  it("a completed note analysis is never repeated", async () => {
    db = await freshDb();
    const u = await registeredUser(db);
    const c = await createUserCase(db, u, { pseudonym: "Fictional" });
    const { observation } = await addObservation(db, u, { caseId: c.id, text: "Walked to the mailbox." });
    const chat = vi.fn(async (): Promise<AiResult> => ({
      ok: true,
      content: JSON.stringify({ primary_category: "mobility_daily_functioning", secondary_categories: [], facts: [{ fact: "Caregiver reported a walk to the mailbox.", quote: "Walked to the mailbox" }] }),
      modelReported: "m",
      providerRequestId: null,
      usage,
    }));
    expect(await categorizeObservation(db, u, observation.id, { chat, available: () => true })).toBe("complete");
    expect(await categorizeObservation(db, u, observation.id, { chat, available: () => true })).toBe("complete");
    expect(chat).toHaveBeenCalledTimes(1);
  });

  it("output caps are passed to the provider call", async () => {
    db = await freshDb();
    const u = await registeredUser(db);
    const c = await createUserCase(db, u, { pseudonym: "Fictional" });
    await addObservation(db, u, { caseId: c.id, text: "Ate half of dinner." });
    const chat = vi.fn(async (_m: ChatMessage[], _o?: { maxOutputTokens?: number }) => insightsReply());
    await generateInsights(db, u, c.id, "last7", { chat, available: () => true });
    expect(chat.mock.calls[0][1]).toEqual({ maxOutputTokens: 6000, timeoutMs: 60_000 });
  });

  it("bounded input: older notes beyond the character budget are left out and counted", async () => {
    db = await freshDb();
    const u = await registeredUser(db);
    const c = await createUserCase(db, u, { pseudonym: "Fictional" });
    const long = "Walked slowly around the garden and talked about the weather. ".repeat(60).slice(0, 3900);
    const n = Math.ceil(MAX_INSIGHT_NOTE_CHARS / long.length) + 2;
    for (let i = 0; i < n; i++) await addObservation(db, u, { caseId: c.id, text: `${i} ${long}` });
    const input = await buildInsightInput(db, u, c.id, "last7");
    expect(input.notes.reduce((s, x) => s + x.text.length, 0)).toBeLessThanOrEqual(MAX_INSIGHT_NOTE_CHARS);
    expect(input.omittedNotes).toBeGreaterThan(0);
    expect(input.notes.length + input.omittedNotes).toBe(n);
  });

  it("handoff drafts that need a new insight call are accounted as their own task type", async () => {
    db = await freshDb();
    const u = await registeredUser(db);
    const c = await createUserCase(db, u, { pseudonym: "Fictional" });
    await addObservation(db, u, { caseId: c.id, text: "Ate half of dinner." });
    await buildHandoffDraft(db, u, c.id, { chat: vi.fn(insightsReply), available: () => true });
    expect((await usageSummary(db, { ownerId: u.userId, caseId: c.id })).map((r) => r.purpose)).toEqual(["handoff_draft"]);
  });
});
