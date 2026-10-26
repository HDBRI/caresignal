import Link from "next/link";
import { requireActor, principalOf } from "@/lib/auth/session";
import { AGE_RANGES, BASELINE_DOMAINS, CARE_PHASES, CARE_SETTINGS, labelFor, NOT_PROVIDED } from "@/lib/onboarding";
import { getCase, listBaselines } from "@/lib/repo/cases";
import { checkinStatusLabel, listCheckins } from "@/lib/repo/checkins";
import { getDb } from "@/lib/repo/db";
import { listHandoffs, listInsightRuns } from "@/lib/repo/handoffs";
import { listAlerts, listAnalyses, listObservations } from "@/lib/repo/observations";
import { addDays, localDate } from "@/lib/time";
import { TIER_GUIDANCE } from "@/lib/safety/rules";
import { markSeen } from "@/app/actions/alerts";
import { AddObservationButton } from "@/components/AddObservation";
import { CheckinCard } from "@/components/CheckinCard";
import { AutoRefreshWhilePending } from "@/components/ObservationTools";
import { EmptyState, fmtDateTime, fmtDay, ObservationItem } from "@/components/display";
import { AlertIcon, CheckIcon, InfoIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

/** Plain-language handoff status for caregivers. The "care team" is always the simulated receiver. */
const STATUS_LABEL: Record<string, string> = {
  draft: "Draft — not sent yet",
  reviewed: "Reviewed — ready to send",
  submitted: "Sent — waiting for confirmation",
  received: "Received by the simulated care team",
  acknowledged: "Received and acknowledged by the simulated care team",
  failed: "Didn't go through — you can try again",
};

/** Screen 3 — Overview: everything computed from stored data for the selected case only. */
export default async function OverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ caseId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { caseId } = await params;
  const flags = await searchParams;
  const actor = await requireActor();
  const db = await getDb();
  const p = principalOf(actor);
  const [c, baselines, observations, alerts, handoffs, checkins, analyses, insightRuns] = await Promise.all([
    getCase(db, p, caseId),
    listBaselines(db, p, caseId),
    listObservations(db, p, caseId),
    listAlerts(db, p, caseId),
    listHandoffs(db, p, caseId),
    listCheckins(db, p, caseId),
    listAnalyses(db, p, caseId),
    listInsightRuns(db, p, caseId),
  ]);

  // ---- Counts, all derived from stored rows ----
  const today = localDate(new Date());
  const weekStart = addDays(today, -6);
  const seeded = observations.filter((o) => o.origin === "seeded").length;
  const lastWeek = observations.filter((o) => localDate(new Date(o.enteredAt)) >= weekStart).length;
  const reviewAlerts = alerts.filter((a) => a.tier === "review" && a.seenAt === null);
  const unseenCount = alerts.filter((a) => a.seenAt === null).length;
  const latest = handoffs[0];
  const recent = [...observations].sort((a, b) => b.enteredAt.localeCompare(a.enteredAt)).slice(0, 4);

  // ---- Check-in strip: explicit status per day; missing days are "No response recorded" ----
  const byDay = new Map(checkins.map((ci) => [ci.day, ci]));
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((d) => ({
    day: d,
    dayLabel: d === today ? "Today" : fmtDay(d).split(",")[0],
    label: checkinStatusLabel(byDay.get(d)?.status),
    recorded: byDay.has(d),
  }));
  const todayCheckin = byDay.get(today);

  // ---- Unresolved questions: from the latest handoff not yet acknowledged, plus AI question insights ----
  const openQuestions: { text: string; sourceIds: string[]; from: string }[] = [];
  if (latest && latest.handoff.status !== "acknowledged") {
    for (const q of latest.handoff.draft.questions) openQuestions.push({ text: q.text, sourceIds: q.sourceIds, from: "Handoff draft" });
  }
  for (const run of insightRuns.filter((r) => r.run.status === "complete").slice(0, 1)) {
    for (const i of run.insights.filter((x) => x.kind === "question"))
      openQuestions.push({ text: i.statement, sourceIds: i.sourceIds, from: "AI insight" });
  }

  return (
    <>
      {flags.reset && (
        <p className="form-success" role="status">
          <CheckIcon size={17} /> Your demo copy was reset to the original scenario. Dates were regenerated relative to now.
        </p>
      )}
      {(flags.created || flags.copied) && (
        <p className="form-success" role="status">
          <CheckIcon size={17} /> Case {flags.copied ? "copied" : "created"}. It is private to your account.
        </p>
      )}

      <AutoRefreshWhilePending pending={observations.some((o) => o.aiState === "pending")} />
      <header style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="pill pill-unknown" style={{ alignSelf: "flex-start" }}>
            Synthetic demo data · {c.patientRef}
          </span>
          <h1>{c.pseudonym}</h1>
          <p className="secondary" style={{ fontSize: 15 }}>
            {labelFor(CARE_PHASES, c.carePhase)} · {labelFor(CARE_SETTINGS, c.careSetting)} · Age range:{" "}
            {labelFor(AGE_RANGES, c.ageRange)}
          </p>
        </div>
        <AddObservationButton label="Add observation" className="btn btn-primary" />
      </header>

      {/* Non-urgent "please review" notices (urgent ones are in the banner on every screen). */}
      {reviewAlerts.length > 0 && (
        <section className="card" aria-labelledby="review-h">
          <div className="section-head">
            <h2 id="review-h" style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--attention)" }}>
              <AlertIcon size={18} /> Notes flagged for review ({reviewAlerts.length})
            </h2>
            <span className="secondary">{TIER_GUIDANCE.review.body}</span>
          </div>
          <ul className="list-plain">
            {reviewAlerts.map((a) => {
              const o = observations.find((x) => x.id === a.observationId);
              return (
                <li key={a.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <span>
                    {o && (
                      <Link href={`/cases/${caseId}/observations/${o.displayId}`} style={{ fontWeight: 600 }}>
                        {o.displayId}
                      </Link>
                    )}{" "}
                    “{o?.originalText}” <span className="secondary">· rule {a.ruleIds.join(", ")}</span>
                  </span>
                  <form action={markSeen}>
                    <input type="hidden" name="alertId" value={a.id} />
                    <input type="hidden" name="caseId" value={caseId} />
                    <button className="btn btn-ghost" type="submit">
                      I&apos;ve seen this
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="grid-dash" aria-label="Counts from stored data">
        <div className="card">
          <p className="stat-label">Observations logged</p>
          <p className="stat-value">{observations.length}</p>
          <p className="secondary">
            {lastWeek} in the last 7 days · {seeded} seeded · {observations.length - seeded} added by you
          </p>
        </div>
        <div className="card">
          <p className="stat-label">Safety notices not yet seen</p>
          <p className="stat-value">{unseenCount}</p>
          <p className="secondary">{alerts.length} total from predefined rules · not a safety score</p>
        </div>
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <p className="stat-label">Handoff to the care team</p>
          {latest ? (
            <>
              <p style={{ fontWeight: 600 }}>{STATUS_LABEL[latest.handoff.status]}</p>
              <p className="secondary">
                {latest.handoff.draftedBy === "seed_fixture" ? "Example handoff from this demo scenario" : "Prepared in this case"} · not a real clinic
              </p>
              <Link href={`/cases/${caseId}/handoffs`} className="muted-link">
                Open handoffs
              </Link>
              <details>
                <summary className="muted-link" style={{ cursor: "pointer" }}>
                  Show handoff ID
                </summary>
                <p style={{ marginTop: 6 }}>
                  <code className="cred">{latest.handoff.displayId}</code>
                </p>
                <p className="secondary">Used to match this handoff with its receipt in the Demo receiver.</p>
              </details>
            </>
          ) : (
            <>
              <p style={{ fontWeight: 600 }}>None yet</p>
              <p className="secondary">No handoff has been drafted for this case.</p>
            </>
          )}
        </div>
      </section>

      <CheckinCard
        caseId={caseId}
        today={today}
        current={todayCheckin ? { status: todayCheckin.status, note: todayCheckin.note } : null}
        week={week}
      />

      <section className="card" aria-labelledby="recent-h">
        <div className="section-head">
          <h2 id="recent-h">Recent observations</h2>
          <Link href={`/cases/${caseId}/observations`} className="muted-link">
            View full timeline ({observations.length})
          </Link>
        </div>
        {recent.length === 0 ? (
          <EmptyState title="No observations yet">
            Use <strong>Add observation</strong> to write down what you notice, in your own words. There isn&apos;t enough
            recorded information to summarize anything yet.
          </EmptyState>
        ) : (
          <ul className="list-plain">
            {recent.map((o) => (
              <li key={o.id}>
                <ObservationItem o={o} analysis={analyses.get(o.id)} caseId={caseId} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card" aria-labelledby="questions-h">
        <div className="section-head">
          <h2 id="questions-h">Open questions for the care team</h2>
          <span className="secondary">From stored drafts and insights — each links to its source notes</span>
        </div>
        {openQuestions.length === 0 ? (
          <p className="secondary">No open questions are recorded for this case right now. That is not the same as “nothing to ask.”</p>
        ) : (
          <ul className="list-plain">
            {openQuestions.map((q) => (
              <li key={q.text}>
                <p>{q.text}</p>
                <p className="meta">
                  <span>{q.from} · sources:</span>
                  {q.sourceIds.map((s) => (
                    <Link key={s} className="chip" href={`/cases/${caseId}/observations/${s}`}>
                      {s}
                    </Link>
                  ))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid-dash">
        <section className="card" aria-labelledby="ctx">
          <div className="section-head">
            <h2 id="ctx">Care context</h2>
            <Link href={`/cases/${caseId}/settings`} className="muted-link">
              Edit
            </Link>
          </div>
          <p>{c.careContext ?? NOT_PROVIDED}</p>
          <dl className="secondary" style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px", marginTop: 10 }}>
            <dt>Main condition</dt>
            <dd style={{ margin: 0 }}>{c.primaryCondition ?? NOT_PROVIDED}</dd>
            <dt>Milestones</dt>
            <dd style={{ margin: 0 }}>{c.milestones ?? NOT_PROVIDED}</dd>
            <dt>Caregiver</dt>
            <dd style={{ margin: 0 }}>
              {c.caregiverName ?? NOT_PROVIDED}
              {c.caregiverRelationship ? ` (${c.caregiverRelationship})` : ""}
            </dd>
          </dl>
        </section>

        <section className="card" aria-labelledby="baseline">
          <h2 id="baseline" style={{ fontSize: 19, marginBottom: 10 }}>
            Usual baseline (caregiver-reported)
          </h2>
          <dl style={{ display: "grid", gridTemplateColumns: "minmax(130px, 170px) 1fr", gap: "8px 12px" }}>
            {BASELINE_DOMAINS.map((d) => {
              const b = baselines.find((x) => x.category === d.id);
              return (
                <div key={d.id} style={{ display: "contents" }}>
                  <dt style={{ fontWeight: 500, fontSize: 14 }}>{d.label}</dt>
                  <dd style={{ margin: 0, fontSize: 14 }}>
                    {b ? (
                      b.description
                    ) : (
                      <span className="pill pill-unknown">
                        <InfoIcon size={13} /> {NOT_PROVIDED}
                      </span>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      </div>

      <p className="secondary">
        Last note logged: {observations.length ? fmtDateTime(recent[0].enteredAt) : "none"}. CareSignal shows no health score
        and never says “all clear” — a missing note or check-in means “not reported”.
      </p>
    </>
  );
}
