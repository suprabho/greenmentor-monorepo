"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  House,
  Newspaper,
  GraduationCap,
  VideoCamera,
  Briefcase,
  Sparkle,
  SquaresFour,
  Fire,
  Flame,
  Wind,
  ChartBar,
  Lightning,
  Coins,
  MagnifyingGlass,
  Trophy,
  Books,
  Leaf,
  SidebarSimple,
  SignIn,
  type Icon,
} from "@phosphor-icons/react";
import { clsx } from "clsx";
import { Avatar } from "@/components/ui";

type NavChild = { label: string; href: string; icon: Icon };
type NavItem = { label: string; href: string; icon: Icon; children: NavChild[] };
type NavGroup = { heading: string | null; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
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
const MOBILE_NAV: NavChild[] = [
  { label: "Home", href: "/home", icon: House },
  { label: "News", href: "/feed", icon: Newspaper },
  { label: "Academy", href: "/academy", icon: GraduationCap },
  { label: "AI", href: "/ai-hub", icon: Sparkle },
  { label: "Jobs", href: "/jobs", icon: Briefcase },
];

const COLLAPSED_KEY = "gm-sidebar-collapsed";

/** Deterministic "up one level" for nested Academy pages (course → catalog,
 * lesson/assessment → course). Top-level tabs have the nav itself, so no back. */
function backHrefFor(pathname: string): string | null {
  const seg = pathname.split("/").filter(Boolean);
  if (seg[0] !== "academy" || seg.length < 2) return null;
  return seg.length === 2 ? "/academy" : `/academy/${seg[1]}`;
}

export type ShellStats = { xp: number; coins: number; streakDays: number };
export type ShellViewer = { name: string; avatarUrl: string | null };

export function Shell({
  children,
  stats,
  viewer,
}: {
  children: React.ReactNode;
  stats?: ShellStats;
  viewer?: ShellViewer;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Stats/identity come from the server layout; absent means signed out (or the
  // fetch failed), in which case we show a sign-in prompt rather than fake numbers.
  const sidebarStats = stats
    ? [
        { label: `${stats.xp.toLocaleString()} XP`, icon: Lightning, iconClass: "text-green-400" },
        { label: `${stats.streakDays}-day`, icon: Fire, iconClass: "text-orange-400" },
        { label: `${stats.coins.toLocaleString()} cr`, icon: Coins, iconClass: "text-white/70" },
      ]
    : [];

  useEffect(() => {
    if (window.localStorage.getItem(COLLAPSED_KEY) === "1") setCollapsed(true);
  }, []);

  const toggleSidebar = () =>
    setCollapsed((prev) => {
      window.localStorage.setItem(COLLAPSED_KEY, prev ? "0" : "1");
      return !prev;
    });

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="min-h-screen lg:flex">
      {/* Sidebar */}
      <aside
        className={clsx(
          "hidden lg:flex shrink-0 flex-col bg-teal-900 text-white sticky top-0 h-screen transition-[width] duration-300",
          collapsed ? "w-[76px]" : "w-60"
        )}
      >
        <div
          className={clsx(
            "flex items-center pt-6 pb-4",
            collapsed ? "flex-col gap-2" : "justify-between pl-5 pr-3"
          )}
        >
          <Link href="/home" className="flex items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-[6px] bg-green-500 text-teal-900">
              <Leaf size={20} weight="fill" />
            </span>
            {!collapsed && (
              <span className="leading-tight whitespace-nowrap">
                <span className="block text-[15px] font-semibold tracking-tight">Green Mentor</span>
                <span className="block text-[11px] font-medium uppercase tracking-[0.18em] text-green-500">Pro</span>
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={toggleSidebar}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="grid size-8 shrink-0 place-items-center rounded-lg text-white/55 transition-colors hover:bg-white/10 hover:text-white"
          >
            <SidebarSimple size={18} />
          </button>
        </div>

        <div className="px-3 pb-4">
          <button
            type="button"
            title="Search courses, jobs, library"
            className={clsx(
              "flex w-full items-center gap-2 rounded-pill border border-white/10 bg-white/5 text-[13px] text-white/55 transition-colors hover:bg-white/10 hover:text-white",
              collapsed ? "justify-center py-2" : "px-3.5 py-2"
            )}
          >
            <MagnifyingGlass size={15} className="shrink-0" />
            {!collapsed && <span className="truncate">Search courses, jobs, library…</span>}
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
          {NAV_GROUPS.map((group) => (
            <div key={group.heading ?? "top"}>
              {group.heading !== null &&
                (collapsed ? (
                  <div className="mx-auto my-2 w-6 border-t border-white/10" />
                ) : (
                  <p className="px-3 pt-4 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/35">
                    {group.heading}
                  </p>
                ))}
              {group.items.map((item) => (
                <div key={item.href}>
                  <Link
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={clsx(
                      "flex items-center gap-3 rounded-[6px] py-2.5 text-[13.5px] font-medium transition-colors",
                      collapsed ? "justify-center" : "px-3",
                      isActive(item.href) && !item.children.some((c) => pathname.startsWith(c.href))
                        ? "bg-white/10 text-white"
                        : "text-white/65 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <item.icon
                      size={19}
                      className="shrink-0"
                      weight={isActive(item.href) ? "fill" : "regular"}
                    />
                    {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
                  </Link>
                  {!collapsed && item.children.length > 0 && pathname.startsWith(item.href) && (
                    <div className="ml-4 mt-0.5 space-y-0.5 border-l border-white/10 pl-3">
                      {item.children.map((c) => (
                        <Link
                          key={c.href}
                          href={c.href}
                          className={clsx(
                            "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[12.5px] transition-colors",
                            pathname.startsWith(c.href)
                              ? "text-green-500"
                              : "text-white/55 hover:text-white"
                          )}
                        >
                          <c.icon size={15} />
                          {c.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </nav>

        {sidebarStats.length > 0 && (
          <div
            className={clsx(
              "mx-3 mt-3 flex gap-1.5",
              collapsed ? "flex-col items-center" : "flex-wrap"
            )}
          >
            {sidebarStats.map((s) => (
              <span
                key={s.label}
                title={s.label}
                className={clsx(
                  "flex items-center gap-1.5 rounded-pill bg-white/10 text-[12px] font-semibold text-white/90",
                  collapsed ? "size-8 justify-center" : "px-2.5 py-1"
                )}
              >
                <s.icon size={13} weight="fill" className={clsx("shrink-0", s.iconClass)} />
                {!collapsed && s.label}
              </span>
            ))}
          </div>
        )}

        {viewer ? (
          <Link
            href="/profile"
            title={collapsed ? "Green Learning Profile" : undefined}
            className={clsx(
              "m-3 flex items-center gap-3 rounded-xl transition-colors",
              collapsed ? "justify-center p-2" : "p-3",
              pathname.startsWith("/profile") ? "bg-white/10" : "bg-white/5 hover:bg-white/10"
            )}
          >
            <Avatar
              src={viewer.avatarUrl ?? undefined}
              name={viewer.name}
              size={36}
              className="shrink-0 ring-2 ring-green-500/60"
            />
            {!collapsed && (
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold">{viewer.name}</span>
                <span className="block text-[11px] text-green-100/70">Green Learning Profile</span>
              </span>
            )}
          </Link>
        ) : (
          <Link
            href="/login"
            title={collapsed ? "Sign in" : undefined}
            className={clsx(
              "m-3 flex items-center gap-3 rounded-xl bg-white/5 transition-colors hover:bg-white/10",
              collapsed ? "justify-center p-2" : "p-3"
            )}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/10 text-green-400">
              <SignIn size={18} weight="bold" />
            </span>
            {!collapsed && (
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold">Sign in</span>
                <span className="block text-[11px] text-green-100/70">Track XP, streaks &amp; credits</span>
              </span>
            )}
          </Link>
        )}
      </aside>

      {/* Main column */}
      <div className="min-w-0 flex-1">
        {/* Top bar (mobile/tablet only — search and stats live in the sidebar on desktop) */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-gray-200 bg-white/90 px-4 backdrop-blur lg:hidden">
          <Link href="/home" className="mr-1 flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-teal-900 text-green-500">
              <Leaf size={15} weight="fill" />
            </span>
            <span className="text-[13px] font-semibold">GM Pro</span>
          </Link>
          <div className="hidden md:flex flex-1 max-w-md items-center gap-2 rounded-pill border border-gray-200 bg-gray-50 px-3.5 py-1.5 text-[13px] text-gray-500">
            <MagnifyingGlass size={15} />
            Search courses, jobs, library…
          </div>
          <div className="ml-auto flex items-center gap-2">
            {stats ? (
              <>
                <span className="flex items-center gap-1.5 rounded-pill bg-green-50 px-2.5 py-1 text-[12px] font-semibold text-green-700">
                  <Lightning size={13} weight="fill" /> {stats.xp.toLocaleString()} XP
                </span>
                <span className="flex items-center gap-1.5 rounded-pill bg-[#FFF4E0] px-2.5 py-1 text-[12px] font-semibold text-[#B25E00]">
                  <Fire size={13} weight="fill" /> {stats.streakDays}-day
                </span>
                <span className="hidden sm:flex items-center gap-1.5 rounded-pill bg-gray-100 px-2.5 py-1 text-[12px] font-semibold text-gray-800">
                  <Coins size={13} weight="fill" /> {stats.coins.toLocaleString()} cr
                </span>
              </>
            ) : (
              !viewer && (
                <Link
                  href="/login"
                  className="flex items-center gap-1.5 rounded-pill bg-green-50 px-2.5 py-1 text-[12px] font-semibold text-green-700"
                >
                  <SignIn size={13} weight="bold" /> Sign in
                </Link>
              )
            )}
          </div>
        </header>

        <main className="px-4 py-6 pb-24 lg:px-8 lg:pt-8 lg:pb-10">
          {backHrefFor(pathname) && (
            <Link
              href={backHrefFor(pathname)!}
              className="mb-4 inline-flex items-center gap-1.5 rounded-pill text-[12.5px] font-semibold text-gray-600 transition-colors hover:text-ink"
            >
              <ArrowLeft size={14} weight="bold" /> Back
            </Link>
          )}
          {children}
        </main>

        {/* Mobile bottom nav */}
        <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
          {MOBILE_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium",
                isActive(item.href) ? "text-green-700" : "text-gray-500"
              )}
            >
              <item.icon size={20} weight={isActive(item.href) ? "fill" : "regular"} />
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
