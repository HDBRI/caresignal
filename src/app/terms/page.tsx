import Link from "next/link";
import { LEGAL_LAST_UPDATED, TERMS_VERSION } from "@/lib/legal";
import { BrandLink, SiteFooter } from "@/components/SiteChrome";

export const metadata = { title: "Terms of Use — CareSignal prototype" };

export default function TermsPage() {
  return (
    <main id="main" className="medium-page">
      <BrandLink />
      <article className="card prose">
        <span className="pill pill-unknown">Prototype notice · version {TERMS_VERSION}</span>
        <h1 style={{ marginTop: 12 }}>Terms of Use</h1>
        <p className="secondary">
          Last updated {LEGAL_LAST_UPDATED}. This is a plain-language notice written by a student for a classroom
          prototype. It has not been reviewed by a lawyer.
        </p>

        <h2>1. What CareSignal is</h2>
        <p>
          CareSignal is a classroom prototype built for a course (MGT 409, Yale School of Management). It helps organize
          caregiver-written observations about a <strong>fictional</strong> person into summaries and handoff drafts. It
          is a demonstration, not a product or service.
        </p>

        <h2>2. What CareSignal is not</h2>
        <ul>
          <li>It is <strong>not medical advice</strong>, diagnosis or treatment, and does not replace a doctor, nurse or other care professional.</li>
          <li>It is <strong>not a validated clinical triage system</strong> and <strong>not emergency monitoring</strong>. Nobody watches what you enter.</li>
          <li>It is not connected to any real hospital, clinic, pharmacy, health record or care team. The “receiver” that handoffs are sent to is <strong>simulated</strong>; no real person receives them.</li>
          <li>Its safety rules recognize only a small set of predefined phrases. No alert does not mean a situation is safe.</li>
        </ul>

        <h2>3. Emergencies</h2>
        <p>
          <strong>If someone may be having an emergency, call 911 (or your local emergency number) right away.</strong>{" "}
          Do not rely on this prototype for any urgent or health decision.
        </p>

        <h2>4. Fictional data only</h2>
        <p>
          You agree to enter <strong>only fictional, made-up information</strong>. Do not enter real names, dates of
          birth, addresses, phone numbers, insurance details, medical records, images, or any real health information
          about yourself or anyone else.
        </p>

        <h2>5. AI processing</h2>
        <p>
          Notes you write may be sent to an AI model (OpenAI&apos;s gpt-6-luna, through the Portkey gateway used by the
          course) to suggest categories, summaries and draft questions. AI output can be wrong or incomplete. You review
          and decide what goes into any handoff.
        </p>

        <h2>6. Accounts and demo access</h2>
        <ul>
          <li>Registered accounts use Supabase Auth. Keep your password to yourself; you are responsible for activity in your account.</li>
          <li>Demo logins are shared and public. They are not private or secure accounts. Each demo visit gets its own copy of the case, which may be reset or removed.</li>
        </ul>

        <h2>7. Availability and changes</h2>
        <p>
          The prototype may be unavailable, changed, reset or shut down at any time — for example after the course ends —
          and data may be lost. It is provided “as is”, without any warranty.
        </p>

        <h2>8. Acceptable use</h2>
        <p>Don&apos;t try to access other users&apos; data, overload the service, or enter real personal or health information.</p>

        <h2>9. Contact</h2>
        <p>This prototype was built by a Yale SOM student for coursework. Questions can be raised through the course.</p>

        <p style={{ marginTop: 24 }}>
          See also the <Link href="/privacy">Privacy Notice</Link>.
        </p>
      </article>
      <SiteFooter />
    </main>
  );
}
