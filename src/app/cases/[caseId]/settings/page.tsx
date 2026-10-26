import Link from "next/link";
import { aiStatus } from "@/lib/ai/client";
import { requireActor, principalOf } from "@/lib/auth/session";
import { aiLimits, MODEL_NAME } from "@/lib/config";
import { getCase, listBaselines } from "@/lib/repo/cases";
import { getDb } from "@/lib/repo/db";
import { resetMyDemo } from "@/app/actions/auth";
import { saveReminderAction } from "@/app/actions/cases";
import { BaselineForm } from "@/components/BaselineForm";
import { CaseForm } from "@/components/CaseForm";
import { DeleteAccountForm } from "@/components/AccountForms";
import { AiStatusPill } from "@/components/AiStatusPill";
import { PROTOTYPE_LIMITATION } from "@/components/PrototypeNotice";

export const dynamic = "force-dynamic";

/** Screen 8 — Settings / Care context / profile. */
export default async function SettingsPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const actor = await requireActor();
  const db = await getDb();
  const p = principalOf(actor);
  const [c, baselines] = await Promise.all([getCase(db, p, caseId), listBaselines(db, p, caseId)]);
  const limits = aiLimits();

  return (
    <>
      <h1>Settings</h1>
      <nav aria-label="Settings sections" className="chip-row">
        {[
          ["care", "Care context"],
          ["baseline", "Baseline"],
          ["reminders", "Reminders"],
          ["ai", "AI & privacy"],
          ["cases", "Cases"],
          [actor.kind === "demo" ? "demo" : "account", actor.kind === "demo" ? "Demo copy" : "Account"],
          ["about", "About & limitations"],
        ].map(([id, label]) => (
          <a key={id} className="chip" href={`#${id}`}>
            {label}
          </a>
        ))}
      </nav>

      <section id="care" aria-labelledby="care-h">
        <h2 id="care-h" style={{ marginBottom: 12 }}>
          Care context
        </h2>
        <CaseForm mode="edit" existing={c} baselines={baselines} />
      </section>

      <section id="baseline" aria-labelledby="baseline-h">
        <h2 id="baseline-h" style={{ marginBottom: 12 }}>
          Usual baseline (caregiver-reported)
        </h2>
        <BaselineForm caseId={caseId} values={Object.fromEntries(baselines.map((b) => [b.category, b.description]))} />
      </section>

      <section id="reminders" className="card" aria-labelledby="rem-h" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h2 id="rem-h">Reminders</h2>
        <p className="secondary">
          In-app reminder preference only. CareSignal does <strong>not</strong> send email, text messages or push notifications.
          When turned on, the Overview simply prompts you for the day&apos;s check-in.
        </p>
        <form action={saveReminderAction} className="radio-row">
          <input type="hidden" name="caseId" value={caseId} />
          <label>
            <input type="radio" name="reminderPref" value="off" defaultChecked={c.reminderPref === "off"} /> Off (default)
          </label>
          <label>
            <input type="radio" name="reminderPref" value="in_app_daily" defaultChecked={c.reminderPref === "in_app_daily"} /> In-app daily
            check-in prompt
          </label>
          <button className="btn btn-secondary" type="submit">
            Save
          </button>
        </form>
      </section>

      <section id="ai" className="card" aria-labelledby="ai-h" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h2 id="ai-h">AI &amp; privacy</h2>
        <AiStatusPill status={aiStatus()} />
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
          <li>
            AI model: <strong>{MODEL_NAME}</strong> (through the course&apos;s Portkey gateway). Calls happen only on CareSignal&apos;s
            server; the key never reaches your browser.
          </li>
          <li>Sent to the AI: note text, note IDs and times, and the case pseudonym. Not sent: your email, username or account ID.</li>
          <li>
            AI suggestions are stored separately and never change your original notes. Every insight must link to the notes behind it.
          </li>
          <li>
            Daily AI limits: {limits.perUser} analyses per account and {limits.global} for the whole prototype. Notes and safety rules are
            never limited.
          </li>
          <li>
            The safety rules are fixed phrase checks that run without AI. Read the <Link href="/privacy">Privacy Notice</Link> and{" "}
            <Link href="/terms">Terms of Use</Link>.
          </li>
        </ul>
      </section>

      <section id="cases" className="card" aria-labelledby="cases-h" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h2 id="cases-h">Cases</h2>
        {actor.kind === "demo" ? (
          <p>
            Demo logins open one case each. <Link href="/demo">Switch to another demo case</Link>, or{" "}
            <Link href="/register">create an account</Link> to make your own fictional cases.
          </p>
        ) : (
          <p>
            <Link href="/cases">See all your cases</Link> · <Link href="/cases/new">Create a fictional case</Link> · start from a demo
            scenario on the cases page.
          </p>
        )}
      </section>

      {actor.kind === "demo" ? (
        <section id="demo" className="card" aria-labelledby="demo-h" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h2 id="demo-h">Your demo copy</h2>
          <p>
            You are using a <strong>shared demo login</strong>. This copy of the case is yours for this browser: other visitors can&apos;t
            see your changes, and you can&apos;t see theirs. It is not a private or secure account.
          </p>
          <p className="secondary">
            Resetting deletes everything in your copy — notes you added, alerts you marked as seen, check-ins, AI results, handoffs and
            receipts — and restores the original scenario with dates regenerated relative to now. Other visitors&apos; copies are not
            affected.
          </p>
          <form action={resetMyDemo}>
            <button className="btn btn-secondary" type="submit">
              Reset my demo copy
            </button>
          </form>
        </section>
      ) : (
        <section id="account" className="card" aria-labelledby="account-h" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h2 id="account-h">Account</h2>
          <p>
            Signed in as <strong>{actor.displayName}</strong>
            {actor.email ? ` (${actor.email})` : ""}. To change your password, sign out and use “Forgot password?”.
          </p>
          <p className="secondary">
            Deleting your account removes the account and every case, note, AI result, check-in, handoff and receipt linked to it. Copies
            may remain in the database provider&apos;s routine backups for a limited time.
          </p>
          <DeleteAccountForm />
        </section>
      )}

      <section id="about" className="card" aria-labelledby="about-h" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <h2 id="about-h">About &amp; limitations</h2>
        <p>{PROTOTYPE_LIMITATION}</p>
        <p className="secondary">
          The safety rules recognize only a small predefined set of phrases. No alert does not mean a situation is safe. A missing note or
          check-in means “not reported”. In an emergency, call 911.
        </p>
      </section>
    </>
  );
}
