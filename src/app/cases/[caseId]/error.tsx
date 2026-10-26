"use client";
import Link from "next/link";
/** Error boundary for case screens. Shows a safe message only — never stack traces or internals. */
export default function CaseError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <h1 style={{ fontSize: 24 }}>Something went wrong loading this screen</h1>
      <p>Your saved notes are not affected. Please try again. If this keeps happening, go back to your cases.</p>
      <p className="secondary">If this is about an emergency, call 911 — don&apos;t wait for the app.</p>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-primary" type="button" onClick={reset}>
          Try again
        </button>
        <Link className="btn btn-secondary" href="/cases">
          Back to cases
        </Link>
      </div>
    </div>
  );
}
