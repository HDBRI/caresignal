/** AI usage accounting (server/admin only). Stores provider-returned numbers exactly; never invents them. */
import type { Database } from "../db/client";
import type { ProviderUsage } from "../ai/client";

export interface UsageEntry {
  ownerId: string | null;
  caseId: string | null;
  purpose: "observation_analysis" | "insights" | "handoff_draft" | "seed_insights" | "evaluation";
  status: "complete" | "failed" | "rejected";
  modelRequested: string;
  modelReported: string | null;
  providerRequestId: string | null;
  usage: ProviderUsage | null;
  latencyMs: number | null;
  /** Why the call failed (category only, e.g. failed_timeout). Never request content. */
  failureReason?: string | null;
}

/**
 * One row per ATTEMPTED request (so request counts are real). When the provider returned no usage, the row says
 * usage_reported = false and the token columns stay null. No row when no request was made (no key configured).
 * Only counts and categories are stored — never note text, prompts or keys.
 */
export async function recordUsage(db: Database, e: UsageEntry): Promise<string | null> {
  if (e.failureReason === "unavailable_missing_key") return null; // no request was sent
  const u = e.usage;
  const [{ id }] = await db.asAdmin((sql) =>
    sql.query<{ id: string }>(
      `insert into usage_log (owner_id, case_id, purpose, status, model_requested, model_reported, provider_request_id,
                              prompt_tokens, cached_tokens, completion_tokens, total_tokens, latency_ms,
                              usage_reported, reasoning_tokens, provider_cost_usd, failure_reason)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) returning id`,
      [
        e.ownerId, e.caseId, e.purpose, e.status, e.modelRequested, e.modelReported, e.providerRequestId,
        u?.promptTokens ?? null, u?.cachedTokens ?? null, u?.completionTokens ?? null, u?.totalTokens ?? null, e.latencyMs,
        u !== null, u?.reasoningTokens ?? null, u?.costUsd ?? null, e.failureReason ?? null,
      ],
    ),
  );
  return id;
}

export interface UsageSummaryRow {
  purpose: UsageEntry["purpose"];
  requests: number;
  withUsage: number;
  promptTokens: number | null;
  completionTokens: number | null;
  reasoningTokens: number | null;
  providerCostUsd: number | null;
  firstAt: string | null;
  lastAt: string | null;
}

/**
 * Measured usage, summed by task type. Scoped to one owner (and optionally one case) unless both are null
 * (admin/report use). Token sums cover only rows where the provider reported usage; null means none did.
 */
export async function usageSummary(db: Database, scope: { ownerId: string | null; caseId?: string | null }): Promise<UsageSummaryRow[]> {
  const rows = await db.asAdmin((sql) =>
    sql.query<Record<string, unknown>>(
      `select purpose, count(*)::int as requests, count(*) filter (where usage_reported)::int as with_usage,
              sum(prompt_tokens)::int as prompt_tokens, sum(completion_tokens)::int as completion_tokens,
              sum(reasoning_tokens)::int as reasoning_tokens, sum(provider_cost_usd)::float as provider_cost_usd,
              min(created_at) as first_at, max(created_at) as last_at
         from usage_log
        where ($1::uuid is null or owner_id = $1::uuid) and ($2::uuid is null or case_id = $2::uuid)
        group by purpose order by purpose`,
      [scope.ownerId, scope.caseId ?? null],
    ),
  );
  const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  const t = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
  return rows.map((r) => ({
    purpose: r.purpose as UsageEntry["purpose"],
    requests: Number(r.requests),
    withUsage: Number(r.with_usage),
    promptTokens: n(r.prompt_tokens),
    completionTokens: n(r.completion_tokens),
    reasoningTokens: n(r.reasoning_tokens),
    providerCostUsd: n(r.provider_cost_usd),
    firstAt: t(r.first_at),
    lastAt: t(r.last_at),
  }));
}

/** AI calls attempted today (UTC) — used for the configurable daily caps. */
export async function aiCallsToday(db: Database, ownerId: string | null): Promise<number> {
  const [{ n }] = await db.asAdmin((sql) =>
    sql.query<{ n: number }>(
      `select count(*)::int as n from usage_log
       where created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc'
         and ($1::uuid is null or owner_id = $1::uuid)`,
      [ownerId],
    ),
  );
  return n;
}
