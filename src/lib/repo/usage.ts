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
}

export async function recordUsage(db: Database, e: UsageEntry): Promise<string | null> {
  if (!e.usage) return null; // nothing returned by the provider -> nothing recorded
  const [{ id }] = await db.asAdmin((sql) =>
    sql.query<{ id: string }>(
      `insert into usage_log (owner_id, case_id, purpose, status, model_requested, model_reported, provider_request_id,
                              prompt_tokens, cached_tokens, completion_tokens, total_tokens, latency_ms)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) returning id`,
      [
        e.ownerId, e.caseId, e.purpose, e.status, e.modelRequested, e.modelReported, e.providerRequestId,
        e.usage!.promptTokens, e.usage!.cachedTokens, e.usage!.completionTokens, e.usage!.totalTokens, e.latencyMs,
      ],
    ),
  );
  return id;
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
