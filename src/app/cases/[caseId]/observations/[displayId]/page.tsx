import Link from "next/link";
import { notFound } from "next/navigation";
import { categoryLabel } from "@/lib/categories";
import { requireActor, principalOf } from "@/lib/auth/session";
import { getDb } from "@/lib/repo/db";
import { NotFoundError } from "@/lib/repo/cases";
import { getObservationByDisplayId, listAnalyses } from "@/lib/repo/observations";
import { SAFETY_LIMITATION, SAFETY_RULES, TIER_GUIDANCE } from "@/lib/safety/rules";
import { AI_STATE_LABEL, fmtDateTime, OriginTag, SafetyPill } from "@/components/display";

export const dynamic = "force-dynamic";

/** Observation detail: the original note, its stable ID, timestamps, safety result, AI state and edit history. */
export default async function ObservationDetail({ params }: { params: Promise<{ caseId: string; displayId: string }> }) {
  const { caseId, displayId } = await params;
  const actor = await requireActor();
  const db = await getDb();
  const p = principalOf(actor);
  let detail;
  try {
    detail = await getObservationByDisplayId(db, p, caseId, decodeURIComponent(displayId));
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  const { observation: o, edits, alert } = detail;
  const analysis = (await listAnalyses(db, p, caseId)).get(o.id);
  const ruleLabel = (id: string) => SAFETY_RULES.find((r) => r.id === id)?.label ?? id;

  return (
    <>
      <Link href={`/cases/${caseId}/observations`} className="muted-link">
        ← Back to all observations
      </Link>
      <header style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span className="stat-label">Observation</span>
        <h1>{o.displayId}</h1>
        <div className="chip-row">
          <OriginTag o={o} />
          <SafetyPill tier={o.safetyTier} />
          {o.isTestScenario && <span className="pill pill-unknown">Predefined synthetic test scenario</span>}
        </div>
      </header>

      <section className="card" aria-labelledby="orig-h">
        <h2 id="orig-h" className="original-label" style={{ fontSize: 13 }}>
          Caregiver&apos;s note — original, exactly as entered (version 1, never changed)
        </h2>
        <p style={{ fontSize: 17, marginTop: 8, whiteSpace: "pre-wrap" }}>“{o.originalText}”</p>
        <dl className="secondary" style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 14px", marginTop: 14 }}>
          <dt>Stable ID</dt>
          <dd style={{ margin: 0 }}>{o.displayId}</dd>
          <dt>Logged (entry time)</dt>
          <dd style={{ margin: 0 }}>{fmtDateTime(o.enteredAt)}</dd>
          <dt>When it happened</dt>
          <dd style={{ margin: 0 }}>{o.eventTime ? fmtDateTime(o.eventTime) : "Not provided by the caregiver"}</dd>
          <dt>Written by</dt>
          <dd style={{ margin: 0 }}>{o.authorLabel ?? "Not provided"}</dd>
        </dl>
      </section>

      <section className="card" aria-labelledby="safety-h">
        <h2 id="safety-h" style={{ fontSize: 19 }}>
          Safety rules (predefined, no AI)
        </h2>
        {o.safetyRuleIds.length ? (
          <>
            <p style={{ marginTop: 8 }}>
              <strong>{TIER_GUIDANCE[o.safetyTier as keyof typeof TIER_GUIDANCE]?.title}.</strong>{" "}
              {TIER_GUIDANCE[o.safetyTier as keyof typeof TIER_GUIDANCE]?.body}
            </p>
            <p className="secondary">
              Rules: {o.safetyRuleIds.map((id) => `${ruleLabel(id)} (${id})`).join(", ")} · rules version {o.safetyRulesVersion}
            </p>
            <p className="secondary">
              Notice status: {alert?.seenAt ? `marked as seen ${fmtDateTime(alert.seenAt)} (seen is not “resolved”)` : "not yet marked as seen"}
            </p>
          </>
        ) : (
          <p style={{ marginTop: 8 }}>No predefined rule matched — this does not mean the situation is safe.</p>
        )}
        <p className="secondary" style={{ marginTop: 6 }}>
          {SAFETY_LIMITATION}
        </p>
      </section>

      <section className="card ai-box" aria-labelledby="ai-h" style={{ borderStyle: "dashed" }}>
        <h2 id="ai-h" className="ai-box-label" style={{ fontSize: 13 }}>
          AI-generated (separate from the original note)
        </h2>
        {analysis ? (
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
            <div className="chip-row">
              {[analysis.primaryCategory, ...analysis.secondaryCategories].map((c) => (
                <Link key={c} className="chip" href={`/cases/${caseId}/observations?category=${c}`}>
                  {categoryLabel(c)}
                </Link>
              ))}
            </div>
            {analysis.summary && <p>{analysis.summary}</p>}
            <p className="secondary">
              {analysis.modelReported ?? "model not reported"} · {fmtDateTime(analysis.createdAt)}
            </p>
          </div>
        ) : (
          <p style={{ marginTop: 8 }}>{AI_STATE_LABEL[o.aiState]}.</p>
        )}
      </section>

      <section className="card" aria-labelledby="hist-h">
        <h2 id="hist-h" style={{ fontSize: 19 }}>
          Edit history
        </h2>
        {edits.length === 0 ? (
          <p className="secondary" style={{ marginTop: 6 }}>
            Not edited. Only the original version exists.
          </p>
        ) : (
          <ol className="list-plain" style={{ marginTop: 8 }}>
            {edits.map((e) => (
              <li key={e.id}>
                <span className="meta">
                  Version {e.version} · {fmtDateTime(e.editedAt)}
                </span>
                <p>“{e.editedText}”</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
