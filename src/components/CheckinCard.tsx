"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { saveCheckinAction, type CheckinState } from "@/app/actions/observations";
import { CHECKIN_STATUSES, CHECKIN_URGENT_NOTICE, STATUSES_WITH_NOTE, checkinStatusLabel } from "@/lib/repo/checkin-labels";
import { AlertIcon, InfoIcon } from "./icons";
import { FormError, FormSuccess, SubmitButton } from "./forms";

/**
 * Quick, optional daily check-in on the Overview. Four explicit answers; skipping is a valid answer and is
 * stored as "Skipped today" — different from "No meaningful change" and from no response at all.
 */
export function CheckinCard({
  caseId,
  today,
  current,
  week,
}: {
  caseId: string;
  today: string;
  current: { status: string; note: string | null; respondedAtLabel: string } | null;
  week: { day: string; dayLabel: string; label: string; recorded: boolean }[];
}) {
  const [state, action] = useActionState<CheckinState, FormData>(saveCheckinAction, {});
  const [status, setStatus] = useState<string>(current?.status ?? "");
  const showNote = (STATUSES_WITH_NOTE as string[]).includes(status);
  const saved = state.savedObservation;
  const urgent = saved && (saved.tier === "emergency" || saved.tier === "contact_care_team");

  return (
    <section className="card" aria-labelledby="checkin-h" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="section-head" style={{ marginBottom: 0 }}>
        <h2 id="checkin-h">Today&apos;s check-in</h2>
        <span className="secondary">Optional · a few seconds · you can always add observations without it</span>
      </div>
      <p className="secondary" style={{ display: "flex", gap: 6 }}>
        <AlertIcon size={15} /> {CHECKIN_URGENT_NOTICE}
      </p>
      {current && !state.ok && (
        <p className="pill pill-calm" style={{ alignSelf: "flex-start" }}>
          Recorded today: {checkinStatusLabel(current.status)} · {current.respondedAtLabel}
        </p>
      )}
      <form action={action} className="form" style={{ gap: 10 }}>
        <FormError message={state.error} />
        <FormSuccess message={state.ok ? `Saved: ${checkinStatusLabel(state.status)}.` : undefined} />
        <input type="hidden" name="caseId" value={caseId} />
        <input type="hidden" name="day" value={today} />
        <fieldset>
          <legend className="sr-only">How is today compared with usual?</legend>
          <div className="radio-row">
            {CHECKIN_STATUSES.map((s) => (
              <label key={s.id}>
                <input type="radio" name="status" value={s.id} checked={status === s.id} onChange={() => setStatus(s.id)} required />
                {s.option}
              </label>
            ))}
          </div>
        </fieldset>
        {showNote && (
          <div className="field">
            <label htmlFor="checkin-note">What did you notice? (optional)</label>
            <textarea
              id="checkin-note"
              name="note"
              className="textarea"
              style={{ minHeight: 70 }}
              maxLength={500}
              defaultValue={current?.note ?? ""}
              placeholder="In your own words — fictional details only"
            />
            <div className="check-row">
              <input type="checkbox" id="checkin-save-obs" name="saveAsObservation" />
              <label htmlFor="checkin-save-obs">Also save this as an observation (saved exactly as written; safety rules run on it)</label>
            </div>
          </div>
        )}
        <div>
          <SubmitButton pendingText="Saving…" className="btn btn-secondary">
            {current ? "Update today's check-in" : "Save check-in"}
          </SubmitButton>
        </div>
      </form>

      {state.observationError && <FormError message={state.observationError} />}
      {saved && (
        <div
          role={urgent ? "alert" : "status"}
          className={urgent ? `safety-banner ${saved.tier === "emergency" ? "safety-emergency" : "safety-contact"}` : "form-success"}
          style={urgent ? undefined : { flexDirection: "column", alignItems: "flex-start" }}
        >
          {urgent ? (
            <>
              <h3 className="safety-title">
                <AlertIcon size={22} /> {saved.guidanceTitle}
              </h3>
              <p className={saved.tier === "emergency" ? "safety-instruction" : undefined}>{saved.guidanceBody}</p>
              <p>
                Saved as observation <Link href={`/cases/${caseId}/observations/${saved.displayId}`}>{saved.displayId}</Link>. The notice stays at the top
                of every screen until you mark it as seen.
              </p>
            </>
          ) : (
            <>
              <span>
                Also saved as observation <Link href={`/cases/${caseId}/observations/${saved.displayId}`}>{saved.displayId}</Link>, exactly as written.
              </span>
              <span className="secondary" style={{ display: "flex", gap: 6 }}>
                <InfoIcon size={14} /> {saved.aiMessage}
              </span>
            </>
          )}
        </div>
      )}

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
        <p className="secondary" style={{ marginTop: 6 }}>
          “No response recorded” means nobody answered that day — it is not read as “fine”.
        </p>
      </div>
    </section>
  );
}
