"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Newspaper,
  GraduationCap,
  Briefcase,
  Sparkle,
  SquaresFour,
  Fire,
  Lightning,
  Coins,
  MagnifyingGlass,
  CalendarDots,
  Trophy,
  Books,
  Leaf,
  SidebarSimple,
} from "@phosphor-icons/react";
import { clsx } from "clsx";
import { Avatar } from "@/components/ui";
import { me } from "@/lib/data";

const nav = [
  {
    label: "Feed",
    href: "/feed",
    icon: Newspaper,
    children: [
      { label: "Calendar", href: "/feed/calendar", icon: CalendarDots },
      { label: "Leaderboards", href: "/feed/leaderboards", icon: Trophy },
      { label: "Library", href: "/feed/library", icon: Books },
    ],
  },
  { label: "Academy", href: "/academy", icon: GraduationCap, children: [] },
  { label: "Jobs", href: "/jobs", icon: Briefcase, children: [] },
  { label: "AI Hub", href: "/ai-hub", icon: Sparkle, children: [] },
  { label: "Longsite Lite", href: "/longsite", icon: SquaresFour, children: [] },
];

// Fallback shown when signed out or the stats fetch fails — the shell must
// never break on marketing-adjacent or error states.
const FALLBACK_STATS = [
  { label: "2,840 XP", icon: Lightning, iconClass: "text-green-400" },
  { label: "9-day", icon: Fire, iconClass: "text-orange-400" },
  { label: "1,450 cr", icon: Coins, iconClass: "text-white/70" },
];

const COLLAPSED_KEY = "gm-sidebar-collapsed";

export type ShellStats = { xp: number; coins: number; streakDays: number };

export function Shell({ children, stats }: { children: React.ReactNode; stats?: ShellStats }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const sidebarStats = stats
    ? [
        { label: `${stats.xp.toLocaleString()} XP`, icon: Lightning, iconClass: "text-green-400" },
        { label: `${stats.streakDays}-day`, icon: Fire, iconClass: "text-orange-400" },
        { label: `${stats.coins.toLocaleString()} cr`, icon: Coins, iconClass: "text-white/70" },
      ]
    : FALLBACK_STATS;
  const mobileStats = stats ?? { xp: 2840, coins: 1450, streakDays: 9 };

  useEffect(() => {
    if (window.localStorage.getItem(COLLAPSED_KEY) === "1") setCollapsed(true);
  }, []);

  const toggleSidebar = () =>
    setCollapsed((prev) => {
      window.localStorage.setItem(COLLAPSED_KEY, prev ? "0" : "1");
      return !prev;
    });

  const isActive = (href: string) =>
    href === "/feed" ? pathname === "/feed" : pathname.startsWith(href);

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
          <Link href="/feed" className="flex items-center gap-2.5">
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
          {nav.map((item) => (
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
              {!collapsed && item.children.length > 0 && pathname.startsWith("/feed") && (
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
        </nav>

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
            src={me.avatar}
            name={me.name}
            size={36}
            className="shrink-0 ring-2 ring-green-500/60"
          />
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold">Supro</span>
              <span className="block text-[11px] text-green-100/70">Green Learning Profile</span>
            </span>
          )}
        </Link>
      </aside>

      {/* Main column */}
      <div className="min-w-0 flex-1">
        {/* Top bar (mobile/tablet only — search and stats live in the sidebar on desktop) */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-gray-200 bg-white/90 px-4 backdrop-blur lg:hidden">
          <Link href="/feed" className="mr-1 flex items-center gap-2">
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
            <span className="flex items-center gap-1.5 rounded-pill bg-green-50 px-2.5 py-1 text-[12px] font-semibold text-green-700">
              <Lightning size={13} weight="fill" /> {mobileStats.xp.toLocaleString()} XP
            </span>
            <span className="flex items-center gap-1.5 rounded-pill bg-[#FFF4E0] px-2.5 py-1 text-[12px] font-semibold text-[#B25E00]">
              <Fire size={13} weight="fill" /> {mobileStats.streakDays}-day
            </span>
            <span className="hidden sm:flex items-center gap-1.5 rounded-pill bg-gray-100 px-2.5 py-1 text-[12px] font-semibold text-gray-800">
              <Coins size={13} weight="fill" /> {mobileStats.coins.toLocaleString()} cr
            </span>
          </div>
        </header>

        <main className="px-4 py-6 pb-24 lg:px-8 lg:pt-8 lg:pb-10">{children}</main>

        {/* Mobile bottom nav */}
        <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium",
                isActive(item.href) ? "text-green-700" : "text-gray-500"
              )}
            >
              <item.icon size={20} weight={isActive(item.href) ? "fill" : "regular"} />
              {item.label === "Longsite Lite" ? "Longsite" : item.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
