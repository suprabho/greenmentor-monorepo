import { FlowArrow, Cards, Stack, Article } from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";

export type SectionStatus = "available" | "soon";

export interface AdminSection {
  href: string;
  icon: Icon;
  name: string;
  desc: string;
  status: SectionStatus;
}

/**
 * The community admin hub sections — vismay's app-card / tab pattern. Add a
 * section here once and it appears both on the dashboard ({@link app/page.tsx})
 * and in the section tab strip ({@link components/admin-tabs.tsx}). Flip
 * `status` to `"available"` and build the matching `app/<slug>/page.tsx` to
 * bring one online.
 */
export const ADMIN_SECTIONS: AdminSection[] = [
  {
    href: "/pipeline",
    icon: FlowArrow,
    name: "Pipeline",
    desc: "Track community content as it moves from idea to published — the production board for webinars, newsletters and posts.",
    status: "available",
  },
  {
    href: "/share-cards",
    icon: Cards,
    name: "Share cards studio",
    desc: "Compose on-brand social share cards over the aura backgrounds and export pixel-perfect PNGs.",
    status: "soon",
  },
  {
    href: "/epics",
    icon: Stack,
    name: "Epics",
    desc: "Group related stories into campaigns and themed series the community team runs together.",
    status: "soon",
  },
  {
    href: "/stories",
    icon: Article,
    name: "Stories",
    desc: "The individual content pieces — drafts, reviews and publishing state for each story.",
    status: "soon",
  },
];
