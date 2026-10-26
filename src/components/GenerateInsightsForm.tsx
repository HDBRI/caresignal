"use client";
import { generateInsightsAction } from "@/app/actions/insights";
import { SubmitButton } from "./forms";

export function GenerateInsightsForm({
  caseId,
  period,
  disabled,
  label,
  force,
  secondary,
}: {
  caseId: string;
  period: string;
  disabled: boolean;
  label: string;
  /** Explicit regeneration: a new AI call even if a saved result for the exact same notes exists. */
  force?: boolean;
  secondary?: boolean;
}) {
  return (
    <form action={generateInsightsAction} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="period" value={period} />
      {force && <input type="hidden" name="force" value="1" />}
      {disabled ? (
        <span className={`btn ${secondary ? "btn-secondary" : "btn-primary"}`} aria-disabled="true">
          {label}
        </span>
      ) : (
        <SubmitButton pendingText="Generating — this takes about 20–40 seconds…" className={`btn ${secondary ? "btn-secondary" : "btn-primary"}`}>
          {label}
        </SubmitButton>
      )}
    </form>
  );
}
