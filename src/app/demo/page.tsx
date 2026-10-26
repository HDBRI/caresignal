import { demoCredentials } from "@/lib/auth/demo";
import { SEED_CASES } from "@/lib/fixtures";
import { BrandLink, SiteFooter } from "@/components/SiteChrome";
import { DemoEntryForm } from "./DemoEntryForm";

export const dynamic = "force-dynamic";

const WHAT_YOU_SEE: Record<string, string[]> = {
  "PAT-CANCER-001": [
    "A five-day pattern: more tiredness, eating and drinking less, new help with dressing",
    "Questions for the care team, each linked to the notes behind it",
    "A handoff that was received, acknowledged and answered by a labeled fictional clinician response",
  ],
  "PAT-SURGERY-002": [
    "Routine recovery notes, then a predefined synthetic urgent note",
    "Emergency guidance shown immediately by fixed safety rules — no AI involved",
    "A weekly draft that is never sent automatically",
  ],
  "PAT-RECOVERY-003": [
    "A supported change in walking, and a possible-but-unconfirmed change in sleep",
    "Two family members' meal reports that conflict — kept side by side, not resolved",
    "A reviewed handoff ready for you to submit to the simulated receiver",
  ],
};

/** Screen 1 (demo path) — choose one of the three seeded synthetic cases. */
export default function DemoPage() {
  const creds = demoCredentials();
  return (
    <main id="main" className="wide-page">
      <BrandLink />
      <header style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span className="pill badge-demo" style={{ alignSelf: "flex-start" }}>
          Demo mode — synthetic data only; shared demo data may be reset
        </span>
        <h1>Explore a demo case</h1>
        <p className="secondary" style={{ fontSize: 15, maxWidth: 720 }}>
          Each case has its own shared demo login (filled in below). Signing in opens <strong>your own copy</strong>{" "}
          of the case: notes you add, alerts you acknowledge and handoffs you submit stay in your copy only, and you can
          reset it to the original at any time. The prepared scenario itself can&apos;t be changed. This is not a private
          or secure account — please enter fictional information only.
        </p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: 16 }}>
        {SEED_CASES.map((c) => {
          const cred = creds.find((x) => x.seedKey === c.seedKey)!;
          return (
            <article key={c.seedKey} className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <span className="pill pill-unknown" style={{ alignSelf: "flex-start" }}>
                Synthetic · {c.patient.patientRef}
              </span>
              <h2 style={{ fontSize: 19 }}>{c.patient.pseudonym}</h2>
              <p style={{ fontWeight: 500 }}>{c.title}</p>
              <h3 style={{ fontSize: 14.5 }}>What this case demonstrates</h3>
              <p className="secondary" style={{ marginTop: -6 }}>{c.demonstrates}</p>
              <p className="stat-label" style={{ fontWeight: 600 }}>What you&apos;ll see</p>
              <ul className="secondary" style={{ paddingLeft: 18, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                {WHAT_YOU_SEE[c.seedKey].map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <div style={{ marginTop: "auto" }}>
                <DemoEntryForm username={cred.username} password={cred.password} label={`Open ${c.patient.pseudonym} demo`} />
              </div>
            </article>
          );
        })}
      </div>
      <SiteFooter />
    </main>
  );
}
