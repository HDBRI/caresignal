"use client";
import { useFormStatus } from "react-dom";
import { AlertIcon, CheckIcon } from "./icons";

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="field-error">
      <AlertIcon size={15} />
      {message}
    </p>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="form-error" role="alert">
      <AlertIcon size={17} />
      <span>{message}</span>
    </div>
  );
}

export function FormSuccess({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="form-success" role="status">
      <CheckIcon size={17} />
      <span>{message}</span>
    </div>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  name: string;
  label: string;
  hint?: string;
  error?: string;
};

export function TextField({ name, label, hint, error, id, ...rest }: InputProps) {
  const fieldId = id ?? `f-${name}`;
  const describedBy = [hint ? `${fieldId}-hint` : null, error ? `${fieldId}-err` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="field">
      <label htmlFor={fieldId}>{label}</label>
      {hint && (
        <p id={`${fieldId}-hint`} className="hint">
          {hint}
        </p>
      )}
      <input id={fieldId} name={name} className="input" aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...rest} />
      <FieldError id={`${fieldId}-err`} message={error} />
    </div>
  );
}

export function CheckField({ name, children, error }: { name: string; children: React.ReactNode; error?: string }) {
  const id = `f-${name}`;
  return (
    <div className="field">
      <div className="check-row">
        <input type="checkbox" id={id} name={name} required aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-err` : undefined} />
        <label htmlFor={id}>{children}</label>
      </div>
      <FieldError id={`${id}-err`} message={error} />
    </div>
  );
}

export function SubmitButton({ children, pendingText, className = "btn btn-primary" }: { children: React.ReactNode; pendingText: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-disabled={pending}>
      {pending ? pendingText : children}
    </button>
  );
}
