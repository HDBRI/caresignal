import Link from "next/link";
import { aiStatus } from "@/lib/ai/client";
import { PERIOD_LABEL, type Period } from "@/lib/ai/insights";
import { requireActor, principalOf } from "@/lib/auth/session";
import { categoryLabel } from "@/lib/categories";
import { aiLimits } from "@/lib/config";
import { CHART_PERIODS, fmtShortDay, type ChartPeriod } from "@/lib/dashboard";
import { humanizeText, readableLabel } from "@/lib/humanize";
import type { Insight } from "@/lib/models";
import { loadDashboard } from "@/lib/repo/dashboard";
import { getDb } from "@/lib/repo/db";
import { localDate } from "@/lib/time";
import { listInsightRuns } from "@/lib/repo/handoffs";
import { listAlerts } from "@/lib/repo/observations";
import { aiCallsToday } from "@/lib/repo/usage";
import { TIER_GUIDANCE } from "@/lib/safety/rules";
import { fmtDateTime } from "@/components/display";
import { GenerateInsightsForm } from "@/components/GenerateInsightsForm";
import { AlertIcon, InfoIcon, SparkIcon } from "@/components/icons";
import { CategoryChart } from "@/components/insights/CategoryChart";
import { EvidenceButton, EvidenceProvider } from "@/components/insights/Evidence";

export const dynamic = "force-dynamic";

const AI_WINDOWS: Period[] = ["last7", "last14", "all"];

const RUN_STATUS_MESSAGE: Record<string, string> = {
  failed: "The AI request didn't work (timeout or provider error). Nothing was generated and no AI result is shown. Your notes are unchanged.",
  failed_validation:
    "The AI's answer didn't pass CareSignal's checks (for example, it cited a note that doesn't exist or added something the notes don't say), so it was discarded. Nothing is shown in its place.",
  unavailable_error: "AI analysis is currently unavailable. You can continue logging notes and using the prototype's predefined safety rules.",
  unavailable_limit: "AI analysis is temporarily unavailable because the daily limit was reached. Notes, charts and safety rules are not affected.",
};

const SUPPORT_LABEL: Record<Insight["support"], string> = {
  supported: "Supported by more than one note or clearly stated",
  possible_unconfirmed: "Possible — not confirmed",
  conflicting: "Reports conflict — both kept",
  unknown: "Unknown",
};

function SourceTag({ kind }: { kind: "records" | "rule" | "rule-urgent" | "ai" }) {
  const map = {
    records: { cls: "source-records", text: "From your records" },
    rule: { cls: "source-rule", text: "Safety rule" },
    "rule-urgent": { cls: "source-rule-urgent", text: "Safety rule · urgent" },
    ai: { cls: "source-ai", text: "AI interpretation" },
  } as const;
  return <span className={`source-tag ${map[kind].cls}`}>{map[kind].text}</span>;
}

