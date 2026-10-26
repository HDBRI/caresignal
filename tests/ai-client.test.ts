import { describe, expect, it } from "vitest";
import { aiStatus, chatJson, readUsage } from "@/lib/ai/client";
import { MODEL_NAME } from "@/lib/config";

describe("AI client", () => {
  it("uses the course-required model", () => {
    expect(MODEL_NAME).toBe("gpt-6-luna");
  });

  it("reports unavailable and makes no call when the key is missing", async () => {
    const saved = process.env.PORTKEY_API_KEY;
    delete process.env.PORTKEY_API_KEY;
    expect(aiStatus()).toBe("unavailable_missing_key");
    const result = await chatJson([{ role: "user", content: "hello" }]);
    expect(result).toEqual({ ok: false, reason: "unavailable_missing_key", usage: null });
    if (saved !== undefined) process.env.PORTKEY_API_KEY = saved;
  });

  it("copies provider-returned usage exactly", () => {
    expect(
      readUsage({ prompt_tokens: 812, completion_tokens: 230, total_tokens: 1042, prompt_tokens_details: { cached_tokens: 512 } }),
    ).toEqual({ promptTokens: 812, cachedTokens: 512, completionTokens: 230, totalTokens: 1042, reasoningTokens: null, costUsd: null });
  });

  it("keeps missing usage fields null, never 0", () => {
    expect(readUsage({ prompt_tokens: 100, completion_tokens: 20 })).toEqual({
      promptTokens: 100,
      cachedTokens: null,
      completionTokens: 20,
      totalTokens: null,
      reasoningTokens: null,
      costUsd: null,
    });
    expect(readUsage(undefined)).toBeNull();
  });
});
