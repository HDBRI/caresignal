import Link from "next/link";
import type { Observation, SafetyAlert } from "@/lib/models";
import { explainMatches, SAFETY_LIMITATION, TIER_GUIDANCE } from "@/lib/safety/rules";
import { markSeen } from "@/app/actions/alerts";
import { KindTag } from "./display";
import { AlertIcon } from "./icons";

/**
 * Persistent interruptive banner shown at the top of EVERY case screen while an emergency or
 * contact-care-team alert has not been marked as seen. Never depends on visiting a specific page.
 */
export function SafetyBanner({ caseId, alerts, observations }: { caseId: string; alerts: SafetyAlert[]; observations: Observation[] }) {
  const urgent = alerts
    .filter((a) => a.seenAt === null && (a.tier === "emergency" || a.tier === "contact_care_team"))
    .sort((a, b) => (a.tier === b.tier ? 0 : a.tier === "emergency" ? -1 : 1));
  if (urgent.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {urgent.map((a) => {
        const obs = observations.find((o) => o.id === a.observationId);
        const emergency = a.tier === "emergency";
        const g = TIER_GUIDANCE[a.tier];
        return (
          <section
            key={a.id}
            role={emergency ? "alert" : "status"}
            aria-label={g.title}
            className={`safety-banner ${emergency ? "safety-emergency" : "safety-contact"}`}
          >
            {a.isTestScenario && (
              <span className="pill pill-unknown" style={{ alignSelf: "flex-start", background: "#fff" }}>
                Synthetic test scenario — example data, not a real emergency involving you
              </span>
            )}
            <KindTag kind="safety" />
            <h2 className="safety-title">
              <AlertIcon size={emergency ? 26 : 20} /> {g.title}
            </h2>
            <p className={emergency ? "safety-instruction" : undefined}>{g.body}</p>
            {obs && (
              <blockquote className="quote">
                <Link href={`/cases/${caseId}/observations/${obs.displayId}`}>{obs.displayId}</Link>
                <span className="secondary"> · original note: </span>“{obs.originalText}”
              </blockquote>
            )}
            <p className="secondary">
              Why this appeared: {explainMatches(a.ruleIds, a.matchedText)} This is a limited prototype rule, not validated triage. {SAFETY_LIMITATION}
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
    </div>
  );
}
