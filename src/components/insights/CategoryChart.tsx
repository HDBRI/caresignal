"use client";
/**
 * One small-multiple: logged-observation counts per day/week for one category (persisted notes only).
 * Bars are buttons (keyboard-accessible, with a visible tooltip on hover/focus) that open exactly the notes behind
 * that bar. Counts are recorded activity — never severity. A table view is the accessible alternative.
 */
import Link from "next/link";
import type { CategorySeries } from "@/lib/dashboard";
import { useEvidence } from "./Evidence";

export function CategoryChart({
  s,
  bucket,
  maxCount,
  periodLabel,
  caseId,
  previousLabel,
}: {
  s: CategorySeries;
  bucket: "day" | "week";
  maxCount: number;
  periodLabel: string;
  caseId: string;
  /** "the previous 7 days (…)" — present only when the period comparison is reliable. */
  previousLabel: string | null;
}) {
  const open = useEvidence();
  const max = Math.max(1, maxCount);
  const allIds = s.buckets.flatMap((b) => b.observationIds);
  const unit = bucket === "day" ? "day" : "week";
  const showEvery = s.buckets.length > 10 ? Math.ceil(s.buckets.length / 6) : 1;
  const mid = max >= 2 ? Math.round(max / 2) : null;
  // Compact axis labels: weekly buckets show their start date; daily buckets show the month only on the first day and
  // when it changes ("Oct 20, 21, 22 … Nov 1"). The full date/range is in each bar's tooltip and the table.
  const short = (label: string, i: number) => {
    const start = label.split("–")[0];
    if (bucket === "week" || i === 0) return start;
    const [month, day] = start.split(" ");
    const prevMonth = s.buckets[i - 1].label.split("–")[0].split(" ")[0];
    return month === prevMonth ? day : start;
  };

  return (
    <section className="card chart-card" aria-labelledby={`cat-${s.id}`}>
      <div className="chart-head">
        <h3 id={`cat-${s.id}`}>{s.label}</h3>
        <span className="chart-total">
          {s.total} note{s.total === 1 ? "" : "s"} · {s.days} day{s.days === 1 ? "" : "s"}
        </span>
      </div>

      <div className="bars" role="group" aria-label={`${s.label}: logged notes per ${unit}, ${periodLabel.toLowerCase()}. Select a bar to read the notes.`}>
        <span className="bars-axis" aria-hidden="true">
          <span>{max}</span>
          {mid !== null && mid !== max && <span>{mid}</span>}
          <span>0</span>
        </span>
        <div className="bars-plot">
          {s.buckets.map((b, i) => {
            const pct = (b.count / max) * 100;
            const tip = `${b.label}: ${b.count} note${b.count === 1 ? "" : "s"}`;
            return (
              <div key={b.start} className="bar-col">
                {b.count > 0 ? (
                  <button
                    type="button"
                    className="bar"
                    style={{ height: `${Math.max(pct, 8)}%` }}
                    aria-label={`${tip} about ${s.label.toLowerCase()} — open them`}
                    data-tip={tip}
                    onClick={() => open(`${s.label} · ${b.label}`, b.observationIds, `${b.count} logged in this ${unit}`)}
                  >
                    <span className="bar-count">{b.count}</span>
                  </button>
                ) : (
                  <span className="bar bar-empty" aria-hidden="true" title={`${b.label}: no notes logged`} />
                )}
                <span className="bar-label" aria-hidden="true" title={b.label}>
                  {i % showEvery === 0 || i === s.buckets.length - 1 ? short(b.label, i) : ""}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="chart-foot">
        <button type="button" className="btn btn-ghost evidence-btn" onClick={() => open(`${s.label} · ${periodLabel}`, allIds)}>
          Review supporting notes ({allIds.length})
        </button>
        <Link className="muted-link" href={`/cases/${caseId}/observations?category=${s.id}`}>
          Open in timeline
        </Link>
      </div>
      {s.previous !== null && previousLabel && (
        <p className="secondary chart-compare">
          {s.previous} note{s.previous === 1 ? "" : "s"} in {previousLabel} — recording activity, not a health measure.
        </p>
      )}
      <details>
        <summary className="muted-link" style={{ cursor: "pointer" }}>
          Show as a table
        </summary>
        <table className="data-table">
          <caption className="sr-only">
            {s.label}: logged notes per {unit}
          </caption>
          <thead>
            <tr>
              <th scope="col">{bucket === "day" ? "Day" : "Week"}</th>
              <th scope="col">Logged notes</th>
            </tr>
          </thead>
          <tbody>
            {s.buckets.map((b) => (
              <tr key={b.start}>
                <td>{b.label}</td>
                <td>{b.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
