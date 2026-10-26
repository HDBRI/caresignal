import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { getActor, principalOf } from "@/lib/auth/session";
import { getDb } from "@/lib/repo/db";
import { handleSubmitRequest } from "@/lib/repo/handoff-api";

export const dynamic = "force-dynamic";

/**
 * POST /api/handoffs — deliver an approved handoff to the SIMULATED receiver (this app's own database).
 * No hospital, EHR, pharmacy or care team is contacted. See src/lib/repo/handoff-api.ts for the responses.
 */
export async function POST(req: NextRequest) {
  // Same-origin only (the session cookie must not be usable from another site).
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) {
    return NextResponse.json({ error: "forbidden", message: "Cross-site requests are not accepted." }, { status: 403 });
  }
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "unauthenticated", message: "Please sign in again." }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_request", message: "The request was not valid JSON. Nothing was sent." }, { status: 400 });
  }
  try {
    const res = await handleSubmitRequest(await getDb(), principalOf(actor), body);
    const caseId = (body as { caseId?: unknown })?.caseId;
    if (typeof caseId === "string" && res.status !== 400) revalidatePath(`/cases/${caseId}`, "layout");
    return NextResponse.json(res.body, { status: res.status, headers: { "cache-control": "no-store" } });
  } catch {
    console.error("[handoffs] submit failed unexpectedly");
    return NextResponse.json(
      { error: "server_error", message: "Something went wrong on the server. Nothing is marked received unless a receipt was returned — retrying is safe." },
      { status: 500 },
    );
  }
}
