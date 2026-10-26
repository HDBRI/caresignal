import Link from "next/link";
import { categoryLabel } from "@/lib/categories";
import type { HandoffContent, Observation } from "@/lib/models";
import { DIRECTION_LABEL, fmtDay, levelLabel, type Direction } from "@/lib/patterns";
import { localDate } from "@/lib/time";
import { KindTag } from "../display";

/** Readable evidence link: date + the first words of the caregiver's note (the stable ID stays in the link only). */
export function NoteRef({ caseId, id, notes }: { caseId: string; id: string; notes: Map<string, Observation> }) {
  const o = notes.get(id);
  if (!o) return <span className="chip">note not found</span>;
  const day = localDate(new Date(o.eventTime ?? o.enteredAt));
  const words = o.originalText.split(/\s+/).slice(0, 7).join(" ");
  return (
    <Link className="chip" href={`/cases/${caseId}/observations/${id}`} title={`“${o.originalText}”`}>
      {fmtDay(day)} · “{words}
      {o.originalText.split(/\s+/).length > 7 ? "…" : ""}”
    </Link>
  );
}

const span = (t: { first: string; last: string; days: number }) =>
  t.first === t.last ? fmtDay(t.first) : `${fmtDay(t.first)} – ${fmtDay(t.last)} · ${t.days} days`;

/**
 * Sections A–F of the structured weekly handoff. Used on the handoff page AND the simulated receiver,
 * so the receiver always shows exactly the structured content that was submitted.
 */
export function StructuredHandoff({ caseId, content, notes }: { caseId: string; content: HandoffContent; notes: Map<string, Observation> }) {
  const patterns = content.patterns ?? [];
  return (
    <div className="structured-handoff">
      <section aria-labelledby="sh-a">
        <h3 id="sh-a">A. Overall summary</h3>
        <KindTag kind="caregiver">From the caregiver&apos;s records · fixed rules, no AI</KindTag>
        <p className="readable" style={{ marginTop: 6 }}>{content.overview ?? content.summary}</p>
      </section>

      <section aria-labelledby="sh-b">
        <h3 id="sh-b">B. Key patterns by category</h3>
        {patterns.length === 0 ? (
          <p className="secondary">No topic came up often enough, or with clear enough wording, to describe a pattern. That is not the same as “no change”.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table pattern-table">
              <caption className="sr-only">Key patterns by category</caption>
              <thead>
                <tr>
                  <th scope="col">Category</th>
                  <th scope="col">Pattern or change</th>
                  <th scope="col">Direction and timeframe</th>
                  <th scope="col">Evidence</th>
                  <th scope="col">Documented event</th>
                  <th scope="col">Uncertainty</th>
                </tr>
              </thead>
              <tbody>
                {patterns.map((p) => (
                  <tr key={p.theme + p.change}>
                    <td>{categoryLabel(p.category)}</td>
                    <td>
                      <strong>{p.theme}</strong>
                      <br />
                      {p.change}
                      <br />
                      <span className="pill pill-unknown">{levelLabel(p)}</span>
                    </td>
                    <td>
                      {p.directions.map((d) => DIRECTION_LABEL[d as Direction] ?? d).join(" · ")}
                      <br />
                      <span className="secondary">{span(p.timeframe)}</span>
                    </td>
                    <td>
                      <div className="chip-row">
                        {p.keySourceIds.map((id) => (
                          <NoteRef key={id} caseId={caseId} id={id} notes={notes} />
                        ))}
                      </div>
                      {p.sourceIds.length > p.keySourceIds.length && <span className="secondary">+{p.sourceIds.length - p.keySourceIds.length} more</span>}
                    </td>
                    <td>{p.event ?? <span className="secondary">None documented</span>}</td>
                    <td className="secondary">{p.uncertainty || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {(content.notable ?? []).length > 0 && (
        <section aria-labelledby="sh-c">
          <h3 id="sh-c">C. Important individual observations</h3>
          <ul className="list-plain" style={{ gap: 6 }}>
            {content.notable!.map((x) => (
              <li key={x.sourceId} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <NoteRef caseId={caseId} id={x.sourceId} notes={notes} /> <span>{x.reason}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="sh-d">
        <h3 id="sh-d">D. Treatment timeline context</h3>
        {(content.timeline ?? []).length === 0 ? (
          <p className="secondary">No treatment sessions, procedures, medication changes or visits are documented in these notes, so timing relative to treatment can&apos;t be assessed.</p>
        ) : (
          <ul className="list-plain" style={{ gap: 6 }}>
            {content.timeline!.map((e) => (
              <li key={e.sourceId + e.label}>
                <strong>{e.dateCertainty === "relative_unresolved" ? `Date given as “${e.relativeText}”` : fmtDay(e.day)}</strong> · {e.label} — “{e.quote}”{" "}
                <span className="secondary">(documented in a caregiver note</span> <NoteRef caseId={caseId} id={e.sourceId} notes={notes} />
                <span className="secondary">)</span>
                {e.relatedThemes.length > 0 && (
                  <p className="secondary" style={{ margin: "2px 0 0" }}>
                    Reported in the days after: {e.relatedThemes.join(", ").toLowerCase()}. The notes do not show whether these are related.
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="sh-e">
        <h3 id="sh-e">E. Questions for the care team</h3>
        {content.questions.length === 0 ? (
          <p className="secondary">No questions yet.</p>
        ) : (
          <ol style={{ margin: "4px 0 0", paddingLeft: 20 }}>
            {content.questions.map((q) => (
              <li key={q.text} style={{ marginBottom: 4 }}>
                {q.text}{" "}
                {q.sourceIds.length === 0 ? (
                  <span className="pill pill-unknown">Added by you</span>
                ) : (
                  <span className="chip-row" style={{ display: "inline-flex" }}>
                    {q.sourceIds.slice(0, 2).map((id) => (
                      <NoteRef key={id} caseId={caseId} id={id} notes={notes} />
                    ))}
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {content.missingInfo.length > 0 && (
        <section aria-labelledby="sh-u">
          <h3 id="sh-u">Uncertain, conflicting or missing</h3>
          <ul style={{ margin: "4px 0 0", paddingLeft: 20 }}>
            {content.missingInfo.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
