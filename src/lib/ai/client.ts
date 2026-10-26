/**
 * The only place CareSignal talks to a model.
 * Course setup: Portkey gateway, PORTKEY_API_KEY, model gpt-6-luna. Server-side only.
 *
 * Every call returns either real provider output with provider-reported usage,
 * or an honest failure state. It never fabricates output or token counts.
 */
import "server-only";
import OpenAI from "openai";
import { AI_TIMEOUT_MS, MODEL_NAME, PORTKEY_BASE_URL } from "../config";

export type AiStatus = "available" | "unavailable_missing_key";

export type AiFailureReason =
  | "unavailable_missing_key"
  | "failed_timeout"
  | "failed_provider"
  | "failed_empty"
  | "failed_length";

/** Usage exactly as the provider returned it; missing fields stay null (never 0). */
export interface ProviderUsage {
  promptTokens: number | null;
  cachedTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  /** Reasoning tokens inside completionTokens, if the provider reports them. */
  reasoningTokens?: number | null;
  /** A cost in USD ONLY if the provider/gateway itself returned one. CareSignal never fills this in. */
  costUsd?: number | null;
}

export interface AiSuccess {
  ok: true;
  content: string;
  modelReported: string | null;
  providerRequestId: string | null;
  usage: ProviderUsage;
}

export interface AiFailure {
  ok: false;
  reason: AiFailureReason;
  /** Present only if the provider returned usage before failing (billed tokens). */
  usage: ProviderUsage | null;
}

export type AiResult = AiSuccess | AiFailure;

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

export function aiStatus(): AiStatus {
  return process.env.PORTKEY_API_KEY?.trim() ? "available" : "unavailable_missing_key";
}

let cachedClient: OpenAI | null = null;
function client(): OpenAI {
  if (!cachedClient) {
    cachedClient = new OpenAI({
      apiKey: process.env.PORTKEY_API_KEY,
      baseURL: PORTKEY_BASE_URL,
      defaultHeaders: { "x-portkey-provider": "openai" },
      timeout: AI_TIMEOUT_MS,
      maxRetries: 1,
    });
  }
  return cachedClient;
}

/** Normalise the provider's usage object; anything not returned stays null. */
export function readUsage(raw: unknown): ProviderUsage | null {
  if (!raw || typeof raw !== "object") return null;
  const u = raw as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const details = (u.prompt_tokens_details ?? null) as Record<string, unknown> | null;
  const outDetails = (u.completion_tokens_details ?? null) as Record<string, unknown> | null;
  return {
    promptTokens: num(u.prompt_tokens),
    cachedTokens: details ? num(details.cached_tokens) : null,
    completionTokens: num(u.completion_tokens),
    totalTokens: num(u.total_tokens),
    reasoningTokens: outDetails ? num(outDetails.reasoning_tokens) : null,
    costUsd: num(u.cost ?? u.total_cost ?? null),
  };
}

/** Request a JSON object response. Callers must still validate the content. */
/**
 * Upper bound on output tokens per call (cost control). Generous: measured outputs average a few hundred tokens,
 * so this only stops runaway responses. A response cut off by the limit is a failure, never a partial result.
 */
export const MAX_OUTPUT_TOKENS = 4000;

export async function chatJson(messages: ChatMessage[], opts: { maxOutputTokens?: number } = {}): Promise<AiResult> {
  if (aiStatus() !== "available") return { ok: false, reason: "unavailable_missing_key", usage: null };

  try {
    const { data, response } = await client()
      .chat.completions.create({
        model: MODEL_NAME,
        messages,
        response_format: { type: "json_object" },
        max_completion_tokens: opts.maxOutputTokens ?? MAX_OUTPUT_TOKENS,
      })
      .withResponse();

    const content = data.choices?.[0]?.message?.content ?? "";
    const usage = readUsage(data.usage);
    if (data.choices?.[0]?.finish_reason === "length") return { ok: false, reason: "failed_length", usage };
    if (!content.trim()) return { ok: false, reason: "failed_empty", usage };

    return {
      ok: true,
      content,
      modelReported: data.model ?? null,
      providerRequestId: response.headers.get("x-portkey-trace-id") ?? data.id ?? null,
      usage: usage ?? { promptTokens: null, cachedTokens: null, completionTokens: null, totalTokens: null },
    };
  } catch (err) {
    const timedOut = err instanceof OpenAI.APIConnectionTimeoutError;
    // Log the category only — never the request, headers or key.
    console.error(`[ai] call failed: ${timedOut ? "timeout" : (err as { status?: number })?.status ?? "error"}`);
    return { ok: false, reason: timedOut ? "failed_timeout" : "failed_provider", usage: null };
  }
}
