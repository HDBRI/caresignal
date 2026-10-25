import Link from "next/link";
import { authMode } from "@/lib/auth/mode";
import { SignInForm } from "@/components/AccountForms";
import { BrandLink, SiteFooter } from "@/components/SiteChrome";

export const dynamic = "force-dynamic";

const REASONS: Record<string, string> = {
  signed_out: "Please sign in to continue.",
  link_invalid: "That link is invalid or has expired. Request a new one below.",
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { reason, next } = await searchParams;
  const enabled = authMode() === "supabase";
  return (
    <main id="main" className="narrow-page">
      <BrandLink />
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <span className="pill badge-account" style={{ alignSelf: "flex-start" }}>
          Registered accounts
        </span>
        <h1 style={{ fontSize: 26 }}>Sign in</h1>
        {reason && REASONS[reason] && <p className="secondary">{REASONS[reason]}</p>}
        {enabled ? (
          <SignInForm next={next} />
        ) : (
          <p>
            Accounts are available on the hosted version of CareSignal. This local copy runs in demo mode —{" "}
            <Link href="/demo">explore a demo case</Link> instead.
          </p>
        )}
        <p className="secondary">
          New here? <Link href="/register">Create an account</Link> · Just looking? <Link href="/demo">Explore a demo</Link>
        </p>
      </div>
      <SiteFooter />
    </main>
  );
}
