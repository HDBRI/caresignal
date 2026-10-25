import Link from "next/link";
import { authMode } from "@/lib/auth/mode";
import { RegisterForm } from "@/components/AccountForms";
import { PrototypeNotice } from "@/components/PrototypeNotice";
import { BrandLink, SiteFooter } from "@/components/SiteChrome";

export const dynamic = "force-dynamic";

export default function RegisterPage() {
  const enabled = authMode() === "supabase";
  return (
    <main id="main" className="narrow-page">
      <BrandLink />
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <span className="pill badge-account" style={{ alignSelf: "flex-start" }}>
          Your own private workspace
        </span>
        <h1 style={{ fontSize: 26 }}>Create an account</h1>
        <p className="secondary">
          Your account keeps your own fictional cases. Passwords are handled by our authentication provider
          (Supabase Auth); CareSignal never sees or stores them.
        </p>
        <PrototypeNotice />
        {enabled ? (
          <RegisterForm />
        ) : (
          <p>
            Registration is available on the hosted version of CareSignal. This local copy runs in demo mode —{" "}
            <Link href="/demo">explore a demo case</Link> instead.
          </p>
        )}
        <p className="secondary">
          Already have an account? <Link href="/sign-in">Sign in</Link>
        </p>
      </div>
      <SiteFooter />
    </main>
  );
}
