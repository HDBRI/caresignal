import Link from "next/link";
import { requireActor, principalOf } from "@/lib/auth/session";
import { getDb } from "@/lib/repo/db";
import { listHandoffs } from "@/lib/repo/handoffs";
import { EmptyState, fmtDateTime } from "@/components/display";
import { InfoIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

/** Screen 7 — Demo receiver: a SIMULATED care-team inbox. Shows only payloads the backend actually persisted. */
export default async function ReceiverPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const actor = await requireActor();
  const handoffs = await listHandoffs(await getDb(), principalOf(actor), caseId);
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
              <h2 id={`r-${h.displayId}`}>Handoff {h.displayId}</h2>
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

            {responses.map((r) => (
              <div key={r.id} className="card" style={{ background: "var(--attention-bg)", borderColor: "#efd9a8" }}>
                <p className="stat-label" style={{ color: "var(--attention)", fontWeight: 600 }}>
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
              <ol style={{ paddingLeft: 20 }}>
                {history.map((e) => (
                  <li key={e.id}>
                    {e.status} · {fmtDateTime(e.at)}
                    {e.note ? ` — ${e.note}` : ""}
                  </li>
                ))}
              </ol>
            </details>
          </article>
        ))
      )}
    </>
  );
}
