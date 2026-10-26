import Link from "next/link";
import { aiStatus } from "@/lib/ai/client";
import { PERIOD_LABEL, type Period } from "@/lib/ai/insights";
import { requireActor, principalOf } from "@/lib/auth/session";
import { aiLimits } from "@/lib/config";
import { getDb } from "@/lib/repo/db";
import { listInsightRuns } from "@/lib/repo/handoffs";
import { listObservations } from "@/lib/repo/observations";
import { aiCallsToday } from "@/lib/repo/usage";
import { EmptyState, fmtDateTime } from "@/components/display";
import { GenerateInsightsForm } from "@/components/GenerateInsightsForm";
import { AlertIcon, InfoIcon, SparkIcon } from "@/components/icons";
import type { Insight } from "@/lib/models";

export const dynamic = "force-dynamic";

const PERIODS: Period[] = ["last7", "last14", "all"];

const RUN_STATUS_MESSAGE: Record<string, string> = {
  failed: "The AI request didn't work (timeout or provider error). Nothing was generated and no AI result is shown. Your notes are unchanged.",
  failed_validation:
    "The AI's answer didn't pass CareSignal's checks (for example, it cited a note that doesn't exist, added something the notes don't say, or wasn't in the required format), so it was discarded. Nothing is shown in its place.",
  unavailable_error: "AI analysis is currently unavailable. You can continue logging notes and using the prototype's predefined safety rules.",
  unavailable_limit: "AI analysis is temporarily unavailable because the daily limit was reached. Notes and safety rules are not affected.",
};

const GROUPS: { support: Insight["support"]; title: string; blurb: string }[] = [
  { support: "supported", title: "Supported by the notes", blurb: "More than a single mention, or clearly stated — check the quotes." },
  { support: "possible_unconfirmed", title: "Possible — not confirmed", blurb: "Something the notes hint at but don't establish." },
  { support: "conflicting", title: "Reports that conflict", blurb: "Notes disagree. Both are kept; CareSignal does not pick one." },
];

function SourceChips({ caseId, ids }: { caseId: string; ids: string[] }) {
  return (
    <span className="chip-row" style={{ display: "inline-flex" }}>
      {ids.map((s) => (
        <Link key={s} className="chip" href={`/cases/${caseId}/observations/${s}`} title="Open the original note">
          {s}
        </Link>
      ))}
    </span>
  );
}

/** Deterministic notice (not AI) on any AI item that cites a note which matched an urgent safety rule. */
function UrgentNote({ ids, tiers }: { ids: string[]; tiers: Record<string, string> }) {
  const hit = ids.filter((id) => tiers[id]);
  if (!hit.length) return null;
  const emergency = hit.some((id) => tiers[id] === "emergency");
  return (
    <p className={`pill ${emergency ? "pill-emergency" : "pill-attention"}`} style={{ alignSelf: "flex-start", whiteSpace: "normal" }}>
      <AlertIcon size={13} /> {hit.join(", ")} matched {emergency ? "an emergency" : "a contact-the-care-team"} safety rule.{" "}
      {emergency ? "If this is happening now, call 911." : "Contact the care team promptly."} This summary does not replace that guidance.
    </p>
  );
}

