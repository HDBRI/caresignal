import Link from "next/link";
import { categoryLabel } from "@/lib/categories";
import { DIRECTION_LABEL, fmtDay, levelLabel, type PatternFinding, type PatternResult } from "@/lib/patterns";
import { KindTag } from "../display";
import { EvidenceButton } from "./Evidence";

const ATTENTION = new Set(["described_worse", "described_better", "new", "reported_more_often", "reported_less_often", "fluctuating"]);
const span = (f: PatternFinding) => (f.timeframe.first === f.timeframe.last ? fmtDay(f.timeframe.first) : `${fmtDay(f.timeframe.first)} – ${fmtDay(f.timeframe.last)}`);

function PatternCard({ f }: { f: PatternFinding }) {
  return (
    <article className="pattern-card" aria-label={f.theme}>
      <div className="pattern-head">
        <h4>{f.theme}</h4>
        <span className="secondary">{categoryLabel(f.category)}</span>
      </div>
      <div className="chip-row">
        <span className="pill pill-unknown">{levelLabel(f)}</span>
        {f.directions
          .filter((d) => d !== "unclear")
          .map((d) => (
            <span key={d} className="pill pill-review">
              {DIRECTION_LABEL[d]}
            </span>
          ))}
      </div>
      <p className="pattern-line">
        <strong>When:</strong> {span(f)} · {f.timeframe.days} day{f.timeframe.days === 1 ? "" : "s"} with a mention
      </p>
      <p className="pattern-line">
        <strong>In the caregiver&apos;s words:</strong> “{f.quotes.find((q) => q.sourceId === f.keySourceIds[0])?.quote ?? f.quotes[0].quote}”
      </p>
      {f.baseline && (
        <p className="pattern-line">
          <strong>Usual (caregiver-reported):</strong> “{f.baseline}”
        </p>
      )}
      {f.relatedEvents[0] && (
        <p className="pattern-line">
          <strong>Documented event:</strong> {f.relatedEvents[0].label}, {fmtDay(f.relatedEvents[0].day)} ({f.relatedEvents[0].sourceId ? "from a caregiver note" : "synthetic scenario timeline"}) — timing only, not a cause.
        </p>
      )}
      {f.uncertainty[0] && <p className="pattern-line secondary">{f.uncertainty[0]}</p>}
      <span>
        <EvidenceButton ids={f.sourceIds} title={`${f.theme}: supporting notes`} />
      </span>
    </article>
  );
}

/**
 * "What appears to be changing" — deterministic patterns from stored notes (no AI call, nothing invented).
 * Order: overall picture → changes to pay attention to → patterns by category → treatment timeline →
 * uncertainties → questions. Safety alerts stay at the top of the page and in their own group below.
 */
export function PatternSections({ caseId, r, periodLabel }: { caseId: string; r: PatternResult; periodLabel: string }) {
  const attention = r.findings.filter((f) => f.level !== "observation" && f.directions.some((d) => ATTENTION.has(d)));
  const rest = r.findings.filter((f) => !attention.includes(f));
  const byCategory = [...new Set(rest.map((f) => f.category))];
  return (
    <section className="card patterns" aria-labelledby="pat-h">
      <div className="section-head" style={{ marginBottom: 0 }}>
        <h2 id="pat-h">What appears to be changing</h2>
        <KindTag kind="caregiver">From the caregiver&apos;s words · fixed rules, no AI</KindTag>
      </div>
      <p className="readable" data-testid="pattern-overview">
        <strong>Overall picture ({periodLabel.toLowerCase()}):</strong> {r.overview}
      </p>

      <h3>Changes to pay attention to</h3>
      {attention.length === 0 ? (
        <p className="secondary">Not enough information to establish a trend in this period.</p>
      ) : (
        <div className="pattern-grid">
          {attention.map((f) => (
            <PatternCard key={f.themeId} f={f} />
          ))}
        </div>
      )}

      {byCategory.length > 0 && (
        <>
          <h3>Other patterns and single observations by category</h3>
          <ul className="list-plain pattern-list">
            {byCategory.map((c) => (
              <li key={c}>
                <strong>{categoryLabel(c)}:</strong>{" "}
                {rest
                  .filter((f) => f.category === c)
                  .map((f) => (
                    <span key={f.themeId} className="pattern-inline">
                      {f.theme}: {f.headline.charAt(0).toLowerCase() + f.headline.slice(1)} ({span(f)}) <EvidenceButton ids={f.sourceIds} title={`${f.theme}: supporting notes`} label="Review" />
                    </span>
                  ))}
              </li>
            ))}
          </ul>
        </>
      )}

      <h3>Treatment and care timeline</h3>
      {r.events.length === 0 ? (
        <p className="secondary">No treatment sessions, procedures, medication changes or visits are documented in these notes, so timing relative to treatment can&apos;t be assessed.</p>
      ) : (
        <ol className="timeline">
          {r.events.map((e) => (
            <li key={e.sourceId + e.kind}>
              <strong>{e.dateCertainty === "relative_unresolved" ? `“${e.relativeText}” (as written, ${fmtDay(e.day)} note)` : fmtDay(e.day)}</strong> · {e.label} — {e.sourceId ? `“${e.quote}”` : e.quote}{" "}
              {e.sourceId ? <EvidenceButton ids={[e.sourceId]} title={`${e.label}: the note that documents it`} label="Review" /> : <span className="pill pill-unknown">Synthetic scenario timeline</span>}
            </li>
          ))}
        </ol>
      )}
      <p className="secondary">Events come from the case&apos;s synthetic scenario timeline or from what notes document — never invented. Timing is shown for review only, never as a cause; a medicine counts as taken only if the caregiver said so.</p>

      {(r.conflicts.length > 0 || r.eventNotes.length > 0 || r.gaps.length > 0) && (
        <>
          <h3>Important uncertainties</h3>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {r.conflicts.map((c) => (
              <li key={c.detail}>
                Conflicting reports ({c.theme.toLowerCase()}): {c.detail} <EvidenceButton ids={c.sourceIds} title="The conflicting notes" label="Review" />
              </li>
            ))}
            {[...r.eventNotes, ...r.gaps].map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </>
      )}

      {r.questions.length > 0 && (
        <>
          <h3>Questions for the care team</h3>
          <ul className="list-plain">
            {r.questions.map((q) => (
              <li key={q.text}>
                {q.text} <EvidenceButton ids={q.sourceIds} title="Notes behind this question" label="Review" />
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="secondary">
        Surfaces evidence and possible relationships for human review — not a diagnosis, cause or treatment recommendation. <Link href={`/cases/${caseId}/handoffs`}>Carry these into this week&apos;s handoff</Link>.
      </p>
    </section>
  );
}
