import { FlowArrow, Stack, Article, Newspaper, VideoCamera, Users, Briefcase, ChartBarHorizontal, TreeStructure, Target, ListChecks, Compass } from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";

export type SectionStatus = "available" | "soon";

/** Named groups sections are clustered under on the dashboard. Undefined = ungrouped, rendered under "Sections". */
export type SectionGroup = "Feed" | "Webinar" | "Materiality Analysis";

export interface AdminSection {
  href: string;
  icon: Icon;
  name: string;
  desc: string;
  status: SectionStatus;
  group?: SectionGroup;
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
    href: "/epics",
    icon: Stack,
    name: "Epics",
    desc: "Group related stories into campaigns and themed series the community team runs together.",
    status: "soon",
  },
  {
    href: "/news",
    icon: Newspaper,
    name: "News",
    desc: "The ESG news feed the platform shows. Ingested nightly from RSS — set a picture by hand for the regulators and wire copy that publish none.",
    status: "available",
    group: "Feed",
  },
  {
    href: "/stories",
    icon: Article,
    name: "Stories",
    desc: "The individual content pieces — drafts, reviews and publishing state for each story.",
    status: "available",
    group: "Feed",
  },
  {
    href: "/jobs",
    icon: Briefcase,
    name: "Jobs",
    desc: "Curated ESG & sustainability roles — author postings and publish them to the platform jobs board.",
    status: "available",
    group: "Feed",
  },
  {
    href: "/webinars",
    icon: VideoCamera,
    name: "Webinars",
    desc: "Schedule the Academy's live webinars, publish them to the platform, and track funnel metrics.",
    status: "available",
    group: "Webinar",
  },
  {
    href: "/instructors",
    icon: Users,
    name: "Instructors",
    desc: "The practitioner roster — profiles that power the webinar instructor picker and header speaker cards.",
    status: "available",
    group: "Webinar",
  },
  {
    href: "/pipeline",
    icon: FlowArrow,
    name: "Pipeline",
    desc: "Track community content as it moves from idea to published — the production board for webinars, newsletters and posts.",
    status: "available",
    group: "Materiality Analysis",
  },
  {
    href: "/brsr",
    icon: ChartBarHorizontal,
    name: "BRSR intelligence",
    desc: "The NSE BRSR filings corpus — scrape health, per-year coverage, and the extracted emissions, energy, water and safety indicators.",
    status: "available",
    group: "Materiality Analysis",
  },
  {
    href: "/nic",
    icon: TreeStructure,
    name: "NIC classification",
    desc: "India's NIC-2008 sector → industry taxonomy — 21 sectors, 88 industries, 238 groups, scraped from the CSO and visualised.",
    status: "available",
    group: "Materiality Analysis",
  },
  {
    href: "/sustainalytics",
    icon: ListChecks,
    name: "Material ESG Issues",
    desc: "Sustainalytics' materiality taxonomy — the ESG issues financially material to each subindustry, crosswalked to India's NIC-2008 sectors so it lines up with BRSR.",
    status: "available",
    group: "Materiality Analysis",
  },
  {
    href: "/materiality",
    icon: Target,
    name: "ESG Materiality Map",
    desc: "MSCI's ESG Industry Materiality Map — the Key Issues material to each GICS sector and sub-industry, with average weights. Internal reference only.",
    status: "available",
    group: "Materiality Analysis",
  },
  {
    href: "/sasb",
    icon: Compass,
    name: "SASB Materiality Finder",
    desc: "SASB's 77 SICS industries → financially-material issue categories and disclosure topics, crosswalked to India's NIC-2008 sectors.",
    status: "available",
    group: "Materiality Analysis",
  },
];
