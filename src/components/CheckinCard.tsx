"use client";
import { useActionState } from "react";
import { saveCheckinAction, type CheckinState } from "@/app/actions/observations";
import { CHECKIN_STATUSES } from "@/lib/repo/checkin-labels";
import { FormError, FormSuccess, SubmitButton } from "./forms";

/** Quick optional daily check-in on the Overview. Not required; skipping is a valid answer. */
export function CheckinCard({
  caseId,
  today,
  current,
  week,
}: {
  caseId: string;
  today: string;
  current: { status: string; note: string | null } | null;
  week: { day: string; dayLabel: string; label: string; recorded: boolean }[];
}) {
  const [state, action] = useActionState<CheckinState, FormData>(saveCheckinAction, {});
  return (
    <section className="card" aria-labelledby="checkin-h" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="section-head" style={{ marginBottom: 0 }}>
        <h2 id="checkin-h">Today&apos;s check-in</h2>
        <span className="secondary">Optional · takes a few seconds</span>
      </div>
      <form action={action} className="form" style={{ gap: 10 }}>
        <FormError message={state.error} />
        <FormSuccess message={state.ok ? "Check-in saved for today." : undefined} />
        <input type="hidden" name="caseId" value={caseId} />
        <input type="hidden" name="day" value={today} />
        <fieldset>
          <legend className="sr-only">How is today compared with usual?</legend>
          <div className="radio-row">
            {CHECKIN_STATUSES.map((s) => (
              <label key={s.id}>
                <input type="radio" name="status" value={s.id} defaultChecked={current?.status === s.id} required />
                {s.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="field">
          <label htmlFor="checkin-note">Short note (optional)</label>
          <input id="checkin-note" name="note" className="input" maxLength={500} defaultValue={current?.note ?? ""} />
        </div>
        <div>
          <SubmitButton pendingText="Saving…" className="btn btn-secondary">
            {current ? "Update check-in" : "Save check-in"}
          </SubmitButton>
        </div>
      </form>
      <div>
        <p className="stat-label" style={{ marginBottom: 6 }}>
          Last 7 days
        </p>
        <ul className="chip-row" style={{ listStyle: "none", padding: 0, margin: 0 }} aria-label="Check-in status for the last 7 days">
          {week.map((d) => (
            <li key={d.day} className={`pill ${d.recorded ? "pill-calm" : "pill-unknown"}`} title={d.day}>
              {d.dayLabel}: {d.label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
