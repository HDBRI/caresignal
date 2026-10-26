import Link from "next/link";
import { requireActor, principalOf } from "@/lib/auth/session";
import { getDb } from "@/lib/repo/db";
import { listHandoffs } from "@/lib/repo/handoffs";
import { EmptyState, fmtDateTime } from "@/components/display";
import { DraftButton } from "@/components/handoff/HandoffForms";
import { HANDOFF_STATUS, periodLabel, provenance, StatusBadge, StatusPath } from "@/components/handoff/HandoffView";

export const dynamic = "force-dynamic";

/** Screen 6 — Handoffs: this week's draft and every earlier version (kept unchanged). Nothing is sent automatically. */
export default async function HandoffsPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const actor = await requireActor();
  const handoffs = await listHandoffs(await getDb(), principalOf(actor), caseId);
  const open = handoffs.find((b) => b.handoff.status === "draft" || b.handoff.status === "reviewed");
  const stuck = handoffs.filter((b) => b.handoff.status === "failed" || b.handoff.status === "submitted");
  const sorted = [...handoffs].sort((a, b) => b.handoff.version - a.handoff.version || b.handoff.createdAt.localeCompare(a.handoff.createdAt));

  return (
    <>
      <header style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <h1>Handoffs</h1>
        <p className="secondary" style={{ fontSize: 15 }}>
          A weekly handoff organizes the last 7 days of caregiver-reported observations for a conversation with the care team. You review it,
          may edit it, and approve it first — CareSignal never sends anything automatically, and the receiving “care team” is simulated.
          Urgent notes are never held for the handoff: their guidance appears the moment they are saved.
        </p>
      </header>

      <section className="card" aria-labelledby="week-h" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h2 id="week-h" style={{ fontSize: 19 }}>This week</h2>
        {open ? (
          <>
            <p>
              <Link href={`/cases/${caseId}/handoffs/${open.handoff.displayId}`}>
                <strong>Version {open.handoff.version} · {periodLabel(open.handoff)}</strong>
              </Link>{" "}
              — {HANDOFF_STATUS[open.handoff.status]}.
            </p>
            <div>
              <Link className="btn btn-primary" href={`/cases/${caseId}/handoffs/${open.handoff.displayId}`}>
                {open.handoff.status === "draft" ? "Review this draft" : "Review and submit"}
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="secondary">
              Draft a handoff from the observations logged in the last 7 days. If a submitted version already covers these days, a new version is
              made only when you have added or corrected information since — the submitted one is kept unchanged.
            </p>
            <DraftButton caseId={caseId} label="Draft this week's handoff" />
          </>
        )}
      </section>

      {stuck.map(({ handoff: h }) => (
        <p key={h.id} className="form-error" role="alert" style={{ alignItems: "center" }}>
          <StatusBadge status={h.status} /> Version {h.version} ({h.displayId}) was not received by the simulated receiver.{" "}
          <Link href={`/cases/${caseId}/handoffs/${h.displayId}`}>Open it to retry safely</Link>
        </p>
      ))}

      {sorted.length === 0 ? (
        <EmptyState title="No handoffs yet">Drafting one doesn&apos;t send anything.</EmptyState>
      ) : (
        <section aria-labelledby="all-h" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h2 id="all-h" style={{ fontSize: 19 }}>All versions ({sorted.length})</h2>
          {sorted.map(({ handoff: h, receipt, responses }) => (
            <article key={h.id} className="card" aria-labelledby={`h-${h.displayId}`} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="section-head" style={{ marginBottom: 0 }}>
                <h3 id={`h-${h.displayId}`}>
                  <Link href={`/cases/${caseId}/handoffs/${h.displayId}`}>
                    Version {h.version} · {periodLabel(h)}
                  </Link>
                </h3>
                <StatusBadge status={h.status} />
              </div>
              <StatusPath status={h.status} />
              <p className="meta">
                <span>{provenance(h)}</span>
                <span>· Handoff ID {h.displayId}</span>
                <span>· {h.sourceIds.length} source note{h.sourceIds.length === 1 ? "" : "s"}</span>
                {h.submittedAt && <span>· Submitted {fmtDateTime(h.submittedAt)} (frozen — never changed afterwards)</span>}
                {receipt && <span>· Receipt saved by the simulated receiver</span>}
                {responses.length > 0 && <span>· Has a fictional simulated response</span>}
              </p>
              <p style={{ fontSize: 15 }}>{(h.approvedPayload ?? h.draft).summary}</p>
            </article>
          ))}
        </section>
      )}
    </>
  );
}
