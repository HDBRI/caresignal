import Link from "next/link";
import { aiStatus } from "@/lib/ai/client";
import { requireActor, principalOf } from "@/lib/auth/session";
import { getDb } from "@/lib/repo/db";
import { listInsightRuns } from "@/lib/repo/handoffs";
import { listObservations } from "@/lib/repo/observations";
import { EmptyState, fmtDateTime } from "@/components/display";

export const dynamic = "force-dynamic";

const SUPPORT_LABEL: Record<string, string> = {
  supported: "Supported by several notes",
  possible_unconfirmed: "Possible — not confirmed",
  conflicting: "Reports conflict",
  unknown: "Unknown / not enough information",
};

/** Screen 5 — Insights: evidence-linked AI summaries. Only validated, stored AI output is shown. */
export default async function InsightsPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const actor = await requireActor();
  const db = await getDb();
  const p = principalOf(actor);
  const [runs, observations] = await Promise.all([listInsightRuns(db, p, caseId), listObservations(db, p, caseId)]);
  const latest = runs.find((r) => r.run.status === "complete");

  return (
    <>
      <header>
        <h1>Insights</h1>
        <p className="secondary" style={{ fontSize: 15 }}>
          Here&apos;s what the logged observations may suggest. Check each point against its source notes, dates and what is
          missing — insights are AI-generated and can be wrong.
        </p>
      </header>

      {!latest ? (
        <EmptyState title="No AI insights for this case yet">
          <p>
            CareSignal hasn&apos;t generated insights for these {observations.length} notes yet, so nothing is shown here. We
            never display a made-up or placeholder AI result.
          </p>
          <p style={{ marginTop: 8 }}>
            {aiStatus() === "available"
              ? "Insight generation is added in the next build step."
              : "AI analysis is currently unavailable. You can continue logging notes and using the prototype's predefined safety rules."}
          </p>
          <p style={{ marginTop: 8 }}>
            Meanwhile, every note is in the <Link href={`/cases/${caseId}/observations`}>Observations timeline</Link>.
          </p>
        </EmptyState>
      ) : (
        <section className="card" aria-labelledby="run-h">
          <div className="section-head">
            <h2 id="run-h">Latest insight run</h2>
            <span className="secondary">
              {latest.run.modelReported ?? "model not reported"} · generated {fmtDateTime(latest.run.generatedAt ?? latest.run.createdAt)}
            </span>
          </div>
          <ul className="list-plain">
            {latest.insights.map((i) => (
              <li key={i.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span className="pill pill-unknown" style={{ alignSelf: "flex-start" }}>
                  {SUPPORT_LABEL[i.support]}
                </span>
                <p>{i.statement}</p>
                {i.uncertainty && <p className="secondary">Uncertainty: {i.uncertainty}</p>}
                <p className="meta">
                  <span>Sources:</span>
                  {i.sourceIds.map((s) => (
                    <Link key={s} className="chip" href={`/cases/${caseId}/observations/${s}`}>
                      {s}
                    </Link>
                  ))}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