/** Screen 5 — Care insights: descriptive charts from stored records first, AI interpretation clearly separated below. */
export default async function InsightsPage({
  params,
  searchParams,
}: {
  params: Promise<{ caseId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { caseId } = await params;
  const sp = await searchParams;
  const range: ChartPeriod = CHART_PERIODS.some((p) => p.id === sp.range) ? (sp.range as ChartPeriod) : "7d";
  const aiWindow: Period = (AI_WINDOWS as string[]).includes(sp.period ?? "") ? (sp.period as Period) : "last7";
  const actor = await requireActor();
  const db = await getDb();
  const p = principalOf(actor);
  const [dash, runs, usedToday, alerts] = await Promise.all([
    loadDashboard(db, p, caseId, range),
    listInsightRuns(db, p, caseId),
    aiCallsToday(db, p.userId),
    listAlerts(db, p, caseId),
  ]);
  const obs = dash.observations;
  const byInternalId = new Map(Object.values(obs).map((o) => [o.id, o]));
  const shown = (sp.run && runs.find((r) => r.run.id === sp.run)) || runs[0];
  const ai = (sp.run && runs.find((r) => r.run.id === sp.run && r.run.status === "complete")) || runs.find((r) => r.run.status === "complete");
  const limits = aiLimits();
  const aiAvailable = aiStatus() === "available";
  const capReached = usedToday >= limits.perUser;
  const urgentTiers = new Set(["emergency", "contact_care_team"]);
  const href = (q: Record<string, string>) => `/cases/${caseId}/insights?${new URLSearchParams({ range, period: aiWindow, ...q }).toString()}`;
  const inPeriod = (day: string) => Boolean(dash.period.start && day >= dash.period.start && day <= dash.period.end);
  const periodAlerts = alerts.filter((a) => {
    const o = byInternalId.get(a.observationId);
    return o && inPeriod(o.day);
  });
  const aiItems = ai ? ai.insights.filter((i) => i.kind !== "question") : [];
  const aiQuestions = ai ? ai.insights.filter((i) => i.kind === "question") : [];
  const runPeriod = (r: NonNullable<typeof ai>) =>
    r.run.periodStart && r.run.periodEnd
      ? `${fmtShortDay(localDate(new Date(r.run.periodStart)))}–${fmtShortDay(localDate(new Date(r.run.periodEnd)))}`
      : "an earlier period";
  const maxCount = Math.max(1, ...dash.series.flatMap((s) => s.buckets.map((b) => b.count)));
  const shownFindings = dash.findings.filter((f) => f.kind !== "single_mention");
  const singleMentions = dash.findings.filter((f) => f.kind === "single_mention");
  const fmtRange = dash.metrics.firstDay
    ? dash.metrics.firstDay === dash.metrics.lastDay
      ? fmtShortDay(dash.metrics.firstDay)
      : `${fmtShortDay(dash.metrics.firstDay)} – ${fmtShortDay(dash.metrics.lastDay!)}`
    : "—";

  return (
    <EvidenceProvider caseId={caseId} observations={obs}>
      {/* ---------------- A. Header ---------------- */}
      <header style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <h1>Care insights</h1>
            <p className="secondary" style={{ fontSize: 15 }}>
              Explore patterns in the observations recorded over time.
            </p>
          </div>
          <span className={`pill ${aiAvailable && !capReached ? "pill-calm" : "pill-unknown"}`}>
            {aiAvailable ? (capReached ? "New AI analysis paused today (limit reached)" : "AI analysis available") : "AI analysis unavailable"}
          </span>
        </div>
        <nav aria-label="Chart period" className="chip-row">
          {CHART_PERIODS.map((cp) => (
            <Link key={cp.id} className="chip" href={href({ range: cp.id })} aria-current={cp.id === range ? "true" : undefined}>
              {cp.label}
            </Link>
          ))}
        </nav>
        <p className="secondary">
          Charts and counts come from saved notes only and measure how much was written down — not how anyone is doing. Synthetic data; not
          medical advice.
        </p>
      </header>

      {/* ---------------- B. At a glance ---------------- */}
      <section aria-labelledby="glance-h">
        <h2 id="glance-h" className="sr-only">
          At a glance
        </h2>
        <div className="metric-row">
          <div className="metric">
            <p className="stat-label">Observations · {dash.period.label.toLowerCase()}</p>
            <p className="metric-value" data-testid="metric-observations">
              {dash.metrics.observations}
            </p>
          </div>
          <div className="metric">
            <p className="stat-label">Categories with notes</p>
            <p className="metric-value">{dash.metrics.categoriesRepresented} of 7</p>
          </div>
          <div className="metric">
            <p className="stat-label">Dates covered by these notes</p>
            <p className="metric-value" style={{ fontSize: 19 }}>
              {fmtRange}
            </p>
          </div>
          <div className="metric">
            <p className="stat-label">Safety notices not yet marked seen</p>
            <p className="metric-value">{dash.metrics.needReview}</p>
          </div>
        </div>
        {(dash.metrics.uncategorized > 0 || dash.metrics.undated > 0) && (
          <p className="secondary" style={{ marginTop: 8 }}>
            {dash.metrics.uncategorized > 0 && (
              <>
                {dash.metrics.uncategorized} note{dash.metrics.uncategorized === 1 ? " has" : "s have"} no category yet, so{" "}
                {dash.metrics.uncategorized === 1 ? "it isn't" : "they aren't"} in the charts below.{" "}
                <EvidenceButton ids={dash.uncategorizedIds} title="Notes without a category yet" label="See them" />
              </>
            )}
            {dash.metrics.undated > 0 && <> {dash.metrics.undated} note(s) have no readable date and are not charted.</>}
          </p>
        )}
      </section>

      {dash.metrics.observations === 0 ? (
        <section className="card" style={{ textAlign: "center", padding: "32px 24px" }}>
          <h2 style={{ fontSize: 19 }}>No observations were logged for this period</h2>
          <p className="secondary" style={{ marginTop: 6 }}>
            There isn&apos;t enough recorded information to summarize this period. That does not mean nothing happened.
          </p>
        </section>
      ) : (
        <>
          {/* ---------------- C. Category activity ---------------- */}
          <section aria-labelledby="cats-h" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="section-head" style={{ marginBottom: 0 }}>
              <h2 id="cats-h">Recorded activity by category</h2>
              <span className="secondary">
                Bars = logged observations per {dash.period.bucket}. One note can belong to more than one category, so category counts can add up to
                more than the total.
              </span>
            </div>
            <div className="chart-grid">
              {dash.series.map((s) => (
                <CategoryChart key={s.id} s={s} bucket={dash.period.bucket} maxCount={maxCount} periodLabel={dash.period.label} />
              ))}
            </div>
          </section>

          {/* ---------------- D. Changes worth reviewing ---------------- */}
          <section className="card" aria-labelledby="changes-h">
            <div className="section-head">
              <h2 id="changes-h">Changes worth reviewing</h2>
              <span className="secondary">Each item says where it comes from: your records, a safety rule, or the AI.</span>
            </div>
            <ul className="list-plain">
              {periodAlerts.map((a) => {
                const o = byInternalId.get(a.observationId)!;
                const g = TIER_GUIDANCE[a.tier];
                const urgent = urgentTiers.has(a.tier);
                return (
                  <li key={a.id} className="finding">
                    <span>
                      <SourceTag kind={urgent ? "rule-urgent" : "rule"} />
                    </span>
                    <h4 style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <AlertIcon size={15} /> {g.title} — {readableLabel(o)}
                    </h4>
                    <p>{g.body}</p>
                    <p className="meta">
                      <span>{a.seenAt ? `Marked as seen ${fmtDateTime(a.seenAt)} (seen is not “resolved”)` : "Not yet marked as seen"}</span>
                    </p>
                    <span>
                      <EvidenceButton ids={[o.displayId]} title={g.title} label="Review the note" />
                    </span>
                  </li>
                );
              })}
              {shownFindings.map((f) => (
                <li key={f.kind + f.title} className="finding">
                  <span>
                    <SourceTag kind="records" />
                  </span>
                  <h4>{f.title}</h4>
                  <p>{f.detail}</p>
                  <p className="meta">
                    <span>Period: {f.periodLabel}</span>
                    {f.categories.length > 0 && <span>· {f.categories.map(categoryLabel).join(", ")}</span>}
                    {f.comparisonBasis && <span>· Compared with: {f.comparisonBasis}</span>}
                  </p>
                  {f.uncertainty && <p className="secondary">{f.uncertainty}</p>}
                  <span>
                    <EvidenceButton ids={f.sourceIds} title={f.title} context={f.periodLabel} />
                  </span>
                </li>
              ))}
              {aiItems.map((i) => (
                <li key={i.id} className="finding">
                  <span>
                    <SourceTag kind="ai" />
                  </span>
                  <h4>{humanizeText(i.statement, obs)}</h4>
                  <p className="meta">
                    <span>{SUPPORT_LABEL[i.support]}</span>
                    {ai && <span>· AI analysis of {runPeriod(ai)}</span>}
                    {i.comparesToBaseline && <span>· compared with the caregiver-reported baseline</span>}
                  </p>
                  {i.uncertainty && (
                    <p className="secondary">
                      <strong>Uncertain:</strong> {humanizeText(i.uncertainty, obs)}
                    </p>
                  )}
                  {i.sourceIds.some((id) => urgentTiers.has(obs[id]?.safetyTier ?? "")) && (
                    <p className="pill pill-emergency" style={{ alignSelf: "flex-start", whiteSpace: "normal" }}>
                      <AlertIcon size={13} /> A note behind this matched an urgent safety rule. If this is happening now, call 911. This summary does not
                      replace that guidance.
                    </p>
                  )}
                  <span>
                    <EvidenceButton ids={i.sourceIds} title="Notes behind this AI interpretation" />
                  </span>
                </li>
              ))}
            </ul>
            {periodAlerts.length === 0 && shownFindings.length === 0 && aiItems.length === 0 && (
              <p className="secondary">
                Nothing stands out from the records in this period. That is not the same as “nothing to review” — no rule, count or AI can confirm
                that someone is fine.
              </p>
            )}
            {singleMentions.length > 0 && (
              <details style={{ marginTop: 8 }}>
                <summary className="muted-link" style={{ cursor: "pointer" }}>
                  Topics mentioned only once ({singleMentions.length})
                </summary>
                <ul className="list-plain" style={{ marginTop: 6 }}>
                  {singleMentions.map((f) => (
                    <li key={f.title} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <SourceTag kind="records" /> {f.title}
                      <EvidenceButton ids={f.sourceIds} title={f.title} label="Review the note" />
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>

          {/* ---------------- E. Baseline comparison ---------------- */}
          <section className="card" aria-labelledby="base-h">
            <div className="section-head">
              <h2 id="base-h">Compared with the usual baseline</h2>
              <span className="secondary">
                The baseline is what the caregiver says is usual — not a medical normal range. Comparison period: {dash.period.label.toLowerCase()}.
              </span>
            </div>
            <ul className="list-plain">
              {dash.baselines.map((b) => {
                const aiBaseline = aiItems.filter(
                  (i) => i.comparesToBaseline && i.sourceIds.some((id) => obs[id]?.categories.some((c) => b.categories.includes(c))),
                );
                return (
                  <li key={b.domain} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <p style={{ fontWeight: 600 }}>{b.domainLabel}</p>
                    <p>
                      <span className="secondary">Usual (caregiver-reported): </span>
                      {b.baseline ? `“${b.baseline}”` : <span className="pill pill-unknown">Not provided — nothing to compare with</span>}
                    </p>
                    <p className="secondary">
                      {b.status === "no_recent_notes"
                        ? `No notes in this period were about ${b.categories.map((c) => categoryLabel(c).toLowerCase()).join(" or ")}, so there is nothing recent to compare. That is not an improvement.`
                        : b.status === "notes_available"
                          ? `${b.sourceIds.length} recent note${b.sourceIds.length === 1 ? "" : "s"} relate to this area. Read them next to the baseline; CareSignal does not score the difference.`
                          : b.sourceIds.length
                            ? `${b.sourceIds.length} recent note${b.sourceIds.length === 1 ? "" : "s"} relate to this area, but without a baseline no comparison can be made.`
                            : "No baseline and no recent notes in this area."}
                    </p>
                    {aiBaseline.map((i) => (
                      <p key={i.id} style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                        <SourceTag kind="ai" /> {humanizeText(i.statement, obs)}
                      </p>
                    ))}
                    <span>
                      <EvidenceButton ids={b.sourceIds} title={`${b.domainLabel}: recent notes`} context={dash.period.label} />
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}

      {/* ---------------- F. Questions ---------------- */}
      <section className="card" aria-labelledby="q-h">
        <div className="section-head">
          <h2 id="q-h">Questions to consider discussing with the care team</h2>
          <span className="secondary">Drafted by the AI from the notes; not reviewed by a clinician. Safety notices are handled separately above.</span>
        </div>
        {aiQuestions.length === 0 ? (
          <p className="secondary">No questions have been generated yet. Generate an AI analysis below to draft some.</p>
        ) : (
          <ul className="list-plain">
            {aiQuestions.map((q) => (
              <li key={q.id} style={{ display: "flex", gap: 10, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
                <span>
                  <SourceTag kind="ai" /> {humanizeText(q.statement, obs)}
                </span>
                <EvidenceButton ids={q.sourceIds} title="Notes behind this question" />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------------- G. Detailed AI analysis ---------------- */}
      <section className="card" aria-labelledby="ai-h" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="section-head" style={{ marginBottom: 0 }}>
          <h2 id="ai-h" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <SparkIcon size={18} /> AI analysis
          </h2>
          <span className="secondary">The AI window is separate from the chart period above; changing the chart never calls the AI.</span>
        </div>
        <nav aria-label="AI analysis window" className="chip-row" style={{ alignItems: "center" }}>
          <span className="stat-label">AI window:</span>
          {AI_WINDOWS.map((w) => (
            <Link key={w} className="chip" href={href({ period: w })} aria-current={w === aiWindow ? "true" : undefined}>
              {PERIOD_LABEL[w]}
            </Link>
          ))}
        </nav>
        <GenerateInsightsForm
          caseId={caseId}
          period={aiWindow}
          disabled={!aiAvailable || capReached}
          label={`Generate AI analysis for ${PERIOD_LABEL[aiWindow].toLowerCase()}`}
        />
        {sp.cached && (
          <div className="form-success" role="status" style={{ flexWrap: "wrap" }}>
            <span>
              Nothing changed in these notes since the last analysis, so the saved result is shown — no new AI request was made.
            </span>
            <GenerateInsightsForm caseId={caseId} period={aiWindow} disabled={!aiAvailable || capReached} label="Regenerate anyway (new AI request)" force secondary />
          </div>
        )}
        <p className="secondary">
          {!aiAvailable
            ? "AI analysis is currently unavailable. Notes, charts and safety rules still work."
            : capReached
              ? "New AI analysis is temporarily unavailable because today's limit was reached. Notes, charts and safety rules are not affected."
              : `${limits.perUser - usedToday} of ${limits.perUser} AI requests left today.`}
        </p>
        {sp.result === "empty" && <p className="secondary">No observations were logged in that AI window, so nothing was sent to the AI.</p>}
        {sp.result === "error" && (
          <p className="form-error" role="alert">
            <AlertIcon size={17} /> Something went wrong while generating. Nothing was saved or shown. Please try again.
          </p>
        )}
        {shown && shown.run.status !== "complete" && (
          <p className="form-error" role="status" style={{ background: "var(--attention-bg)", color: "var(--attention)" }}>
            <AlertIcon size={17} /> Last attempt ({fmtDateTime(shown.run.createdAt)}): {RUN_STATUS_MESSAGE[shown.run.status] ?? "No insights were produced."}
          </p>
        )}

        {!ai ? (
          <p className="secondary">No AI analysis yet. Nothing is shown until real, checked AI output exists.</p>
        ) : (
          <details open={Boolean(sp.run)} className="ai-box" style={{ padding: 16 }}>
            <summary style={{ cursor: "pointer", fontWeight: 600, color: "var(--primary)" }}>
              Detailed analysis — {ai.run.origin === "seeded" ? "prepared with the demo" : "generated"} {fmtDateTime(ai.run.generatedAt)} · covers{" "}
              {runPeriod(ai)}
            </summary>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 12 }}>
              <p className="meta">
                <span className="ai-box-label">AI-generated — derived from caregiver notes, not written by the caregiver</span>
                <span>· {ai.run.modelReported ?? "model not reported"}</span>
                <span>· based on {ai.run.inputSourceIds.length} notes</span>
              </p>
              <p className="secondary" style={{ display: "flex", gap: 6 }}>
                <InfoIcon size={14} /> This analysis covers {runPeriod(ai)}, which may not match the chart period ({dash.period.label.toLowerCase()}).
              </p>
              {ai.run.rejectedItems > 0 && (
                <p className="pill pill-attention" style={{ alignSelf: "flex-start" }}>
                  <InfoIcon size={13} /> {ai.run.rejectedItems} AI statement{ai.run.rejectedItems > 1 ? "s were" : " was"} removed for failing CareSignal&apos;s
                  evidence checks
                </p>
              )}
              <section>
                <h3>Summary</h3>
                <p style={{ marginTop: 4 }}>{humanizeText(ai.run.summary ?? "", obs)}</p>
                <EvidenceButton ids={ai.run.inputSourceIds} title="All notes the AI analysis used" label={`Review the ${ai.run.inputSourceIds.length} notes it used`} />
              </section>
              {aiItems.length > 0 && (
                <section>
                  <h3>Findings with the caregiver&apos;s exact words</h3>
                  <ul className="list-plain" style={{ marginTop: 6 }}>
                    {aiItems.map((i) => (
                      <li key={i.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <p style={{ fontWeight: 500 }}>
                          {humanizeText(i.statement, obs)} <span className="secondary">· {SUPPORT_LABEL[i.support]}</span>
                        </p>
                        {i.evidence.map((e, k) => (
                          <blockquote key={k} className="quote" style={{ fontSize: 14 }}>
                            <span className="secondary">{readableLabel(obs[e.sourceId])} · caregiver&apos;s words: </span>“{e.quote}”
                          </blockquote>
                        ))}
                        {i.uncertainty && <p className="secondary">Uncertain: {humanizeText(i.uncertainty, obs)}</p>}
                        <span>
                          <EvidenceButton ids={i.sourceIds} title="Notes behind this AI finding" />
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <section>
                <h3>What&apos;s unknown or missing</h3>
                {ai.run.unknowns.length === 0 ? (
                  <p className="secondary">The AI listed no gaps. That does not mean nothing is missing.</p>
                ) : (
                  <ul style={{ margin: "6px 0 0", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
                    {ai.run.unknowns.map((u, k) => (
                      <li key={k}>
                        {humanizeText(u.statement, obs)} <EvidenceButton ids={u.sourceIds} title="Notes this gap refers to" label="Review" />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </details>
        )}

        {runs.length > 1 && (
          <details>
            <summary className="muted-link" style={{ cursor: "pointer" }}>
              Earlier AI runs ({runs.length - 1})
            </summary>
            <ul className="list-plain" style={{ marginTop: 10 }}>
              {runs
                .filter((r) => r.run.id !== ai?.run.id)
                .map((r) => (
                  <li key={r.run.id}>
                    <Link href={href({ run: r.run.id })}>
                      {fmtDateTime(r.run.generatedAt ?? r.run.createdAt)} —{" "}
                      {r.run.status === "complete" ? `${r.insights.filter((i) => i.kind !== "question").length} findings` : r.run.status.replaceAll("_", " ")}
                    </Link>
                    {r.run.origin === "seeded" && <span className="secondary"> · prepared with the demo</span>}
                  </li>
                ))}
            </ul>
          </details>
        )}
        <p className="secondary">
          AI text can be wrong and is not medical advice. CareSignal never suggests medication changes. Urgent concerns are handled by the safety rules
          and 911 guidance at the top of every screen, not by this analysis.
        </p>
      </section>
    </EvidenceProvider>
  );
}
