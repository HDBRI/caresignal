import Link from "next/link";
import { aiStatus } from "@/lib/ai/client";
import { demoCredentials } from "@/lib/auth/demo";
import { authMode } from "@/lib/auth/mode";
import { getActor } from "@/lib/auth/session";
import { dataBackend } from "@/lib/config";
import { AiStatusPill } from "@/components/AiStatusPill";
import { PrototypeNotice } from "@/components/PrototypeNotice";
import { SiteFooter } from "@/components/SiteChrome";
import { ArrowIcon, BookIcon, CheckIcon, LogInIcon, UserPlusIcon } from "@/components/icons";
import styles from "./welcome.module.css";

export const dynamic = "force-dynamic";

/** Screen 1 — Welcome / Demo Entry. */
export default async function WelcomePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const mode = authMode();
  const actor = await getActor();
  const creds = demoCredentials();

  return (
    <main id="main" className={styles.page}>
      <header className={styles.brand}>
        <span className={styles.logo} aria-hidden="true">
          CS
        </span>
        <span className={styles.wordmark}>CareSignal</span>
      </header>

      {params.signed_out && (
        <p className="form-success" role="status">
          <CheckIcon size={17} /> You&apos;re signed out. We asked your browser to clear cached private pages for this site.
        </p>
      )}
      {params.account === "deleted" && (
        <p className="form-success" role="status">
          <CheckIcon size={17} /> Your account and all its fictional case data were deleted.
        </p>
      )}

      <section className={styles.hero} aria-labelledby="tagline">
        <h1 id="tagline">Turn everyday observations into clearer care conversations</h1>
        <p className={styles.lede}>
          CareSignal organizes caregiver-reported observations into evidence-linked summaries and handoffs for a
          care team. Every insight links back to the original notes, and the caregiver stays in control of what is
          shared.
        </p>
        <PrototypeNotice />
      </section>

      {actor && (
        <p className="card" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <span className={`pill ${actor.kind === "demo" ? "badge-demo" : "badge-account"}`}>
            {actor.kind === "demo" ? "Demo mode" : "Signed in"}
          </span>
          <span>
            {actor.kind === "demo" ? "You have a demo session open." : `Signed in as ${actor.displayName}.`}
          </span>
          <Link className="btn btn-primary" href="/cases">
            Continue <ArrowIcon size={16} />
          </Link>
        </p>
      )}

      <section aria-labelledby="choices-heading" className={styles.choices}>
        <h2 id="choices-heading" className={styles.srOnly}>
          How would you like to start?
        </h2>

        <article className={`card ${styles.choice}`}>
          <div className={styles.choiceIcon}>
            <BookIcon size={22} />
          </div>
          <h3>Explore a demo</h3>
          <p className="secondary">
            Open one of three prepared fictional cases with shared demo credentials. You get your own copy to try
            things in; it can be reset at any time.
          </p>
          <span className={styles.choiceTag}>Shared demo · not a private account</span>
          <Link className="btn btn-primary" href="/demo">
            Explore a demo
          </Link>
        </article>

        <article className={`card ${styles.choice}`}>
          <div className={styles.choiceIcon}>
            <UserPlusIcon size={22} />
          </div>
          <h3>Create an account</h3>
          <p className="secondary">
            Register with email and a password to keep your own fictional cases. Requires accepting the prototype
            Terms of Use and Privacy Notice.
          </p>
          <span className={styles.choiceTag}>Your own private workspace</span>
          {mode === "supabase" ? (
            <Link className="btn btn-secondary" href="/register">
              Create an account
            </Link>
          ) : (
            <span className="btn btn-secondary" aria-disabled="true" title="Available on the hosted version">
              Available on the hosted version
            </span>
          )}
        </article>

        <article className={`card ${styles.choice}`}>
          <div className={styles.choiceIcon}>
            <LogInIcon size={22} />
          </div>
          <h3>Sign in</h3>
          <p className="secondary">Return to the fictional cases in your account, from any browser or device.</p>
          <span className={styles.choiceTag}>Registered accounts</span>
          {mode === "supabase" ? (
            <Link className="btn btn-secondary" href="/sign-in">
              Sign in
            </Link>
          ) : (
            <span className="btn btn-secondary" aria-disabled="true">
              Available on the hosted version
            </span>
          )}
        </article>
      </section>

      {mode !== "supabase" && (
        <p className="secondary">
          This copy is running in <strong>local demo mode</strong>: the three demo cases work fully, but account
          registration needs the hosted version (CareSignal never stores passwords itself; accounts use Supabase Auth).
        </p>
      )}

      <details className="card demo-access">
        <summary>Demo access (for evaluators)</summary>
        <p className="secondary" style={{ marginTop: 8 }}>
          Shared, public demo credentials — synthetic data only, not a private or secure account. Each sign-in opens
          a fresh copy of the case just for you.
        </p>
        <table>
          <thead>
            <tr>
              <th scope="col">Case</th>
              <th scope="col">Username</th>
              <th scope="col">Password</th>
            </tr>
          </thead>
          <tbody>
            {creds.map((c) => (
              <tr key={c.username}>
                <td>{c.pseudonym}</td>
                <td>
                  <code className="cred">{c.username}</code>
                </td>
                <td>
                  <code className="cred">{c.password}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      <footer className={styles.footer}>
        <AiStatusPill status={aiStatus()} />
        <span className="pill pill-unknown">
          Data: {dataBackend() === "local" ? "local database (fallback mode)" : "hosted database"}
        </span>
      </footer>
      <SiteFooter />
    </main>
  );
}
