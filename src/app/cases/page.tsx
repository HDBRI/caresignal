import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActor, principalOf } from "@/lib/auth/session";
import { SEED_CASES } from "@/lib/fixtures";
import { labelFor, CARE_PHASES } from "@/lib/onboarding";
import { listCases } from "@/lib/repo/cases";
import { getDb } from "@/lib/repo/db";
import { startFromScenario } from "@/app/actions/cases";
import { BrandLink, SiteFooter } from "@/components/SiteChrome";
import { ArrowIcon, CheckIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

/** Screen 2 — Choose Case / Onboarding. */
export default async function CasesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requireActor();
  const params = await searchParams;
  const cases = await listCases(await getDb(), principalOf(actor));

  if (actor.kind === "demo") {
    if (cases[0]) redirect(`/cases/${cases[0].id}/overview`);
    redirect("/demo");
  }

  return (
    <main id="main" className="wide-page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <BrandLink />
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span className="pill badge-account">Signed in as {actor.displayName}</span>
          <form action="/auth/sign-out" method="post">
            <button className="btn btn-ghost" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </div>

      {params.password === "updated" && (
        <p className="form-success" role="status">
          <CheckIcon size={17} /> Your password was updated.
        </p>
      )}

      <header>
        <h1>Your fictional cases</h1>
        <p className="secondary" style={{ fontSize: 15 }}>
          Each case is one fictional person. Cases are private to your account and never mixed together.
        </p>
      </header>

      <section aria-labelledby="your-cases" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 id="your-cases" className="sr-only">
          Your cases
        </h2>
        {cases.length === 0 ? (
          <p className="card secondary">You don&apos;t have any cases yet. Create one below — it takes under a minute.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
            {cases.map((c) => (
              <li key={c.id} className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span className="pill pill-unknown" style={{ alignSelf: "flex-start" }}>
                  Synthetic · {c.patientRef}
                </span>
                <h3>{c.pseudonym}</h3>
                <p className="secondary">
                  {c.seedKey ? "Started from a demo scenario" : "Created by you"} · {labelFor(CARE_PHASES, c.carePhase)}
                </p>
                <Link className="btn btn-secondary" href={`/cases/${c.id}/overview`} style={{ marginTop: "auto" }}>
                  Open <ArrowIcon size={16} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card" aria-labelledby="new-case" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 id="new-case">Start a new case</h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link className="btn btn-primary" href="/cases/new">
            Create a fictional case
          </Link>
        </div>
        <p className="secondary">Or start from a private copy of a demo scenario (its example notes come with it, marked as seeded):</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {SEED_CASES.map((s) => (
            <form key={s.seedKey} action={startFromScenario}>
              <input type="hidden" name="seedKey" value={s.seedKey} />
              <button className="btn btn-secondary" type="submit">
                Copy “{s.patient.pseudonym}” scenario
              </button>
            </form>
          ))}
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
