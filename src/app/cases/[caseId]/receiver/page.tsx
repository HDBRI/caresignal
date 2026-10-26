import Link from "next/link";
import { requireActor, principalOf } from "@/lib/auth/session";
import { getDb } from "@/lib/repo/db";
import { listHandoffs } from "@/lib/repo/handoffs";
import { EmptyState, fmtDateTime } from "@/components/display";
import { InfoIcon } from "@/components/icons";
import { HistoryList } from "@/components/handoff/HandoffView";
import { getCase } from "@/lib/repo/cases";
import { fictionalResponseFor } from "@/lib/repo/handoff-workflow";
import { acknowledgeHandoffAction, addFictionalResponseAction } from "@/app/actions/handoffs";

export const dynamic = "force-dynamic";

/** Screen 7 — Demo receiver: a SIMULATED care-team inbox. Shows only payloads the backend actually persisted. */
export default async function ReceiverPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const actor = await requireActor();
  const db = await getDb();
  const p = principalOf(actor);
  const [handoffs, c] = await Promise.all([listHandoffs(db, p, caseId), getCase(db, p, caseId)]);
  const scenarioResponse = fictionalResponseFor(c.seedKey);
  const received = handoffs.filter((h) => h.receipt);

  return (
    <>
      <header style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span className="pill pill-attention" style={{ alignSelf: "flex-start" }}>
          <InfoIcon size={14} /> Simulated receiver — not a real hospital, clinic or care team
        </span>
        <h1>Demo receiver</h1>
        <p className="secondary" style={{ fontSize: 15 }}>
          This page plays the part of a care team&apos;s inbox so you can see exactly what was delivered. A handoff appears here
          only after CareSignal&apos;s server confirmed it was saved. No real person is contacted.
        </p>
      </header>

      {received.length === 0 ? (
        <EmptyState title="Nothing received yet">
          No handoff for this case has been received by the simulated receiver.{" "}
          <Link href={`/cases/${caseId}/handoffs`}>Go to Handoffs</Link>
        </EmptyState>
      ) : (
        received.map(({ handoff: h, receipt, history, responses }) => (
          <article key={h.id} className="card" aria-labelledby={`r-${h.displayId}`} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="section-head" style={{ marginBottom: 0 }}>
              <h2 id={`r-${h.displayId}`}>
                Handoff {h.displayId} · version {h.version}
              </h2>
              <span className={`pill ${receipt!.acknowledgedAt ? "pill-calm" : "pill-attention"}`}>
                {receipt!.acknowledgedAt ? `Acknowledged ${fmtDateTime(receipt!.acknowledgedAt)}` : "Received — not yet acknowledged"}
              </span>
            </div>
            <p>
              Handoff received by the simulated receiver. The approved handoff was saved in this demo. No real care team was
              contacted.
            </p>
            <p className="meta">
              <span>Received {fmtDateTime(receipt!.receivedAt)}</span>
              {h.draftedBy === "seed_fixture" && <span>· Example from this synthetic scenario</span>}
            </p>

            {!receipt!.acknowledgedAt && (
              <form action={acknowledgeHandoffAction}>
                <input type="hidden" name="caseId" value={caseId} />
                <input type="hidden" name="handoffId" value={h.id} />
                <button className="btn btn-secondary" type="submit">
                  Acknowledge receipt (simulated — no real person acts)
                </button>
              </form>
            )}
            {scenarioResponse && responses.length === 0 && (
              <form action={addFictionalResponseAction}>
                <input type="hidden" name="caseId" value={caseId} />
                <input type="hidden" name="handoffId" value={h.id} />
                <button className="btn btn-secondary" type="submit">
                  Show this scenario&apos;s fictional receiver response
                </button>
              </form>
            )}
            {responses.map((r) => (
              <div key={r.id} className="card" style={{ background: "var(--unknown-bg)" }}>
                <p className="stat-label" style={{ fontWeight: 600, display: "flex", gap: 6 }}>
                  <InfoIcon size={14} /> Simulated receiver response — fictional
                </p>
                <p className="secondary" style={{ fontWeight: 600 }}>
                  {r.label}
                </p>
                <p style={{ marginTop: 4 }}>{r.text}</p>
                <p className="secondary">{fmtDateTime(r.at)}</p>
              </div>
            ))}

            <details>
              <summary className="muted-link" style={{ cursor: "pointer" }}>
                Show the exact saved payload
              </summary>
              <pre className="payload">{JSON.stringify(receipt!.payload, null, 2)}</pre>
            </details>
            <details>
              <summary className="muted-link" style={{ cursor: "pointer" }}>
                Status history
              </summary>
              <HistoryList history={history} />
            </details>
          </article>
        ))
      )}
    </>
  );
}
