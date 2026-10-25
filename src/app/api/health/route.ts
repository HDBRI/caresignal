import { NextResponse } from "next/server";
import { aiStatus } from "@/lib/ai/client";
import { MODEL_NAME, aiLimits, dataBackend } from "@/lib/config";
import { RULES_VERSION } from "@/lib/safety/rules";
import { getDb } from "@/lib/repo/db";

export const dynamic = "force-dynamic";

/** Public status check. Reports availability only — never key values or env contents. */
export async function GET() {
  let database: "ok" | "unavailable" = "unavailable";
  try {
    const db = await getDb();
    await db.asAdmin((sql) => sql.query("select 1"));
    database = "ok";
  } catch {
    console.error("[health] database check failed");
  }
  return NextResponse.json({
    app: "CareSignal",
    prototype: true,
    syntheticDataOnly: true,
    ai: { status: aiStatus(), model: MODEL_NAME, dailyLimits: aiLimits() },
    data: { backend: dataBackend(), status: database },
    safetyRulesVersion: RULES_VERSION,
  });
}
