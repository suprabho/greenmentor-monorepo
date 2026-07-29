import {
  Books,
  Briefcase,
  ChartBar,
  Flame,
  GraduationCap,
  House,
  Lightning,
  Newspaper,
  Sparkle,
  SquaresFour,
  Trophy,
  VideoCamera,
  Wind,
  type Icon,
} from "@phosphor-icons/react";

// The signed-in app's navigation, shared by the sidebar (components/shell.tsx)
// and the command palette's "Go to" section. It lives here rather than in the
// shell because the palette is rendered *by* the shell — importing back the
// other way would be a cycle.

export type NavChild = { label: string; href: string; icon: Icon };
export type NavItem = { label: string; href: string; icon: Icon; children: NavChild[] };
export type NavGroup = { heading: string | null; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    heading: null,
    items: [{ label: "Home", href: "/home", icon: House, children: [] }],
  },
  {
    heading: "Learn",
    items: [{ label: "Academy", href: "/academy", icon: GraduationCap, children: [] }],
  },
  {
    heading: "Work",
    items: [
      { label: "AI", href: "/ai-hub", icon: Sparkle, children: [] },
      {
        label: "Longsite Lite",
        href: "/energy",
        icon: SquaresFour,
        children: [
          { label: "Fuel", href: "/energy/fuel", icon: Flame },
          { label: "Electricity", href: "/energy/electricity", icon: Lightning },
          { label: "Fugitive", href: "/energy/fugitive", icon: Wind },
          { label: "Analyze", href: "/energy/analyze", icon: ChartBar },
        ],
      },
    ],
  },
  {
    heading: "Grow",
    items: [
      {
        label: "News",
        href: "/feed",
        icon: Newspaper,
        children: [
          { label: "Leaderboards", href: "/feed/leaderboards", icon: Trophy },
          { label: "Library", href: "/feed/library", icon: Books },
        ],
      },
      { label: "Jobs", href: "/jobs", icon: Briefcase, children: [] },
      { label: "Webinars & Events", href: "/webinars", icon: VideoCamera, children: [] },
    ],
  },
];

// Bottom tabs are a deliberate subset: Webinars are reachable from Home's
// "happening soon" section, and Longsite Lite is desktop data-entry work.
export const MOBILE_NAV: NavChild[] = [
  { label: "Home", href: "/home", icon: House },
  { label: "News", href: "/feed", icon: Newspaper },
  { label: "Academy", href: "/academy", icon: GraduationCap },
  { label: "AI", href: "/ai-hub", icon: Sparkle },
  { label: "Jobs", href: "/jobs", icon: Briefcase },
];

/** Every navigable destination, flattened — what the palette offers as "Go to". */
export const NAV_DESTINATIONS: { label: string; href: string; icon: Icon; parent: string | null }[] =
  NAV_GROUPS.flatMap((group) =>
    group.items.flatMap((item) => [
      { label: item.label, href: item.href, icon: item.icon, parent: null },
      ...item.children.map((child) => ({
        label: child.label,
        href: child.href,
        icon: child.icon,
        parent: item.label,
      })),
    ])
  );
