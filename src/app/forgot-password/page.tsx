import Link from "next/link";
import { authMode } from "@/lib/auth/mode";
import { ForgotPasswordForm } from "@/components/AccountForms";
import { BrandLink, SiteFooter } from "@/components/SiteChrome";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return (
    <main id="main" className="narrow-page">
      <BrandLink />
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <h1 style={{ fontSize: 26 }}>Reset your password</h1>
        <p className="secondary">
          Enter the email you registered with. If an account exists, we&apos;ll email a link that lets you choose a new
          password. Shared demo accounts don&apos;t have resettable passwords.
        </p>
        {authMode() === "supabase" ? (
          <ForgotPasswordForm />
        ) : (
          <p>Password reset is available on the hosted version. This local copy runs in demo mode.</p>
        )}
        <Link href="/sign-in" className="muted-link">
          Back to sign in
        </Link>
      </div>
      <SiteFooter />
    </main>
  );
}
