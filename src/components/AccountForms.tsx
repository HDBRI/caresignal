"use client";
import Link from "next/link";
import { useActionState } from "react";
import { deleteAccount, forgotPassword, register, resetPassword, signIn, type FormState } from "@/app/actions/auth";
import { CheckField, FormError, FormSuccess, SubmitButton, TextField } from "./forms";

export function SignInForm({ next }: { next?: string }) {
  const [state, action] = useActionState<FormState, FormData>(signIn, {});
  return (
    <form action={action} className="form" noValidate>
      <FormError message={state.errors?.form} />
      <input type="hidden" name="next" value={next ?? ""} />
      <TextField name="email" label="Email" type="email" autoComplete="email" required defaultValue={state.values?.email} />
      <TextField name="password" label="Password" type="password" autoComplete="current-password" required />
      <SubmitButton pendingText="Signing in…" className="btn btn-primary btn-block">
        Sign in
      </SubmitButton>
      <Link href="/forgot-password" className="muted-link">
        Forgot password?
      </Link>
    </form>
  );
}

export function RegisterForm() {
  const [state, action] = useActionState<FormState, FormData>(register, {});
  const e = state.errors ?? {};
  return (
    <form action={action} className="form" noValidate>
      <FormError message={e.form} />
      <TextField name="email" label="Email" type="email" autoComplete="email" required defaultValue={state.values?.email} error={e.email} />
      <TextField
        name="username"
        label="Username (shown as your display name)"
        hint="3–30 characters: letters, numbers, dots, dashes or underscores. Please don't use a real patient's name."
        autoComplete="username"
        required
        defaultValue={state.values?.username}
        error={e.username}
      />
      <TextField
        name="password"
        label="Password"
        type="password"
        hint="At least 10 characters, including a letter and a number."
        autoComplete="new-password"
        required
        error={e.password}
      />
      <TextField name="confirmPassword" label="Confirm password" type="password" autoComplete="new-password" required error={e.confirmPassword} />
      <fieldset>
        <legend className="sr-only">Required agreements</legend>
        <CheckField name="acceptTerms" error={e.acceptTerms}>
          I have read and accept the{" "}
          <Link href="/terms" target="_blank">
            Terms of Use
          </Link>{" "}
          (prototype notice).
        </CheckField>
        <CheckField name="acceptPrivacy" error={e.acceptPrivacy}>
          I have read and accept the{" "}
          <Link href="/privacy" target="_blank">
            Privacy Notice
          </Link>
          , including that my notes may be processed by an AI provider.
        </CheckField>
        <CheckField name="affirmFictional" error={e.affirmFictional}>
          I will enter <strong>fictional, synthetic information only</strong> — no real patient names, dates of birth,
          contact details, records or health information.
        </CheckField>
      </fieldset>
      <SubmitButton pendingText="Creating your account…" className="btn btn-primary btn-block">
        Create account
      </SubmitButton>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(forgotPassword, {});
  return (
    <form action={action} className="form" noValidate>
      <FormError message={state.errors?.form} />
      <FormSuccess message={state.message} />
      <TextField name="email" label="Email" type="email" autoComplete="email" required />
      <SubmitButton pendingText="Sending…" className="btn btn-primary btn-block">
        Send reset link
      </SubmitButton>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(resetPassword, {});
  return (
    <form action={action} className="form" noValidate>
      <FormError message={state.errors?.form} />
      <TextField
        name="password"
        label="New password"
        type="password"
        hint="At least 10 characters, including a letter and a number."
        autoComplete="new-password"
        required
        error={state.errors?.password}
      />
      <TextField name="confirmPassword" label="Confirm new password" type="password" autoComplete="new-password" required />
      <SubmitButton pendingText="Saving…" className="btn btn-primary btn-block">
        Save new password
      </SubmitButton>
    </form>
  );
}

export function DeleteAccountForm() {
  const [state, action] = useActionState<FormState, FormData>(deleteAccount, {});
  return (
    <form action={action} className="form">
      <FormError message={state.errors?.form} />
      <TextField name="confirm" label="Type DELETE to permanently delete your account and all its cases" autoComplete="off" error={state.errors?.confirm} />
      <SubmitButton pendingText="Deleting…" className="btn btn-danger">
        Delete my account
      </SubmitButton>
    </form>
  );
}
