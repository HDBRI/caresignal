"use client";
import { useActionState, useState, useSyncExternalStore } from "react";
import { saveReminderAction } from "@/app/actions/cases";
import type { FormState } from "@/app/actions/auth";
import { REMINDER_LIMITATION } from "@/lib/reminder";
import { FieldError, FormSuccess, SubmitButton } from "./forms";

/** In-app reminder preference: off by default; one daily local time when on. No email/SMS/push. */
export function ReminderForm({ caseId, pref, time }: { caseId: string; pref: "off" | "in_app_daily"; time: string | null }) {
  const [state, action] = useActionState<FormState, FormData>(saveReminderAction, {});
  const [on, setOn] = useState(pref === "in_app_daily");
  // The caregiver's own time zone (browser only; empty during server render). Used only to time the in-app note.
  const tz = useSyncExternalStore(
    () => () => {},
    () => Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
    () => "",
  );
  return (
    <form action={action} className="form" style={{ gap: 10 }}>
      <FormSuccess message={state.message} />
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="timeZone" value={tz} />
      <p className="secondary">{REMINDER_LIMITATION}</p>
      <fieldset>
        <legend className="sr-only">In-app reminder</legend>
        <div className="radio-row">
          <label>
            <input type="radio" name="reminderPref" value="off" checked={!on} onChange={() => setOn(false)} /> Off (default)
          </label>
          <label>
            <input type="radio" name="reminderPref" value="in_app_daily" checked={on} onChange={() => setOn(true)} /> In-app reminder once a day
          </label>
        </div>
      </fieldset>
      {on && (
        <div className="field" style={{ maxWidth: 260 }}>
          <label htmlFor="reminder-time">Show it after (your local time)</label>
          <input id="reminder-time" type="time" name="reminderTime" className="input" defaultValue={time ?? "20:00"} required aria-invalid={state.errors?.reminderTime ? true : undefined} />
          <FieldError id="reminder-time-err" message={state.errors?.reminderTime} />
          <p className="hint">Time zone: {tz || "this device's"}</p>
        </div>
      )}
      <div>
        <SubmitButton pendingText="Saving…" className="btn btn-secondary">
          Save reminder preference
        </SubmitButton>
      </div>
      <p className="secondary">Reminders never block or limit adding observations.</p>
    </form>
  );
}
