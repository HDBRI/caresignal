/**
 * Tokenomics (Task 17): ILLUSTRATIVE cost estimates from editable assumptions (config/cost-assumptions.json).
 * Pure functions — no network, no environment, no secrets. Measured usage lives in usage_log / evaluation results
 * and is reported separately; nothing here is a bill.
 */
export interface Pricing {
  model: string;
  status: "illustrative" | "verified";
  inputUsdPerMillionTokens: number;
  cachedInputUsdPerMillionTokens: number;
  outputUsdPerMillionTokens: number;
  source: string;
  dateChecked: string;
}

export interface TokensPerCall {
  input: number;
  output: number;
}

export interface UsageAssumptions {
  observationsPerUserPerMonth: number;
  categorizationCallsPerObservation: number;
  insightRequestsPerUserPerMonth: number;
  insightCacheHitShare: number;
  handoffDraftsPerUserPerMonth: number;
  handoffDraftsNeedingNewAiCall: number;
  retryRate: number;
  tokensPerCall: { categorize: TokensPerCall; insights: TokensPerCall };
}

/** Cost of one call in USD, from token counts and a price per million tokens. */
export function callCostUsd(tokens: TokensPerCall, pricing: Pricing, cachedInputTokens = 0): number {
  const uncached = Math.max(0, tokens.input - cachedInputTokens);
  return (
    (uncached * pricing.inputUsdPerMillionTokens + cachedInputTokens * pricing.cachedInputUsdPerMillionTokens + tokens.output * pricing.outputUsdPerMillionTokens) /
    1_000_000
  );
}

export interface TaskEstimate {
  task: "categorization" | "insight summary" | "handoff draft";
  callsPerUser: number; // per month, including retries
  inputTokensPerUser: number;
  outputTokensPerUser: number;
  costPerUserUsd: number;
}

/** AI calls and cost per user per month, by task. Cache hits and handoff reuse make no call; retries add calls. */
export function perUserMonthly(a: UsageAssumptions, pricing: Pricing): TaskEstimate[] {
  const retry = 1 + a.retryRate;
  const rows: [TaskEstimate["task"], number, TokensPerCall][] = [
    ["categorization", a.observationsPerUserPerMonth * a.categorizationCallsPerObservation * retry, a.tokensPerCall.categorize],
    ["insight summary", a.insightRequestsPerUserPerMonth * (1 - a.insightCacheHitShare) * retry, a.tokensPerCall.insights],
    ["handoff draft", a.handoffDraftsPerUserPerMonth * a.handoffDraftsNeedingNewAiCall * retry, a.tokensPerCall.insights],
  ];
  return rows.map(([task, calls, t]) => ({
    task,
    callsPerUser: calls,
    inputTokensPerUser: calls * t.input,
    outputTokensPerUser: calls * t.output,
    costPerUserUsd: calls * callCostUsd(t, pricing),
  }));
}

export interface ScaleEstimate {
  users: number;
  callsPerMonth: number;
  inputTokensPerMonth: number;
  outputTokensPerMonth: number;
  costPerMonthUsd: number;
  byTask: { task: TaskEstimate["task"]; costPerMonthUsd: number }[];
}

export function estimateForUsers(users: number, a: UsageAssumptions, pricing: Pricing): ScaleEstimate {
  const per = perUserMonthly(a, pricing);
  const sum = (f: (t: TaskEstimate) => number) => per.reduce((n, t) => n + f(t), 0) * users;
  return {
    users,
    callsPerMonth: sum((t) => t.callsPerUser),
    inputTokensPerMonth: sum((t) => t.inputTokensPerUser),
    outputTokensPerMonth: sum((t) => t.outputTokensPerUser),
    costPerMonthUsd: sum((t) => t.costPerUserUsd),
    byTask: per.map((t) => ({ task: t.task, costPerMonthUsd: t.costPerUserUsd * users })),
  };
}

export interface MeasuredCall {
  purpose: string;
  promptTokens: number | null;
  completionTokens: number | null;
}

/** Averages over calls that actually reported usage. Calls without usage are counted but not averaged (never treated as 0). */
export function measuredAverages(calls: MeasuredCall[]): Record<string, { calls: number; withUsage: number; avgInput: number | null; avgOutput: number | null }> {
  const out: Record<string, { calls: number; withUsage: number; avgInput: number | null; avgOutput: number | null }> = {};
  for (const purpose of [...new Set(calls.map((c) => c.purpose))]) {
    const all = calls.filter((c) => c.purpose === purpose);
    const reported = all.filter((c) => c.promptTokens !== null && c.completionTokens !== null);
    const avg = (f: (c: MeasuredCall) => number) => (reported.length ? reported.reduce((n, c) => n + f(c), 0) / reported.length : null);
    out[purpose] = { calls: all.length, withUsage: reported.length, avgInput: avg((c) => c.promptTokens!), avgOutput: avg((c) => c.completionTokens!) };
  }
  return out;
}

export const usd = (n: number) => (n < 0.01 ? `$${n.toFixed(4)}` : n < 100 ? `$${n.toFixed(2)}` : `$${Math.round(n).toLocaleString("en-US")}`);
