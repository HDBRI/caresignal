import Link from "next/link";
import { notFound } from "next/navigation";
import { categoryLabel } from "@/lib/categories";
import { requireActor, principalOf } from "@/lib/auth/session";
import { getDb } from "@/lib/repo/db";
import { NotFoundError } from "@/lib/repo/cases";
import { getObservationByDisplayId, listAnalysisHistory } from "@/lib/repo/observations";
import { explainMatches, SAFETY_LIMITATION, TIER_GUIDANCE } from "@/lib/safety/rules";
import { AiStateText, fmtDateTime, OriginTag, RetryAiButton, SafetyPill } from "@/components/display";
import { AutoRefreshWhilePending, CategoryCorrectionForm, EditWordingForm } from "@/components/ObservationTools";

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
  const history = await listAnalysisHistory(db, p, o.id);
  const latestAi = history.find((h) => h.source === "ai");
  const latestCaregiver = history.find((h) => h.source === "caregiver");
  const effective = latestCaregiver ?? (o.aiState === "complete" ? latestAi : undefined);
  const currentText = edits.length ? edits[edits.length - 1].editedText : o.originalText;

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
              Why: {explainMatches(o.safetyRuleIds, alert?.matchedText ?? [])} Rule IDs {o.safetyRuleIds.join(", ")} · rules version {o.safetyRulesVersion}.
              Limited prototype rules, not validated triage.
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

      <AutoRefreshWhilePending pending={o.aiState === "pending"} />
      <section className="card ai-box" aria-labelledby="ai-h" style={{ borderStyle: "dashed", display: "flex", flexDirection: "column", gap: 10 }}>
        <h2 id="ai-h" className="ai-box-label" style={{ fontSize: 13 }}>
          Categories (separate from the original note)
        </h2>
        {/* A <div>, not a <p>: the retry button is a <form>, which may not be nested inside a paragraph (hydration error). */}
        <div>
          <strong>AI status:</strong> <AiStateText o={o} /> <RetryAiButton o={o} caseId={caseId} />
        </div>
        {latestAi ? (
          <p>
            <strong>AI suggested:</strong>{" "}
            {[latestAi.primaryCategory, ...latestAi.secondaryCategories].map((c) => categoryLabel(c)).join(", ")}{" "}
            <span className="secondary">
              ({latestAi.modelReported ?? "model not reported"}, {fmtDateTime(latestAi.createdAt)})
            </span>
          </p>
        ) : (
          <p className="secondary">No AI suggestion stored for this note.</p>
        )}
        {latestAi && latestAi.facts.length > 0 && (
          <div>
            <strong>Facts the AI found in the note</strong>
            <span className="secondary"> (each must quote the note exactly, or it is discarded)</span>
            <ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>
              {latestAi.facts.map((f, k) => (
                <li key={k}>
                  {f.fact} <span className="secondary">— from “{f.quote}”</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {latestCaregiver && (
          <p>
            <strong>Your correction (in use):</strong>{" "}
            {[latestCaregiver.primaryCategory, ...latestCaregiver.secondaryCategories].map((c) => categoryLabel(c)).join(", ")}{" "}
            <span className="secondary">({fmtDateTime(latestCaregiver.createdAt)})</span>
          </p>
        )}
        <details>
          <summary className="muted-link" style={{ cursor: "pointer" }}>
            {effective ? "Correct the categories" : "Set the categories yourself"}
          </summary>
          <div style={{ marginTop: 10 }}>
            <CategoryCorrectionForm
              caseId={caseId}
              observationId={o.id}
              primary={effective?.primaryCategory ?? null}
              secondary={effective?.secondaryCategories ?? []}
            />
          </div>
        </details>
        {history.length > 1 && (
          <details>
            <summary className="muted-link" style={{ cursor: "pointer" }}>
              Category history ({history.length})
            </summary>
            <ol style={{ paddingLeft: 20 }}>
              {history.map((h) => (
                <li key={h.id}>
                  {h.source === "ai" ? "AI" : "Caregiver"}: {[h.primaryCategory, ...h.secondaryCategories].map((c) => categoryLabel(c)).join(", ")} ·{" "}
                  {fmtDateTime(h.createdAt)}
                </li>
              ))}
            </ol>
          </details>
        )}
      </section>

      <section className="card" aria-labelledby="hist-h">
        <h2 id="hist-h" style={{ fontSize: 19 }}>
          Edit history
        </h2>
        <p className="secondary" style={{ marginTop: 6 }}>
          Version 1 (original) · {fmtDateTime(o.enteredAt)}: “{o.originalText}”
        </p>
        {edits.length === 0 ? (
          <p className="secondary" style={{ marginTop: 6 }}>
            Not edited. Only the original version exists.
          </p>
        ) : (
          <ol className="list-plain" style={{ marginTop: 8 }}>
            {edits.map((e) => (
              <li key={e.id}>
                <span className="meta">
                  Version {e.version} · edited {fmtDateTime(e.editedAt)}
                  {e.safetyTier && e.safetyTier !== "none" ? ` · safety rule matched (${e.safetyTier.replaceAll("_", " ")})` : ""}
                </span>
                <p>“{e.editedText}”</p>
              </li>
            ))}
          </ol>
        )}
        <details style={{ marginTop: 10 }}>
          <summary className="muted-link" style={{ cursor: "pointer" }}>
            Correct the wording (keeps the original)
          </summary>
          <div style={{ marginTop: 10 }}>
            <EditWordingForm caseId={caseId} observationId={o.id} current={currentText} />
          </div>
        </details>
      </section>
    </>
  );
}
