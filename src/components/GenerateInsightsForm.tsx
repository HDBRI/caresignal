"use client";
import { generateInsightsAction } from "@/app/actions/insights";
import { SubmitButton } from "./forms";

export function GenerateInsightsForm({ caseId, period, disabled, label }: { caseId: string; period: string; disabled: boolean; label: string }) {
  return (
    <form action={generateInsightsAction} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="period" value={period} />
      {disabled ? (
        <span className="btn btn-primary" aria-disabled="true">
          {label}
        </span>
      ) : (
        <SubmitButton pendingText="Generating — this takes about 20–40 seconds…">{label}</SubmitButton>
      )}
    </form>
  );
}
