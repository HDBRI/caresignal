import { requireActor, principalOf } from "@/lib/auth/session";
import { getCase, listBaselines } from "@/lib/repo/cases";
import { getDb } from "@/lib/repo/db";
import { resetMyDemo } from "@/app/actions/auth";
import { CaseForm } from "@/components/CaseForm";
import { DeleteAccountForm } from "@/components/AccountForms";

export const dynamic = "force-dynamic";

/** Screen 8 — Settings / Care Context (account + care-context parts; more settings come later). */
export default async function SettingsPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const actor = await requireActor();
  const db = await getDb();
  const p = principalOf(actor);
  const [c, baselines] = await Promise.all([getCase(db, p, caseId), listBaselines(db, p, caseId)]);

  return (
    <>
      <h1>Settings</h1>

      <section aria-labelledby="care">
        <h2 id="care" style={{ marginBottom: 12 }}>
          Care context
        </h2>
        <CaseForm mode="edit" existing={c} baselines={baselines} />
      </section>

      {actor.kind === "demo" ? (
        <section className="card" aria-labelledby="demo" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h2 id="demo">Your demo copy</h2>
          <p>
            You are using a <strong>shared demo login</strong>. This copy of the case is yours for this browser: other
            visitors can&apos;t see your changes, and you can&apos;t see theirs. It is not a private or secure account.
          </p>
          <p className="secondary">
            Resetting deletes everything in your copy — notes you added, alerts you marked as seen, check-ins, AI results,
            handoffs and receipts — and restores the original scenario with dates regenerated relative to now. Other
            visitors&apos; copies are not affected.
          </p>
          <form action={resetMyDemo}>
            <button className="btn btn-secondary" type="submit">
              Reset my demo copy
            </button>
          </form>
        </section>
      ) : (
        <section className="card" aria-labelledby="account" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h2 id="account">Account</h2>
          <p>
            Signed in as <strong>{actor.displayName}</strong>
            {actor.email ? ` (${actor.email})` : ""}.
          </p>
          <p className="secondary">
            Deleting your account removes the account and every case, note, AI result, check-in, handoff and receipt linked to
            it. Copies may remain in the database provider&apos;s routine backups for a limited time.
          </p>
          <DeleteAccountForm />
        </section>
      )}
    </>
  );
}
