import Link from "next/link";
import { CATEGORIES, categoryLabel, isCategoryId } from "@/lib/categories";
import { requireActor, principalOf } from "@/lib/auth/session";
import { checkinStatusLabel, listCheckins } from "@/lib/repo/checkins";
import { getDb } from "@/lib/repo/db";
import { latestEdits, listAnalyses, listObservations } from "@/lib/repo/observations";
import { addDays, localDate } from "@/lib/time";
import { AddObservationButton } from "@/components/AddObservation";
import { EmptyState, fmtDay, ObservationItem } from "@/components/display";
import { AutoRefreshWhilePending } from "@/components/ObservationTools";

export const dynamic = "force-dynamic";

const ORIGINS = [
  { id: "all", label: "All notes" },
  { id: "seeded", label: "Seeded examples" },
  { id: "session", label: "Added by you" },
  { id: "flagged", label: "Flagged by safety rules" },
] as const;

/** Screen 4 — Observations: chronological timeline (history), with check-ins shown per day. */
export default async function ObservationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ caseId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { caseId } = await params;
  const { category, show = "all", q: rawQ } = await searchParams;
  const q = (rawQ ?? "").trim().slice(0, 100);
  const actor = await requireActor();
  const db = await getDb();
  const p = principalOf(actor);
  const [observations, analyses, checkins, edits] = await Promise.all([
    listObservations(db, p, caseId),
    listAnalyses(db, p, caseId),
    listCheckins(db, p, caseId),
    latestEdits(db, p, caseId),
  ]);

  const activeCategory = isCategoryId(category) ? category : null;
  const filtered = observations.filter((o) => {
    if (show === "seeded" && o.origin !== "seeded") return false;
    if (show === "session" && o.origin !== "session") return false;
    if (show === "flagged" && o.safetyTier === "none") return false;
    if (q) {
      const hay = `${o.originalText} ${edits.get(o.id)?.editedText ?? ""} ${o.displayId} ${o.authorLabel ?? ""}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    if (activeCategory) {
      const a = analyses.get(o.id);
      if (!a || ![a.primaryCategory, ...a.secondaryCategories].includes(activeCategory)) return false;
    }
    return true;
  });

  // Group by local day (when it happened if known, else when it was logged), newest first.
  const dayOf = (iso: string) => localDate(new Date(iso));
  const groups = new Map<string, typeof filtered>();
  for (const o of filtered) {
    const d = dayOf(o.eventTime ?? o.enteredAt);
    groups.set(d, [...(groups.get(d) ?? []), o]);
  }
  const today = localDate(new Date());
  const firstDay = observations.length ? observations.map((o) => dayOf(o.eventTime ?? o.enteredAt)).sort()[0] : today;
  const days: string[] = [];
  const unfiltered = show === "all" && !activeCategory && !q;
  for (let d = today; d >= firstDay && days.length < 60; d = addDays(d, -1)) {
    if (groups.has(d) || unfiltered) days.push(d); // show empty days only in the unfiltered timeline
  }
  const checkinByDay = new Map(checkins.map((c) => [c.day, c]));
  const hasAnyAnalysis = analyses.size > 0;
  const qs = (next: Record<string, string | null>) => {
    const u = new URLSearchParams();
    const merged = { category: activeCategory, show, q: q || null, ...next };
    for (const [k, v] of Object.entries(merged)) if (v && !(k === "show" && v === "all")) u.set(k, v);
    const s = u.toString();
    return `/cases/${caseId}/observations${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div>
          <h1>Observations</h1>
          <p className="secondary" style={{ fontSize: 15 }}>
            Every note exactly as written, newest first, grouped by the day it happened (or was logged, if no time was given), with
            that day&apos;s check-in. {observations.length} total.
          </p>
        </div>
        <AddObservationButton />
      </header>

      <AutoRefreshWhilePending pending={observations.some((o) => o.aiState === "pending")} />
      <nav aria-label="Filter observations" className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <form role="search" action={`/cases/${caseId}/observations`} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {show !== "all" && <input type="hidden" name="show" value={show} />}
          {activeCategory && <input type="hidden" name="category" value={activeCategory} />}
          <label htmlFor="obs-search" className="sr-only">
            Search notes
          </label>
          <input id="obs-search" name="q" className="input" style={{ maxWidth: 360 }} placeholder="Search note text, ID or author" defaultValue={q} />
          <button className="btn btn-secondary" type="submit">
            Search
          </button>
          {q && (
            <Link className="btn btn-ghost" href={qs({ q: null })}>
              Clear search
            </Link>
          )}
        </form>
        <div className="chip-row">
          {ORIGINS.map((o) => (
            <Link key={o.id} className="chip" href={qs({ show: o.id })} aria-current={show === o.id ? "true" : undefined}>
              {o.label}
            </Link>
          ))}
        </div>
        <div className="chip-row" style={{ alignItems: "center" }}>
          <span className="stat-label">AI category:</span>
          <Link className="chip" href={qs({ category: null })} aria-current={!activeCategory ? "true" : undefined}>
            Any
          </Link>
          {CATEGORIES.map((c) => (
            <Link key={c.id} className="chip" href={qs({ category: c.id })} aria-current={activeCategory === c.id ? "true" : undefined}>
              {c.label}
            </Link>
          ))}
        </div>
        {!hasAnyAnalysis && (
          <p className="secondary">No notes in this case have AI categories yet, so category filters will show no results.</p>
        )}
      </nav>

      {filtered.length === 0 && !unfiltered ? (
        <EmptyState title="No observations match this filter">
          {q ? `No notes contain “${q}”.` : activeCategory ? `No notes are labeled “${categoryLabel(activeCategory)}”.` : "Try another filter."}{" "}
          <Link href={qs({ show: "all", category: null, q: null })}>Show all notes</Link>
        </EmptyState>
      ) : observations.length === 0 ? (
        <EmptyState title="No observations yet">
          No observations were logged for this period. There isn&apos;t enough recorded information to summarize this period.
        </EmptyState>
      ) : (
        <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 16 }}>
          {days.map((d) => {
            const items = (groups.get(d) ?? []).sort((a, b) => (b.eventTime ?? b.enteredAt).localeCompare(a.eventTime ?? a.enteredAt));
            const ci = checkinByDay.get(d);
            return (
              <li key={d} className="card" aria-labelledby={`day-${d}`}>
                <div className="section-head">
                  <h2 id={`day-${d}`}>{d === today ? `Today · ${fmtDay(d)}` : fmtDay(d)}</h2>
                  <span className="chip-row">
                    <span className={`pill ${items.length ? "pill-calm" : "pill-unknown"}`}>
                      {items.length ? `${items.length} observation${items.length > 1 ? "s" : ""} logged` : "No observation logged"}
                    </span>
                    <span className={`pill ${ci ? "pill-calm" : "pill-unknown"}`}>
                      Check-in: {ci ? `caregiver reported “${checkinStatusLabel(ci.status)}”` : checkinStatusLabel(null)}
                      {ci?.note ? ` — “${ci.note}”` : ""}
                    </span>
                  </span>
                </div>
                {items.length === 0 ? (
                  <p className="secondary">
                    {ci?.status === "no_change"
                      ? "No note was written, but the caregiver’s check-in reported no meaningful change."
                      : "No observations were logged for this day. That means “not reported” — not that nothing happened."}
                  </p>
                ) : (
                  <ul className="list-plain">
                    {items.map((o) => (
                      <li key={o.id}>
                        <ObservationItem
                          o={o}
                          analysis={analyses.get(o.id)}
                          caseId={caseId}
                          currentWording={edits.get(o.id) ? { text: edits.get(o.id)!.editedText, version: edits.get(o.id)!.version } : null}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}
