/**
 * Supabase email links land here (password recovery and, if enabled, email confirmation).
 * Exchanges the one-time code for a session, then continues to a same-site path only.
 */
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { authMode } from "@/lib/auth/mode";
import { safeNext } from "@/lib/auth/service";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get("next"), "/cases");
  if (authMode() !== "supabase") return NextResponse.redirect(new URL("/sign-in", request.url));

  const { serverClient } = await import("@/lib/auth/supabase");
  const supabase = await serverClient();
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  let ok = false;
  if (code) ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  else if (tokenHash && type) ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;

  if (!ok) return NextResponse.redirect(new URL("/sign-in?reason=link_invalid", request.url));
  return NextResponse.redirect(new URL(next, request.url));
}
