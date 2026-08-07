"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  Coins,
  Fire,
  Leaf,
  Lightning,
  List,
  MagnifyingGlass,
  SidebarSimple,
  SignIn,
  WhatsappLogo,
} from "@phosphor-icons/react";
import { clsx } from "clsx";
import { Avatar } from "@/components/ui";
import { Logo } from "@/components/marketing/Logo";
import { MobileNavDrawer } from "@/components/mobile-nav-drawer";
import { CommandPalette } from "@/components/search/command-palette";
import { MOBILE_NAV, NAV_GROUPS } from "@/lib/app-nav";
import { WHATSAPP_COMMUNITY_LABEL, WHATSAPP_COMMUNITY_URL } from "@/lib/data/community";
import { track } from "@/lib/utils/analytics";

const COLLAPSED_KEY = "gm-sidebar-collapsed";

/** Deterministic "up one level" for nested pages: Academy (course → catalog,
 * lesson/assessment → course) and the shareable webinar/job/feed detail pages
 * (item → its list). Top-level tabs have the nav itself, so no back. */
const DETAIL_SECTIONS = new Set(["webinars", "jobs", "feed"]);

function backHrefFor(pathname: string): string | null {
  const seg = pathname.split("/").filter(Boolean);
  if (seg.length < 2) return null;
  if (seg[0] === "academy") return seg.length === 2 ? "/academy" : `/academy/${seg[1]}`;
  if (DETAIL_SECTIONS.has(seg[0]) && seg.length === 2) return `/${seg[0]}`;
  return null;
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

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

  // ⌘K / Ctrl-K opens search from anywhere. Ignored while the user is typing
  // in a field — otherwise it would hijack the shortcut inside the AI Hub
  // composer and the Energy forms.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "k" || (!e.metaKey && !e.ctrlKey)) return;
      const el = e.target as HTMLElement | null;
      const typing =
        el?.isContentEditable ||
        el?.tagName === "INPUT" ||
        el?.tagName === "TEXTAREA" ||
        el?.tagName === "SELECT";
      // …but once the palette is open its own input is the focused field, so
      // ⌘K still has to toggle it back shut.
      if (typing && !searchOpen) return;
      e.preventDefault();
      setSearchOpen((prev) => !prev);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [searchOpen]);

  // Drawer links close on tap; this catches programmatic navigation too.
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

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
          <Link href="/home" aria-label="Green Mentor Pro home" className="flex items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-[6px] bg-green-500 text-teal-900">
              <Leaf size={20} weight="fill" />
            </span>
            {!collapsed && (
              <span className="leading-tight whitespace-nowrap">
                <Logo bare variant="dark" className="block h-5" />
                <span className="mt-0.5 block text-[11px] font-medium uppercase tracking-[0.18em] text-green-500">
                  Pro
                </span>
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
            onClick={() => setSearchOpen(true)}
            title="Search courses, jobs, webinars (⌘K)"
            className={clsx(
              "flex w-full items-center gap-2 rounded-pill border border-white/10 bg-white/5 text-[13px] text-white/55 transition-colors hover:bg-white/10 hover:text-white",
              collapsed ? "justify-center py-2" : "px-3.5 py-2"
            )}
          >
            <MagnifyingGlass size={15} className="shrink-0" />
            {!collapsed && (
              <>
                <span className="truncate">Search courses, jobs, webinars…</span>
                <kbd className="ml-auto shrink-0 rounded border border-white/15 px-1.5 py-0.5 font-sans text-[10.5px] font-semibold text-white/45">
                  ⌘K
                </kbd>
              </>
            )}
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

        {/* Sits below the nav rather than inside NAV_GROUPS: those entries are
            next/link, matched by isActive(), and flattened into the ⌘K palette's
            "Go to" list — an off-site URL is wrong in all three. */}
        <a
          href={WHATSAPP_COMMUNITY_URL}
          target="_blank"
          rel="noopener noreferrer"
          title={collapsed ? WHATSAPP_COMMUNITY_LABEL : undefined}
          onClick={() => track("whatsapp_community_clicked")}
          className={clsx(
            "mx-3 mt-3 flex items-center gap-3 rounded-[6px] py-2.5 text-[13.5px] font-medium text-white/65 transition-colors hover:bg-white/5 hover:text-white",
            collapsed ? "justify-center" : "px-3"
          )}
        >
          <WhatsappLogo size={19} className="shrink-0 text-[#25D366]" weight="fill" />
          {!collapsed && <span className="whitespace-nowrap">{WHATSAPP_COMMUNITY_LABEL}</span>}
        </a>

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
        {/* Top bar (mobile/tablet only — hamburger, logo, search, profile; the
            full nav and stats live in the drawer, mirroring the desktop sidebar) */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-gray-200 bg-white/90 px-4 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
            aria-expanded={navOpen}
            className="-ml-1 grid size-8 shrink-0 place-items-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100 hover:text-ink"
          >
            <List size={20} />
          </button>
          <Link href="/home" aria-label="Green Mentor Pro home" className="mr-1 flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-teal-900 text-green-500">
              <Leaf size={15} weight="fill" />
            </span>
            <span className="flex items-center gap-1.5">
              <Logo bare variant="light" className="block h-4" />
              <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink/70">
                Pro
              </span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="hidden md:flex flex-1 max-w-md items-center gap-2 rounded-pill border border-gray-200 bg-gray-50 px-3.5 py-1.5 text-[13px] text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <MagnifyingGlass size={15} className="shrink-0" />
            Search courses, jobs, webinars…
          </button>
          <div className="ml-auto flex items-center gap-2">
            {/* Below md the bar above is hidden, so phones get their own
                affordance rather than no search at all. */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
              className="grid size-8 shrink-0 place-items-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-ink md:hidden"
            >
              <MagnifyingGlass size={17} />
            </button>
            {viewer ? (
              <Link
                href="/profile"
                aria-label="Green Learning Profile"
                className="flex shrink-0 items-center gap-2 rounded-pill p-1 transition-colors hover:bg-gray-100 md:pr-3"
              >
                <Avatar
                  src={viewer.avatarUrl ?? undefined}
                  name={viewer.name}
                  size={28}
                  className="shrink-0 ring-2 ring-green-500/60"
                />
                <span className="hidden max-w-32 truncate text-[12.5px] font-semibold text-ink md:block">
                  {viewer.name}
                </span>
              </Link>
            ) : (
              <Link
                href="/login"
                aria-label="Sign in"
                className="grid size-8 shrink-0 place-items-center rounded-full bg-green-50 text-green-700 transition-colors hover:bg-green-100"
              >
                <SignIn size={16} weight="bold" />
              </Link>
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

      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
      {navOpen && <MobileNavDrawer stats={stats} viewer={viewer} onClose={() => setNavOpen(false)} />}
    </div>
  );
}
