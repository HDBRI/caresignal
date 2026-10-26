import Link from "next/link";
import { requireActor, principalOf } from "@/lib/auth/session";
import { getDb } from "@/lib/repo/db";
import { listHandoffs } from "@/lib/repo/handoffs";
import { EmptyState, fmtDateTime } from "@/components/display";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = {
  draft: "Draft — not sent yet",
  reviewed: "Reviewed and approved — ready to send",
  submitted: "Sent — waiting for confirmation",
  received: "Received by the simulated care team",
  acknowledged: "Received and acknowledged by the simulated care team",
  failed: "Didn't go through — you can try again",
};
const SUPPORT: Record<string, string> = {
  supported: "Supported",
  possible_unconfirmed: "Possible, not confirmed",
  conflicting: "Conflicting reports",
  unknown: "Unknown",
};

function Sources({ caseId, ids }: { caseId: string; ids: string[] }) {
  return (
    <span className="chip-row" style={{ display: "inline-flex", marginLeft: 6 }}>
      {ids.map((s) => (
        <Link key={s} className="chip" href={`/cases/${caseId}/observations/${s}`}>
          {s}
        </Link>
      ))}
    </span>
  );
}

/** Screen 6 — Handoffs: content, included sources and status history. Nothing is ever sent automatically. */
export default async function HandoffsPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const actor = await requireActor();
  const handoffs = await listHandoffs(await getDb(), principalOf(actor), caseId);

  return (
    <>
      <header>
        <h1>Handoffs</h1>
        <p className="secondary" style={{ fontSize: 15 }}>
          A handoff packages caregiver-reported observations for the care team. You review and approve it first — CareSignal
          never sends anything automatically, and the receiving “care team” is simulated.
        </p>
      </header>

      {handoffs.length === 0 ? (
        <EmptyState title="No handoffs yet">Handoff drafting is added in the next build step.</EmptyState>
      ) : (
        handoffs.map(({ handoff: h, history, receipt }) => (
          <article key={h.id} className="card" aria-labelledby={`h-${h.displayId}`} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="section-head" style={{ marginBottom: 0 }}>
              <h2 id={`h-${h.displayId}`}>{STATUS[h.status]}</h2>
              <span className="secondary">
                {h.draftedBy === "seed_fixture" ? "Example handoff written for this synthetic scenario" : h.draftedBy === "ai" ? "Drafted by AI, reviewed by you" : "Written by you"}
              </span>
            </div>
            <p className="meta">
              <span>Handoff ID {h.displayId}</span>
              <span>· Covers {fmtDateTime(h.periodStart)} – {fmtDateTime(h.periodEnd)}</span>
            </p>

            <section>
              <h3>Summary</h3>
              <p>{h.draft.summary}</p>
            </section>
            <section>
              <h3>What the notes show</h3>
              <ul className="list-plain">
                {h.draft.items.map((i) => (
                  <li key={i.statement}>
                    <span className="pill pill-unknown">{SUPPORT[i.support]}</span> {i.statement}
                    <Sources caseId={caseId} ids={i.sourceIds} />
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h3>Questions for the care team</h3>
              <ul className="list-plain">
                {h.draft.questions.map((q) => (
                  <li key={q.text}>
                    {q.text}
                    <Sources caseId={caseId} ids={q.sourceIds} />
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h3>Missing or unknown</h3>
              <ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>
                {h.draft.missingInfo.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </section>

            <section>
              <h3>Status history</h3>
              <ol style={{ margin: "6px 0 0", paddingLeft: 20 }}>
                {history.map((e) => (
                  <li key={e.id}>
                    <strong>{STATUS[e.status] ?? e.status}</strong> <span className="secondary">· {fmtDateTime(e.at)}</span>
                    {e.note ? <span className="secondary"> — {e.note}</span> : null}
                  </li>
                ))}
              </ol>
            </section>

            {receipt ? (
              <p className="secondary">
                Receipt: saved by the simulated receiver {fmtDateTime(receipt.receivedAt)}.{" "}
                <Link href={`/cases/${caseId}/receiver`}>View in Demo receiver</Link>
              </p>
            ) : (
              <p className="secondary">
                No receipt — this handoff has not been received. Reviewing, editing and submitting are added in the next build step.
              </p>
            )}
          </article>
        ))
      )}
    </>
  );
}
