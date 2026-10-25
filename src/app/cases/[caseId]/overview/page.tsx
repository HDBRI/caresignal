import { aiStatus } from "@/lib/ai/client";
import { requireActor, principalOf } from "@/lib/auth/session";
import { BASELINE_DOMAINS, CARE_PHASES, CARE_SETTINGS, AGE_RANGES, labelFor, NOT_PROVIDED } from "@/lib/onboarding";
import { getCase, listBaselines } from "@/lib/repo/cases";
import { getDb } from "@/lib/repo/db";
import { listHandoffs } from "@/lib/repo/handoffs";
import { listAlerts, listObservations } from "@/lib/repo/observations";
import { SAFETY_LIMITATION, TIER_GUIDANCE } from "@/lib/safety/rules";
import { markSeen } from "@/app/actions/alerts";
import { AiStatusPill } from "@/components/AiStatusPill";
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

/** Screen 3 — Overview (access/onboarding version; the full dashboard is built in a later step). */
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
  const [c, baselines, observations, alerts, handoffs] = await Promise.all([
    getCase(db, p, caseId),
    listBaselines(db, p, caseId),
    listObservations(db, p, caseId),
    listAlerts(db, p, caseId),
    listHandoffs(db, p, caseId),
  ]);
  const unseen = alerts.filter((a) => a.seenAt === null);
  const latestHandoff = handoffs[0]?.handoff;
  const seeded = observations.filter((o) => o.origin === "seeded").length;

  return (
    <>
      {flags.reset && (
        <p className="form-success" role="status">
          <CheckIcon size={17} /> Your demo copy was reset to the original scenario. Dates were regenerated relative to now.
        </p>
      )}
      {flags.created && (
        <p className="form-success" role="status">
          <CheckIcon size={17} /> Case created. It is private to your account.
        </p>
      )}

      <header style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span className="pill pill-unknown">Synthetic demo data</span>
          <AiStatusPill status={aiStatus()} />
        </div>
        <h1>{c.pseudonym}</h1>
        <p className="secondary" style={{ fontSize: 15 }}>
          {labelFor(CARE_PHASES, c.carePhase)} · {labelFor(CARE_SETTINGS, c.careSetting)} · Age range: {labelFor(AGE_RANGES, c.ageRange)}
        </p>
      </header>

      {unseen.map((a) => {
        const obs = observations.find((o) => o.id === a.observationId);
        const g = TIER_GUIDANCE[a.tier];
        const emergency = a.tier === "emergency";
        return (
          <section
            key={a.id}
            role={emergency ? "alert" : "status"}
            className="card"
            style={{ borderLeft: `6px solid ${emergency ? "var(--emergency)" : "var(--attention)"}`, display: "flex", flexDirection: "column", gap: 10 }}
          >
            {a.isTestScenario && (
              <span className="pill pill-unknown" style={{ alignSelf: "flex-start" }}>
                Synthetic test scenario — example data, not a real emergency involving you
              </span>
            )}
            <h2 style={{ display: "flex", gap: 8, alignItems: "center", color: emergency ? "var(--emergency)" : "var(--attention)", fontSize: emergency ? 24 : 19 }}>
              <AlertIcon size={emergency ? 26 : 20} /> {g.title}
            </h2>
            <p style={{ fontSize: emergency ? 18 : 15, fontWeight: emergency ? 600 : 400 }}>{g.body}</p>
            {obs && (
              <blockquote style={{ margin: 0, padding: "8px 12px", background: "var(--bg)", borderRadius: 8 }}>
                <span className="secondary">{obs.displayId} · original note: </span>“{obs.originalText}”
              </blockquote>
            )}
            <p className="secondary">
              Prototype rule that fired: {a.ruleIds.join(", ")} (matched “{a.matchedText.join("”, “")}”). {SAFETY_LIMITATION}
            </p>
            <form action={markSeen}>
              <input type="hidden" name="alertId" value={a.id} />
              <input type="hidden" name="caseId" value={caseId} />
              <button className="btn btn-secondary" type="submit">
                I&apos;ve seen this
              </button>
            </form>
          </section>
        );
      })}

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }} aria-label="Counts from stored data">
        <div className="card">
          <p className="secondary">Observations logged</p>
          <p style={{ fontSize: 26, fontWeight: 600 }}>{observations.length}</p>
          <p className="secondary">
            {seeded} seeded example{seeded === 1 ? "" : "s"} · {observations.length - seeded} added by you
          </p>
        </div>
        <div className="card">
          <p className="secondary">Safety notices not yet seen</p>
          <p style={{ fontSize: 26, fontWeight: 600 }}>{unseen.length}</p>
          <p className="secondary">{alerts.length} total from predefined rules</p>
        </div>
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <p className="secondary">Handoff to the care team</p>
          {latestHandoff ? (
            <>
              <p style={{ fontWeight: 600 }}>{STATUS_LABEL[latestHandoff.status]}</p>
              <p className="secondary">
                {latestHandoff.draftedBy === "seed_fixture" ? "Example handoff from this demo scenario" : "Prepared in this case"} ·
                not a real clinic
              </p>
              <details style={{ marginTop: 6 }}>
                <summary className="muted-link" style={{ cursor: "pointer" }}>
                  Show handoff ID
                </summary>
                <p style={{ marginTop: 6 }}>
                  <code className="cred">{latestHandoff.displayId}</code>
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

      <section className="card" aria-labelledby="ctx">
        <h2 id="ctx">Care context</h2>
        <p style={{ marginTop: 8 }}>{c.careContext ?? NOT_PROVIDED}</p>
        <p className="secondary" style={{ marginTop: 8 }}>
          Main condition: {c.primaryCondition ?? NOT_PROVIDED} · Milestones: {c.milestones ?? NOT_PROVIDED}
        </p>
        <p className="secondary">
          Caregiver: {c.caregiverName ?? NOT_PROVIDED} ({c.caregiverRelationship ?? "relationship not provided"})
        </p>
      </section>

      <section className="card" aria-labelledby="baseline">
        <h2 id="baseline">Caregiver-reported baseline</h2>
        <dl style={{ display: "grid", gridTemplateColumns: "minmax(160px, 220px) 1fr", gap: "8px 16px", marginTop: 12 }}>
          {BASELINE_DOMAINS.map((d) => {
            const b = baselines.find((x) => x.category === d.id);
            return (
              <div key={d.id} style={{ display: "contents" }}>
                <dt style={{ fontWeight: 500 }}>{d.label}</dt>
                <dd style={{ margin: 0, color: b ? "var(--text)" : "var(--unknown)" }}>
                  {b ? b.description : <span className="pill pill-unknown"><InfoIcon size={13} /> {NOT_PROVIDED}</span>}
                </dd>
              </div>
            );
          })}
        </dl>
      </section>

      <p className="secondary">
        Observations, insights, handoff review and the simulated receiver open in the next build step. Nothing on this page is
        a health score or an “all clear”.
      </p>
    </>
  );
}