/** Screen 5 — Insights: evidence-linked AI summaries. Only validated, stored AI output is ever shown. */
export default async function InsightsPage({
  params,
  searchParams,
}: {
  params: Promise<{ caseId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { caseId } = await params;
  const sp = await searchParams;
  const period: Period = (PERIODS as string[]).includes(sp.period ?? "") ? (sp.period as Period) : "last7";
  const actor = await requireActor();
  const db = await getDb();
  const p = principalOf(actor);
  const [runs, observations, usedToday] = await Promise.all([listInsightRuns(db, p, caseId), listObservations(db, p, caseId), aiCallsToday(db, p.userId)]);
  const shown = (sp.run && runs.find((r) => r.run.id === sp.run)) || runs[0];
  const lastComplete = runs.find((r) => r.run.status === "complete");
  const limits = aiLimits();
  const available = aiStatus() === "available";
  const capReached = usedToday >= limits.perUser;
  const byId = new Map(observations.map((o) => [o.displayId, o]));
  // Deterministic, not AI: notes that matched an emergency / contact-care-team rule.
  const urgentTiers: Record<string, string> = Object.fromEntries(
    observations.filter((o) => o.safetyTier === "emergency" || o.safetyTier === "contact_care_team").map((o) => [o.displayId, o.safetyTier]),
  );

  return (
    <>
      <header style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <h1>Insights</h1>
        <p className="secondary" style={{ fontSize: 15 }}>
          Here&apos;s what the logged observations may suggest. Every point links to the original notes — please check the quotes,
          dates and what is missing. Insights are AI-generated, can be wrong, and are not medical advice. They never replace the
          safety rules.
        </p>
      </header>

      <section className="card" aria-labelledby="gen-h" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 id="gen-h" style={{ fontSize: 17 }}>
          Generate insights
        </h2>
        <nav aria-label="Choose period" className="chip-row">
          {PERIODS.map((per) => (
            <Link key={per} className="chip" href={`/cases/${caseId}/insights?period=${per}`} aria-current={per === period ? "true" : undefined}>
              {PERIOD_LABEL[per]}
            </Link>
          ))}
        </nav>
        <GenerateInsightsForm caseId={caseId} period={period} disabled={!available || capReached} label={`Generate for ${PERIOD_LABEL[period].toLowerCase()}`} />
        <p className="secondary">
          {!available
            ? "AI analysis is currently unavailable. You can continue logging notes and using the prototype's predefined safety rules."
            : capReached
              ? "AI analysis is temporarily unavailable because today's limit was reached. Notes and safety rules are not affected."
              : `Uses ${PERIOD_LABEL[period].toLowerCase()} of notes. ${limits.perUser - usedToday} of ${limits.perUser} AI requests left today.`}
        </p>
      </section>

      {sp.result === "empty" && (
        <EmptyState title="Nothing to summarize for this period">
          No observations were logged for this period. There isn&apos;t enough recorded information to summarize this period.
        </EmptyState>
      )}
      {sp.result === "error" && (
        <p className="form-error" role="alert">
          <AlertIcon size={17} /> Something went wrong while generating insights. Nothing was saved or shown. Please try again.
        </p>
      )}

      {!shown ? (
        sp.result !== "empty" && (
          <EmptyState title="No insights generated yet">
            Choose a period and select <strong>Generate</strong>. Nothing is shown until real, checked AI output exists — CareSignal
            never displays placeholder AI results.
          </EmptyState>
        )
      ) : shown.run.status !== "complete" ? (
        <section className="card" role="status" style={{ borderLeft: "6px solid var(--attention)", display: "flex", flexDirection: "column", gap: 8 }}>
          <h2 style={{ fontSize: 18, display: "flex", gap: 8, alignItems: "center" }}>
            <AlertIcon size={18} /> Last attempt: no insights produced
          </h2>
          <p>{RUN_STATUS_MESSAGE[shown.run.status] ?? "No insights were produced."}</p>
          <p className="secondary">Attempted {fmtDateTime(shown.run.createdAt)}.</p>
          {lastComplete && (
            <Link href={`/cases/${caseId}/insights?run=${lastComplete.run.id}`} className="muted-link">
              Show the last successful insights ({fmtDateTime(lastComplete.run.generatedAt ?? lastComplete.run.createdAt)})
            </Link>
          )}
        </section>
      ) : (
        <article className="ai-box" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 18 }} aria-labelledby="ai-run-h">
          <header style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="ai-box-label" style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <SparkIcon size={14} /> AI-generated insights — derived from caregiver notes, not written by the caregiver
            </span>
            <h2 id="ai-run-h" style={{ fontSize: 19 }}>
              What the logged observations may suggest
            </h2>
            <p className="meta">
              <span>{shown.run.origin === "seeded" ? "Generated once when this demo example was prepared" : "Generated"} {fmtDateTime(shown.run.generatedAt)}</span>
              <span>· {shown.run.modelReported ?? "model not reported"}</span>
              <span>· from {shown.run.inputSourceIds.length} notes</span>
            </p>
            {shown.run.rejectedItems > 0 && (
              <p className="pill pill-attention" style={{ alignSelf: "flex-start" }}>
                <InfoIcon size={13} /> {shown.run.rejectedItems} AI statement{shown.run.rejectedItems > 1 ? "s were" : " was"} removed because{" "}
                {shown.run.rejectedItems > 1 ? "they" : "it"} failed CareSignal&apos;s checks
              </p>
            )}
          </header>

          <section aria-labelledby="sum-h" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <h3 id="sum-h">Summary</h3>
            <p>{shown.run.summary}</p>
            <UrgentNote ids={shown.run.inputSourceIds} tiers={urgentTiers} />
          </section>

          {GROUPS.map((g) => {
            const items = shown.insights.filter((i) => i.kind !== "question" && i.support === g.support);
            if (items.length === 0) return null;
            return (
              <section key={g.support} aria-labelledby={`g-${g.support}`}>
                <h3 id={`g-${g.support}`}>{g.title}</h3>
                <p className="secondary">{g.blurb}</p>
                <ul className="list-plain" style={{ marginTop: 8 }}>
                  {items.map((i) => (
                    <li key={i.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <p style={{ fontWeight: 500 }}>{i.statement}</p>
                      <UrgentNote ids={i.sourceIds} tiers={urgentTiers} />
                      {i.comparesToBaseline && <span className="pill pill-unknown" style={{ alignSelf: "flex-start" }}>Compared with the caregiver-reported baseline</span>}
                      {i.evidence.map((e, k) => (
                        <blockquote key={k} className="quote" style={{ fontSize: 14 }}>
                          <Link href={`/cases/${caseId}/observations/${e.sourceId}`}>{e.sourceId}</Link>
                          <span className="secondary"> · caregiver&apos;s words: </span>“{e.quote}”
                          {byId.get(e.sourceId)?.authorLabel ? <span className="secondary"> — {byId.get(e.sourceId)!.authorLabel}</span> : null}
                        </blockquote>
                      ))}
                      {i.uncertainty && (
                        <p className="secondary">
                          <strong>Uncertain:</strong> {i.uncertainty}
                        </p>
                      )}
                      <p className="meta">
                        <span>Sources:</span> <SourceChips caseId={caseId} ids={i.sourceIds} />
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}

          <section aria-labelledby="unk-h">
            <h3 id="unk-h">What&apos;s unknown or missing</h3>
            {shown.run.unknowns.length === 0 ? (
              <p className="secondary">The AI listed no gaps. That does not mean nothing is missing.</p>
            ) : (
              <ul style={{ margin: "6px 0 0", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
                {shown.run.unknowns.map((u, k) => (
                  <li key={k}>
                    {u.statement} {u.sourceIds.length > 0 && <SourceChips caseId={caseId} ids={u.sourceIds} />}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="q-h">
            <h3 id="q-h">Questions you may want to ask the care team</h3>
            <ul className="list-plain" style={{ marginTop: 6 }}>
              {shown.insights
                .filter((i) => i.kind === "question")
                .map((q) => (
                  <li key={q.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span>
                      {q.statement} <SourceChips caseId={caseId} ids={q.sourceIds} />
                    </span>
                    <UrgentNote ids={q.sourceIds} tiers={urgentTiers} />
                  </li>
                ))}
            </ul>
          </section>

          <p className="secondary">
            These are draft questions to help a conversation — not medical advice. CareSignal never suggests medication changes. Urgent
            concerns are handled by the safety rules and 911 guidance, not by this summary.
          </p>
        </article>
      )}

      {runs.length > 1 && (
        <details className="card">
          <summary className="muted-link" style={{ cursor: "pointer" }}>
            Earlier runs ({runs.length - 1})
          </summary>
          <ul className="list-plain" style={{ marginTop: 10 }}>
            {runs
              .filter((r) => r.run.id !== shown?.run.id)
              .map((r) => (
                <li key={r.run.id}>
                  <Link href={`/cases/${caseId}/insights?run=${r.run.id}`}>
                    {fmtDateTime(r.run.generatedAt ?? r.run.createdAt)} — {r.run.status === "complete" ? `${r.insights.filter((i) => i.kind !== "question").length} insights` : r.run.status.replaceAll("_", " ")}
                  </Link>
                  {r.run.origin === "seeded" && <span className="secondary"> · prepared with the demo</span>}
                </li>
              ))}
          </ul>
        </details>
      )}
    </>
  );
}
