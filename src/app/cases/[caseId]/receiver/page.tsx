import Link from "next/link";
import { requireActor, principalOf } from "@/lib/auth/session";
import { getCase } from "@/lib/repo/cases";
import { getDb } from "@/lib/repo/db";
import { fictionalResponseFor } from "@/lib/repo/handoff-workflow";
import { listHandoffs } from "@/lib/repo/handoffs";
import { listObservations } from "@/lib/repo/observations";
import { StructuredHandoff } from "@/components/handoff/StructuredHandoff";
import { EmptyState, fmtDateTime, KindTag } from "@/components/display";
import { FictionalResponse, HistoryList, periodLabel, RECEIVER_BANNER, StatusBadge } from "@/components/handoff/HandoffView";
import { AlertIcon } from "@/components/icons";
import { acknowledgeHandoffAction, addFictionalResponseAction } from "@/app/actions/handoffs";

export const dynamic = "force-dynamic";

/**
 * Screen 7 — Demo receiver: a SIMULATED care-team queue inside this app. It lists only payloads the backend
 * actually saved (receiver_records). Acknowledging here is a separate, explicit action; neither "received" nor
 * "acknowledged" means a clinician acted or that care changed.
 */
export default async function ReceiverPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const actor = await requireActor();
  const db = await getDb();
  const p = principalOf(actor);
  const [handoffs, c, observations] = await Promise.all([listHandoffs(db, p, caseId), getCase(db, p, caseId), listObservations(db, p, caseId)]);
  const notes = new Map(observations.map((o) => [o.displayId, o]));
  const scenarioResponse = fictionalResponseFor(c.seedKey);
  const queue = handoffs.filter((h) => h.receipt).sort((a, b) => b.receipt!.receivedAt.localeCompare(a.receipt!.receivedAt));
  const waiting = queue.filter((h) => !h.receipt!.acknowledgedAt).length;

  return (
    <>
      <p className="receiver-banner" role="note">
        <AlertIcon size={20} /> {RECEIVER_BANNER}
      </p>
      <header style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <h1>Demo receiver</h1>
        <p className="secondary" style={{ fontSize: 15 }}>
          This page plays the part of a care team&apos;s inbox so you can see exactly what was delivered. It is part of this demo app — it is not
          connected to any hospital, clinic, EHR, pharmacy or care team, and no real person reads it. A handoff appears here only after
          CareSignal&apos;s server confirmed it saved the approved payload (<strong>Received</strong>). <strong>Acknowledged</strong> is a separate
          click on this page. Neither means a clinician took action or that care changed.
        </p>
        <p className="meta">
          <span>
            Queue: {queue.length} received · {waiting} waiting for acknowledgement
          </span>
        </p>
      </header>

      {queue.length === 0 ? (
        <EmptyState title="Nothing received yet">
          No handoff for this case has been saved by the simulated receiver. <Link href={`/cases/${caseId}/handoffs`}>Go to Handoffs</Link>
        </EmptyState>
      ) : (
        queue.map(({ handoff: h, receipt, history, responses }) => {
          const r = receipt!;
          const status = r.acknowledgedAt ? "acknowledged" : "received";
          return (
            <article key={h.id} className="card" aria-labelledby={`r-${h.displayId}`} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <KindTag kind="receiver" />
              <div className="section-head" style={{ marginBottom: 0 }}>
                <h2 id={`r-${h.displayId}`}>
                  Handoff {h.displayId} · version {h.version}
                </h2>
                <StatusBadge status={status} />
              </div>
              <p>
                {c.pseudonym} (synthetic) · {periodLabel(h)}. Saved by the simulated receiver {fmtDateTime(r.receivedAt)}.
                {r.acknowledgedAt ? ` Acknowledged on this page ${fmtDateTime(r.acknowledgedAt)}.` : " Not acknowledged yet."}
              </p>
              <p className="meta">
                <span>Receipt ID {r.receiptCode ?? "— (seeded example)"}</span>
                {r.payloadSha256 && <span>· SHA-256 {r.payloadSha256.slice(0, 16)}…</span>}
                {h.draftedBy === "seed_fixture" && <span>· Example from this synthetic scenario</span>}
              </p>

              {!r.acknowledgedAt && (
                <form action={acknowledgeHandoffAction}>
                  <input type="hidden" name="caseId" value={caseId} />
                  <input type="hidden" name="handoffId" value={h.id} />
                  <button className="btn btn-secondary" type="submit">
                    Acknowledge receipt (simulated — no clinician acts)
                  </button>
                </form>
              )}
              {scenarioResponse && r.acknowledgedAt && responses.length === 0 && (
                <form action={addFictionalResponseAction}>
                  <input type="hidden" name="caseId" value={caseId} />
                  <input type="hidden" name="handoffId" value={h.id} />
                  <button className="btn btn-secondary" type="submit">
                    Add this scenario&apos;s fictional outcome (synthetic)
                  </button>
                </form>
              )}
              {responses.map((x) => (
                <FictionalResponse key={x.id} text={x.text} label={x.label} at={x.at} />
              ))}

              {r.payload.patterns && (
                <details open>
                  <summary className="muted-link" style={{ cursor: "pointer" }}>
                    The submitted handoff, exactly as approved (structured)
                  </summary>
                  <StructuredHandoff caseId={caseId} content={r.payload} notes={notes} />
                </details>
              )}

              <details>
                <summary className="muted-link" style={{ cursor: "pointer" }}>
                  Show the exact saved payload
                </summary>
                <pre className="payload">{r.payloadText ? JSON.stringify(JSON.parse(r.payloadText), null, 2) : JSON.stringify(r.payload, null, 2)}</pre>
              </details>
              <details>
                <summary className="muted-link" style={{ cursor: "pointer" }}>
                  Status history
                </summary>
                <HistoryList history={history} />
              </details>
            </article>
          );
        })
      )}
    </>
  );
}
