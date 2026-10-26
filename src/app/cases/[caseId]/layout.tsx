import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActor, principalOf } from "@/lib/auth/session";
import { getCase, listCases, NotFoundError } from "@/lib/repo/cases";
import { getDb } from "@/lib/repo/db";
import { aiStatus } from "@/lib/ai/client";
import { listAlerts, listObservations } from "@/lib/repo/observations";
import { AddObservationButton, AddObservationDialog } from "@/components/AddObservation";
import { AiStatusPill } from "@/components/AiStatusPill";
import { CaseSwitcher } from "@/components/CaseSwitcher";
import { SafetyBanner } from "@/components/SafetyBanner";
import { SideNav } from "@/components/SideNav";
import styles from "@/components/shell.module.css";

export const dynamic = "force-dynamic";

/** Shell for screens 3–8. The case is loaded with an ownership check; other users' IDs 404. */
export default async function CaseLayout({ children, params }: { children: React.ReactNode; params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const actor = await requireActor();
  const db = await getDb();
  const p = principalOf(actor);
  let current;
  try {
    current = await getCase(db, p, caseId);
  } catch (err) {
    if (err instanceof NotFoundError || (err as Error).message === "invalid case id") notFound();
    throw err;
  }
  const [cases, alerts, observations] = await Promise.all([
    listCases(db, p),
    listAlerts(db, p, caseId, { unseenOnly: true }),
    listObservations(db, p, caseId),
  ]);

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar} aria-label="Main navigation">
        <Link href="/cases" className="brand-row" style={{ color: "#fff" }}>
          <span className="brand-mark" style={{ background: "#fff", color: "var(--primary)" }} aria-hidden="true">
            CS
          </span>
          <span className="brand-name" style={{ color: "#fff" }}>
            CareSignal
          </span>
        </Link>
        <SideNav caseId={caseId} />
        <p className={styles.sideNote}>Classroom prototype · synthetic data only · not medical advice</p>
      </aside>

      <div className={styles.main}>
        <header className={styles.topbar}>
          <details className={styles.mobileMenu}>
            <summary>Menu</summary>
            <SideNav caseId={caseId} />
          </details>
          <div className={styles.caseInfo}>
            <span className="secondary">Case</span>
            <strong>{current.pseudonym}</strong>
            <span className="pill pill-unknown">Synthetic · {current.patientRef}</span>
            {actor.kind === "registered" && cases.length > 1 && (
              <CaseSwitcher current={current.id} cases={cases.map((c) => ({ id: c.id, label: `${c.pseudonym} (${c.patientRef})` }))} />
            )}
            {actor.kind === "registered" && (
              <Link href="/cases" className="muted-link">
                All cases
              </Link>
            )}
            {actor.kind === "demo" && (
              <Link href="/demo" className="muted-link">
                Switch demo case
              </Link>
            )}
          </div>
          <div className={styles.account}>
            <AddObservationButton />
            {actor.kind === "demo" ? (
              <span className="pill badge-demo">Demo mode — synthetic data only; shared demo data may be reset</span>
            ) : (
              <span className="pill badge-account">Signed in as {actor.displayName}</span>
            )}
            <form action="/auth/sign-out" method="post">
              <button className="btn btn-ghost" type="submit">
                {actor.kind === "demo" ? "Leave demo" : "Sign out"}
              </button>
            </form>
          </div>
        </header>
        <div className={styles.statusRow}>
          <AiStatusPill status={aiStatus()} />
          {actor.kind === "demo" && (
            <span className="secondary">Your private demo copy · reset it any time in Settings</span>
          )}
        </div>
        <main id="main" className={styles.content}>
          <SafetyBanner caseId={caseId} alerts={alerts} observations={observations} />
          {children}
        </main>
        <AddObservationDialog caseId={caseId} pseudonym={current.pseudonym} />
      </div>
    </div>
  );
}
