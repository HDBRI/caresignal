import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  it("reports status without exposing any secret", async () => {
    process.env.PORTKEY_API_KEY = "test-secret-should-never-appear";
    const res = await GET();
    const text = await res.text();
    expect(text).not.toContain("test-secret-should-never-appear");
    const body = JSON.parse(text);
    expect(body.ai.status).toBe("available");
    expect(body.ai.model).toBe("gpt-6-luna");
    expect(body.syntheticDataOnly).toBe(true);
    expect(body.data.backend).toBe("local");
    delete process.env.PORTKEY_API_KEY;
  });
});
