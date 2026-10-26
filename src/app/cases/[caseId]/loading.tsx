/** Shown while a case screen loads (kept simple and calm; no spinner-only signal). */
export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <p style={{ fontWeight: 600 }}>Loading this case…</p>
      <div style={{ height: 12, width: "60%", background: "var(--unknown-bg)", borderRadius: 6 }} />
      <div style={{ height: 12, width: "40%", background: "var(--unknown-bg)", borderRadius: 6 }} />
    </div>
  );
}
