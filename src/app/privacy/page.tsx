import Link from "next/link";
import { LEGAL_LAST_UPDATED, PRIVACY_VERSION } from "@/lib/legal";
import { BrandLink, SiteFooter } from "@/components/SiteChrome";

export const metadata = { title: "Privacy Notice — CareSignal prototype" };

export default function PrivacyPage() {
  return (
    <main id="main" className="medium-page">
      <BrandLink />
      <article className="card prose">
        <span className="pill pill-unknown">Prototype notice · version {PRIVACY_VERSION}</span>
        <h1 style={{ marginTop: 12 }}>Privacy Notice</h1>
        <p className="secondary">
          Last updated {LEGAL_LAST_UPDATED}. Plain-language notice for a classroom prototype; not reviewed by a lawyer.
          CareSignal is <strong>not HIPAA compliant</strong> and has no security certification. Use fictional data only.
        </p>

        <h2>1. What we store</h2>
        <ul>
          <li><strong>Account:</strong> your email and username. Your password is stored only by our authentication provider (Supabase Auth) as a secure hash — CareSignal never sees or stores it.</li>
          <li><strong>Acceptance record:</strong> your user ID, the Terms and Privacy versions you accepted, the time, and your confirmation that you&apos;ll use fictional data only.</li>
          <li><strong>Fictional case data you enter:</strong> case details, baselines, observations (exactly as written, plus any edits as new versions), check-ins, AI results, safety alerts, handoffs, simulated receipts and status history.</li>
          <li><strong>AI usage records:</strong> token counts and model name for each AI request, used to measure cost. These don&apos;t include your notes.</li>
        </ul>

        <h2>2. Where it is stored</h2>
        <p>
          On the hosted version, data is stored in a Supabase-hosted Postgres database. Access is limited to your own
          account by database row-level security and server-side checks. In a local copy run on a computer, data stays in
          a database folder on that computer.
        </p>

        <h2>3. AI processing</h2>
        <p>
          To create categories, summaries and draft questions, the text of your notes, their IDs and times, and the case
          pseudonym are sent to an AI model (OpenAI&apos;s gpt-6-luna, via the Portkey gateway provided by the course). Your
          email, username and user ID are not sent. Those providers process the text under their own terms. Don&apos;t put
          anything real in your notes.
        </p>

        <h2>4. What we don&apos;t do</h2>
        <ul>
          <li>No advertising, analytics or third-party tracking.</li>
          <li>No connection to any real health record, clinician, pharmacy or care team. The receiver is simulated.</li>
          <li>No email, SMS or push notifications. The only email you may receive is from the authentication provider (for example, a password reset link).</li>
        </ul>

        <h2>5. Retention and deletion</h2>
        <ul>
          <li><strong>Registered accounts:</strong> you can delete your account in Settings. This deletes your account and every case, note, AI result, handoff and receipt linked to it. Deleted data may remain in the provider&apos;s routine backups for a limited time.</li>
          <li><strong>Demo copies:</strong> you can reset your copy at any time. Demo data may be reset or cleared without notice.</li>
          <li>The whole prototype — and all its data — may be deleted after the course ends.</li>
        </ul>

        <h2>6. Cookies</h2>
        <p>
          We use only necessary cookies: the authentication provider&apos;s session cookies for registered accounts, and one
          cookie that remembers which demo copy is yours. Signing out removes them.
        </p>

        <h2>7. Limitations</h2>
        <p>
          This is a student prototype. Security has been tested for the things listed in the project README, but it is not
          production-grade. Please don&apos;t enter real personal or health information.
        </p>

        <p style={{ marginTop: 24 }}>
          See also the <Link href="/terms">Terms of Use</Link>. In an emergency, call 911.
        </p>
      </article>
      <SiteFooter />
    </main>
  );
}
