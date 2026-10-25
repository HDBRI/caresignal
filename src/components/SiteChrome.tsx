import Link from "next/link";
import { LEGAL_LAST_UPDATED } from "@/lib/legal";

export function BrandLink() {
  return (
    <Link href="/" className="brand-row" aria-label="CareSignal home">
      <span className="brand-mark" aria-hidden="true">
        CS
      </span>
      <span className="brand-name">CareSignal</span>
    </Link>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <span>Classroom prototype · synthetic data only · not medical advice</span>
      <Link href="/terms">Terms of Use</Link>
      <Link href="/privacy">Privacy Notice</Link>
      <span>Notices updated {LEGAL_LAST_UPDATED}</span>
      <span>
        <strong>In an emergency, call 911.</strong>
      </span>
    </footer>
  );
}
