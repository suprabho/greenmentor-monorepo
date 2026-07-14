import { FlowArrow, Cards, Stack, Article, VideoCamera, Users, Briefcase, ChartBarHorizontal, TreeStructure } from "@phosphor-icons/react/dist/ssr";
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
 * The community admin hub sections — vismay's app-card pattern. Add a section
 * here once and it appears both on the dashboard ({@link app/page.tsx}) and in
 * the site header's Tools dropdown ({@link components/site-header.tsx}). Flip
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
    status: "available",
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
    status: "available",
  },
  {
    href: "/webinars",
    icon: VideoCamera,
    name: "Webinars",
    desc: "Schedule the Academy's live webinars, publish them to the platform, and track funnel metrics.",
    status: "available",
  },
  {
    href: "/instructors",
    icon: Users,
    name: "Instructors",
    desc: "The practitioner roster — profiles that power the webinar instructor picker and header speaker cards.",
    status: "available",
  },
  {
    href: "/jobs",
    icon: Briefcase,
    name: "Jobs",
    desc: "Curated ESG & sustainability roles — author postings and publish them to the platform jobs board.",
    status: "available",
  },
  {
    href: "/brsr",
    icon: ChartBarHorizontal,
    name: "BRSR intelligence",
    desc: "The NSE BRSR filings corpus — scrape health, per-year coverage, and the extracted emissions, energy, water and safety indicators.",
    status: "available",
  },
  {
    href: "/nic",
    icon: TreeStructure,
    name: "NIC classification",
    desc: "India's NIC-2008 sector → industry taxonomy — 21 sectors, 88 industries, 238 groups, scraped from the CSO and visualised.",
    status: "available",
  },
];
