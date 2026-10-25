import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActor } from "@/lib/auth/session";
import { BrandLink, SiteFooter } from "@/components/SiteChrome";
import { CaseForm } from "@/components/CaseForm";

export const dynamic = "force-dynamic";

/** Screen 2 (onboarding) — create a fictional case. Only the pseudonym is required. */
export default async function NewCasePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requireActor();
  if (actor.kind !== "registered") redirect("/cases");
  const { welcome } = await searchParams;
  return (
    <main id="main" className="medium-page">
      <BrandLink />
      <header style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {welcome && <span className="pill badge-account" style={{ alignSelf: "flex-start" }}>Account created · welcome, {actor.displayName}</span>}
        <h1>Create a fictional case</h1>
        <p className="secondary" style={{ fontSize: 15 }}>
          Only a fictional name is required — everything else is optional and can be added later in Settings. Anything
          you leave blank is shown as <strong>“Not provided”</strong>, never as normal. Please don&apos;t enter a real
          person&apos;s name, date of birth, address, phone number, insurance or medical records.
        </p>
      </header>
      <CaseForm mode="create" />
      <Link href="/cases" className="muted-link">
        Cancel and go back
      </Link>
      <SiteFooter />
    </main>
  );
}
