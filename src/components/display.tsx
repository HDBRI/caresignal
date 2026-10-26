/** Shared display helpers for case screens (server-safe). */
import Link from "next/link";
import { categoryLabel } from "@/lib/categories";
import type { AiState, Observation, ObservationAnalysis } from "@/lib/models";
import { DEMO_TIME_ZONE } from "@/lib/time";
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

export const AI_STATE_LABEL: Record<AiState, string> = {
  pending: "AI analysis in progress",
  complete: "AI-suggested labels",
  failed: "AI analysis failed — note saved",
  failed_validation: "AI output rejected by checks — note saved",
  unavailable_error: "AI unavailable — note saved",
  unavailable_limit: "AI daily limit reached — not analyzed",
  not_run: "Not analyzed by AI yet",
};

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
export function ObservationItem({
  o,
  analysis,
  caseId,
  compact = false,
}: {
  o: Observation;
  analysis?: ObservationAnalysis;
  caseId: string;
  compact?: boolean;
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
      </div>
      <div className="chip-row" style={{ alignItems: "center" }}>
        <OriginTag o={o} />
        <SafetyPill tier={o.safetyTier} />
        {o.isTestScenario && <span className="pill pill-unknown">Predefined test scenario</span>}
      </div>
      {!compact && (
        <div className="ai-box">
          <span className="ai-box-label">AI-generated</span>{" "}
          {analysis ? (
            <>
              <span className="chip-row" style={{ display: "inline-flex" }}>
                {[analysis.primaryCategory, ...analysis.secondaryCategories].map((c) => (
                  <Link key={c} className="chip" href={`/cases/${caseId}/observations?category=${c}`}>
                    {categoryLabel(c)}
                  </Link>
                ))}
              </span>
              {analysis.summary && <p style={{ marginTop: 4 }}>{analysis.summary}</p>}
            </>
          ) : (
            <span className="secondary">{AI_STATE_LABEL[o.aiState]}</span>
          )}
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
