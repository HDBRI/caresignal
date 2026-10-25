"use client";
import { useRouter } from "next/navigation";

export function CaseSwitcher({ current, cases }: { current: string; cases: { id: string; label: string }[] }) {
  const router = useRouter();
  return (
    <label style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13.5 }}>
      <span className="sr-only">Switch case</span>
      <select
        className="select"
        style={{ minHeight: 36, padding: "4px 8px", width: "auto" }}
        value={current}
        onChange={(e) => router.push(`/cases/${e.target.value}/overview`)}
      >
        {cases.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
    </label>
  );
}
