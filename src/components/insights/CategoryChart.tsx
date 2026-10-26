"use client";
/**
 * One small-multiple: logged-observation counts per day/week for one category.
 * Bars are buttons (keyboard-accessible) that open exactly the notes behind that bar.
 * Counts are recorded activity — never severity.
 */
import type { CategorySeries } from "@/lib/dashboard";
import { useEvidence } from "./Evidence";

export function CategoryChart({ s, bucket, maxCount, periodLabel }: { s: CategorySeries; bucket: "day" | "week"; maxCount: number; periodLabel: string }) {
  const open = useEvidence();
  const max = Math.max(1, maxCount);
  const allIds = s.buckets.flatMap((b) => b.observationIds);
  const unit = bucket === "day" ? "day" : "week";
  const showEvery = s.buckets.length > 8 ? Math.ceil(s.buckets.length / 6) : 1;

  return (
    <section className="card chart-card" aria-labelledby={`cat-${s.id}`}>
      <div className="chart-head">
        <h3 id={`cat-${s.id}`}>{s.label}</h3>
        <span className={`pill ${s.total ? "pill-calm" : "pill-unknown"}`}>
          {s.total ? `${s.total} logged observation${s.total === 1 ? "" : "s"}` : "No observations in this period"}
        </span>
      </div>

      <div
        className="bars"
        role="group"
        aria-label={`${s.label}: logged observations per ${unit}, ${periodLabel.toLowerCase()}. Select a bar to read the notes.`}
      >
        <span className="bars-axis" aria-hidden="true">
          <span>{max}</span>
          <span>0</span>
        </span>
        <div className="bars-plot">
          {s.buckets.map((b, i) => {
            const pct = (b.count / max) * 100;
            const label = `${b.label}: ${b.count} logged observation${b.count === 1 ? "" : "s"} about ${s.label.toLowerCase()}`;
            return (
              <div key={b.start} className="bar-col">
                {b.count > 0 ? (
                  <button
                    type="button"
                    className="bar"
                    style={{ height: `${Math.max(pct * 0.8, 7)}%` }}
                    aria-label={label}
                    title={label}
                    onClick={() => open(`${s.label} · ${b.label}`, b.observationIds, `${b.count} logged in this ${unit}`)}
                  >
                    <span className="bar-count">{b.count}</span>
                  </button>
                ) : (
                  <span className="bar bar-empty" aria-hidden="true" title={`${b.label}: no notes logged`} />
                )}
                <span className="bar-label" aria-hidden="true">
                  {i % showEvery === 0 || i === s.buckets.length - 1 ? b.label : ""}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="chart-foot">
        {allIds.length > 0 ? (
          <button type="button" className="btn btn-ghost evidence-btn" onClick={() => open(`${s.label} · ${periodLabel}`, allIds)}>
            Review these notes ({allIds.length})
          </button>
        ) : (
          <span className="secondary">Nothing recorded — that means “not reported”, not “no problems”.</span>
        )}
        <details>
          <summary className="muted-link" style={{ cursor: "pointer" }}>
            Show as a table
          </summary>
          <table className="data-table">
            <caption className="sr-only">
              {s.label}: logged observations per {unit}
            </caption>
            <thead>
              <tr>
                <th scope="col">{bucket === "day" ? "Day" : "Week"}</th>
                <th scope="col">Logged observations</th>
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
      </div>
    </section>
  );
}
