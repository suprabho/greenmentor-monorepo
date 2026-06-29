"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

export interface AdminTab {
  href: string;
  label: string;
  /** Active only when pathname === href. Otherwise also active under `${href}/`. */
  exact?: boolean;
  /** Render as a muted, non-clickable placeholder for a section not built yet. */
  soon?: boolean;
}

/**
 * Section navigation for the community admin hub — a light-theme port of
 * vismay's `@vismay/admin-core` AdminTabs, styled in the GreenMentor design
 * system. Drop it under the PageHeader of any admin section page.
 */
export function AdminTabs({ tabs }: { tabs: AdminTab[] }) {
  const pathname = usePathname() ?? "";
  return (
    <nav className="no-scrollbar flex gap-1 overflow-x-auto">
      {tabs.map((tab) => {
        if (tab.soon) {
          return (
            <span
              key={tab.href}
              title="Coming soon"
              className="shrink-0 cursor-not-allowed rounded-pill px-3 py-1.5 text-[13px] font-medium text-gray-400"
            >
              {tab.label}
            </span>
          );
        }
        const active = tab.exact
          ? pathname === tab.href
          : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={clsx(
              "shrink-0 rounded-pill px-3 py-1.5 text-[13px] font-medium transition-colors",
              active
                ? "bg-teal-900 text-white"
                : "text-gray-600 hover:bg-gray-100 hover:text-ink"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
