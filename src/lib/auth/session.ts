/**
 * Who is making this request. Two clearly separate kinds of actor:
 *   - demo:       shared demo login; identified by an httpOnly cookie holding a random demo-session id
 *   - registered: Supabase Auth user (session cookies managed by @supabase/ssr; validated with Supabase on every request)
 */
import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Database, Principal } from "../db/client";
import { getDb } from "../repo/db";
import { authMode } from "./mode";

export const DEMO_COOKIE = "cs_demo";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Actor =
  | { kind: "demo"; userId: string; demoSessionId: string; seedKey: string; displayName: string }
  | { kind: "registered"; userId: string; email: string | null; username: string; displayName: string };

export function principalOf(actor: Actor): Principal {
  return { userId: actor.userId, demoSessionId: actor.kind === "demo" ? actor.demoSessionId : null };
}

export function demoCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };
}

/** Server-side lookup: the cookie value alone never grants a user id — it must match a stored demo session. */
export async function resolveDemoSession(db: Database, cookieValue: string | undefined | null) {
  if (!cookieValue || !UUID_RE.test(cookieValue)) return null;
  const rows = await db.asAdmin((sql) =>
    sql.query<{ owner_id: string; seed_key: string; display_name: string }>(
      `select s.owner_id, s.seed_key, p.display_name
         from demo_sessions s join profiles p on p.user_id = s.owner_id and p.account_kind = 'demo'
        where s.id = $1`,
      [cookieValue],
    ),
  );
  if (rows.length !== 1) return null;
  return { userId: rows[0].owner_id, demoSessionId: cookieValue, seedKey: rows[0].seed_key, displayName: rows[0].display_name };
}

export async function getActor(): Promise<Actor | null> {
  const db = await getDb();
  const demo = await resolveDemoSession(db, (await cookies()).get(DEMO_COOKIE)?.value);
  if (demo) return { kind: "demo", ...demo };

  if (authMode() !== "supabase") return null;
  const { serverClient } = await import("./supabase");
  const supabase = await serverClient();
  const { data, error } = await supabase.auth.getUser(); // verified with Supabase, not just decoded
  if (error || !data.user) return null;
  const rows = await db.asAdmin((sql) =>
    sql.query<{ username: string; display_name: string; account_kind: string }>(
      `select username, display_name, account_kind from profiles where user_id = $1`,
      [data.user.id],
    ),
  );
  if (rows.length !== 1 || rows[0].account_kind !== "registered") return null;
  return {
    kind: "registered",
    userId: data.user.id,
    email: data.user.email ?? null,
    username: rows[0].username,
    displayName: rows[0].display_name,
  };
}

export async function requireActor(): Promise<Actor> {
  const actor = await getActor();
  if (!actor) redirect("/sign-in?reason=signed_out");
  return actor;
}

export async function siteUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "local";
}
