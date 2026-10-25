"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./shell.module.css";

/** Sidebar = screens 3–8 exactly (see docs/IMPLEMENTATION_PLAN.md §2). */
export const SIDEBAR = [
  { screen: 3, slug: "overview", label: "Overview" },
  { screen: 4, slug: "observations", label: "Observations" },
  { screen: 5, slug: "insights", label: "Insights" },
  { screen: 6, slug: "handoffs", label: "Handoffs" },
  { screen: 7, slug: "receiver", label: "Demo receiver" },
  { screen: 8, slug: "settings", label: "Settings" },
] as const;

export function SideNav({ caseId }: { caseId: string }) {
  const path = usePathname();
  return (
    <nav>
      <ul className={styles.nav}>
        {SIDEBAR.map((item) => {
          const href = `/cases/${caseId}/${item.slug}`;
          const active = path?.startsWith(href);
          return (
            <li key={item.slug}>
              <Link href={href} className={active ? styles.navActive : styles.navLink} aria-current={active ? "page" : undefined}>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
