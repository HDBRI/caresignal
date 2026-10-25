import Link from "next/link";
import { getActor } from "@/lib/auth/session";
import { ResetPasswordForm } from "@/components/AccountForms";
import { BrandLink, SiteFooter } from "@/components/SiteChrome";

export const dynamic = "force-dynamic";

/** Reached from the emailed reset link (via /auth/callback, which creates a short-lived session). */
export default async function ResetPasswordPage() {
  const actor = await getActor();
  return (
    <main id="main" className="narrow-page">
      <BrandLink />
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <h1 style={{ fontSize: 26 }}>Choose a new password</h1>
        {actor?.kind === "registered" ? (
          <ResetPasswordForm />
        ) : (
          <p>
            This page works from the link in your reset email. <Link href="/forgot-password">Request a new link</Link>.
          </p>
        )}
      </div>
      <SiteFooter />
    </main>
  );
}
