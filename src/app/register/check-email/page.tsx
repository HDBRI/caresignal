import Link from "next/link";
import { BrandLink, SiteFooter } from "@/components/SiteChrome";

export default function CheckEmailPage() {
  return (
    <main id="main" className="narrow-page">
      <BrandLink />
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h1 style={{ fontSize: 26 }}>Check your email</h1>
        <p>
          Your account was created and your Terms and Privacy acceptance was saved. Before you can sign in, please open
          the confirmation link we just emailed you. Your email is <strong>not yet confirmed</strong>.
        </p>
        <p className="secondary">
          No email after a few minutes? Check spam, then try <Link href="/sign-in">signing in</Link> again.
        </p>
      </div>
      <SiteFooter />
    </main>
  );
}
