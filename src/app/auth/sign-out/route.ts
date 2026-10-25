import { NextResponse, type NextRequest } from "next/server";
import { authMode } from "@/lib/auth/mode";
import { DEMO_COOKIE } from "@/lib/auth/session";

/** POST only. Same-origin check guards against cross-site sign-out requests. */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) {
    return NextResponse.json({ error: "Cross-site request blocked" }, { status: 403 });
  }
  if (authMode() === "supabase") {
    const { serverClient } = await import("@/lib/auth/supabase");
    await (await serverClient()).auth.signOut();
  }
  const response = NextResponse.redirect(new URL("/?signed_out=1", request.url), 303);
  response.cookies.delete(DEMO_COOKIE);
  // Ask the browser to drop any cached private pages and storage for this site.
  response.headers.set("Clear-Site-Data", '"cache", "storage"');
  response.headers.set("Cache-Control", "no-store");
  return response;
}
