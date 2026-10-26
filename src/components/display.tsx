/** Shared display helpers for case screens (server-safe). */
import Link from "next/link";
import { categoryLabel } from "@/lib/categories";
import type { AiState, Observation, ObservationAnalysis } from "@/lib/models";
import { DEMO_TIME_ZONE } from "@/lib/time";
import { retryAiAction } from "@/app/actions/observations";
import { AlertIcon, InfoIcon } from "./icons";

export function fmtDateTime(iso: string | null): string {
  if (!iso) return "Not provided";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: DEMO_TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function fmtDay(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

/** Every AI state shown honestly. Only "complete" ever shows labels. */
export const AI_STATE_LABEL: Record<AiState, string> = {
  pending: "Pending — AI is suggesting categories",
  complete: "Complete",
  failed: "Failed — the AI call didn't work; note saved",
  failed_validation: "Failed — the AI's answer didn't pass our checks and was discarded; note saved",
  unavailable_error: "Unavailable — AI is not available right now; note saved",
  unavailable_limit: "Unavailable — daily AI limit reached; note saved, safety rules still ran",
  not_run: "Not analyzed — seeded example (you can ask the AI)",
};

/** A pending note older than 2 minutes almost certainly lost its background job. */
export function isStalePending(o: Observation): boolean {
  return o.aiState === "pending" && Date.now() - new Date(o.enteredAt).getTime() > 2 * 60_000;
}

export function canRetryAi(o: Observation): boolean {
  return ["failed", "failed_validation", "unavailable_error", "unavailable_limit", "not_run"].includes(o.aiState) || isStalePending(o);
}

export function SafetyPill({ tier }: { tier: Observation["safetyTier"] }) {
  if (tier === "emergency")
    return (
      <span className="pill pill-emergency">
        <AlertIcon size={13} /> Emergency rule matched
      </span>
    );
  if (tier === "contact_care_team")
    return (
      <span className="pill pill-attention">
        <AlertIcon size={13} /> Contact care team
      </span>
    );
  if (tier === "review")
    return (
      <span className="pill pill-attention">
        <AlertIcon size={13} /> Please review
      </span>
    );
  return (
    <span className="pill pill-unknown" title="No predefined rule matched — this does not mean the situation is safe.">
      <InfoIcon size={13} /> No rule matched
    </span>
  );
}

export function OriginTag({ o }: { o: Observation }) {
  return o.origin === "seeded" ? (
    <span className="pill pill-unknown">Synthetic · seeded example</span>
  ) : (
    <span className="pill badge-account">Added by you</span>
  );
}

/** One observation: the caregiver's original words, clearly separated from any AI-generated content. */
export function RetryAiButton({ o, caseId, label }: { o: Observation; caseId: string; label?: string }) {
  if (!canRetryAi(o)) return null;
  return (
    <form action={retryAiAction} style={{ display: "inline" }}>
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="observationId" value={o.id} />
      <button type="submit" className="btn btn-ghost" style={{ minHeight: 32, padding: "0 8px" }}>
        {label ?? (o.aiState === "not_run" ? "Ask AI for categories" : "Try AI again")}
      </button>
    </form>
  );
}

export function AiStateText({ o }: { o: Observation }) {
  if (isStalePending(o)) return <>Didn&apos;t finish — the AI step stopped before completing; note saved</>;
  return <>{AI_STATE_LABEL[o.aiState]}</>;
}

export function ObservationItem({
  o,
  analysis,
  caseId,
  compact = false,
  currentWording,
}: {
  o: Observation;
  analysis?: ObservationAnalysis;
  caseId: string;
  compact?: boolean;
  /** Latest edited version, if the caregiver corrected the wording. The original is always shown. */
  currentWording?: { text: string; version: number } | null;
}) {
  return (
    <article style={{ display: "flex", flexDirection: "column", gap: 8 }} aria-labelledby={`obs-${o.displayId}`}>
      <div className="meta">
        <Link id={`obs-${o.displayId}`} href={`/cases/${caseId}/observations/${o.displayId}`} style={{ fontWeight: 600 }}>
          {o.displayId}
        </Link>
        <span>Logged {fmtDateTime(o.enteredAt)}</span>
        <span>· Happened: {o.eventTime ? fmtDateTime(o.eventTime) : "not provided"}</span>
        {o.authorLabel && <span>· By {o.authorLabel}</span>}
      </div>
      <div>
        <span className="original-label">Caregiver&apos;s note (original)</span>
        <p style={{ marginTop: 2, whiteSpace: "pre-wrap" }}>“{o.originalText}”</p>
        {currentWording && (
          <p className="secondary" style={{ marginTop: 4 }}>
            Corrected wording (version {currentWording.version}): “{currentWording.text}”
          </p>
        )}
      </div>
      <div className="chip-row" style={{ alignItems: "center" }}>
        <OriginTag o={o} />
        <SafetyPill tier={o.safetyTier} />
        {o.isTestScenario && <span className="pill pill-unknown">Predefined test scenario</span>}
      </div>
      {!compact && (
        <div className="ai-box" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span className="ai-box-label">{analysis?.source === "caregiver" ? "Categories (corrected by caregiver)" : "AI-generated categories"}</span>
          {analysis && (analysis.source === "caregiver" || o.aiState === "complete") ? (
            <span className="chip-row" style={{ display: "inline-flex" }}>
              {[analysis.primaryCategory, ...analysis.secondaryCategories].map((c) => (
                <Link key={c} className="chip" href={`/cases/${caseId}/observations?category=${c}`}>
                  {categoryLabel(c)}
                </Link>
              ))}
            </span>
          ) : (
            <span className="secondary">
              <AiStateText o={o} />
            </span>
          )}
          <RetryAiButton o={o} caseId={caseId} />
        </div>
      )}
    </article>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="card" style={{ textAlign: "center", padding: "32px 24px", display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
      <h3>{title}</h3>
      {children && <div className="secondary" style={{ maxWidth: 520 }}>{children}</div>}
    </div>
  );
}
