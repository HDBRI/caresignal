"use client";
import { useActionState, useId } from "react";
import { enterDemo, type FormState } from "@/app/actions/auth";
import { FormError, SubmitButton } from "@/components/forms";

export function DemoEntryForm({ username, password, label }: { username: string; password: string; label: string }) {
  const [state, action] = useActionState<FormState, FormData>(enterDemo, {});
  const id = useId();
  return (
    <form action={action} className="form" style={{ gap: 10 }}>
      <FormError message={state.errors?.form} />
      <div className="grid-2" style={{ gap: 8 }}>
        <div className="field">
          <label htmlFor={`${id}-u`} style={{ fontSize: 13 }}>
            Demo username
          </label>
          <input id={`${id}-u`} name="username" className="input" defaultValue={username} autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor={`${id}-p`} style={{ fontSize: 13 }}>
            Demo password
          </label>
          <input id={`${id}-p`} name="password" className="input" defaultValue={password} autoComplete="off" />
        </div>
      </div>
      <SubmitButton pendingText="Opening your demo copy…" className="btn btn-primary btn-block">
        {label}
      </SubmitButton>
    </form>
  );
}

/** One-click switch to another demo case from inside the app (same public demo login, same server-side check). */
export function DemoSwitchButton({ username, password, label, current }: { username: string; password: string; label: string; current: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(enterDemo, {});
  return (
    <form action={action}>
      <FormError message={state.errors?.form} />
      <input type="hidden" name="username" value={username} />
      <input type="hidden" name="password" value={password} />
      <SubmitButton pendingText="Opening…" className={`btn ${current ? "btn-secondary" : "btn-ghost"} btn-block`}>
        {label}
        {current ? " (current)" : ""}
      </SubmitButton>
    </form>
  );
}
