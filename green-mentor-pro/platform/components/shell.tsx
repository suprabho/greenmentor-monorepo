"use client";

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

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/feed" ? pathname === "/feed" : pathname.startsWith(href);

  return (
    <div className="min-h-screen lg:flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-60 shrink-0 flex-col bg-teal-900 text-white sticky top-0 h-screen">
        <Link href="/feed" className="flex items-center gap-2.5 px-5 pt-6 pb-7">
          <span className="grid size-9 place-items-center rounded-[6px] bg-green-500 text-teal-900">
            <Leaf size={20} weight="fill" />
          </span>
          <span className="leading-tight">
            <span className="block text-[15px] font-semibold tracking-tight">Green Mentor</span>
            <span className="block text-[11px] font-medium uppercase tracking-[0.18em] text-green-500">Pro</span>
          </span>
        </Link>

        <nav className="flex-1 space-y-0.5 px-3">
          {nav.map((item) => (
            <div key={item.href}>
              <Link
                href={item.href}
                className={clsx(
                  "flex items-center gap-3 rounded-[6px] px-3 py-2.5 text-[13.5px] font-medium transition-colors",
                  isActive(item.href) && !item.children.some((c) => pathname.startsWith(c.href))
                    ? "bg-white/10 text-white"
                    : "text-white/65 hover:bg-white/5 hover:text-white"
                )}
              >
                <item.icon size={19} weight={isActive(item.href) ? "fill" : "regular"} />
                {item.label}
              </Link>
              {item.children.length > 0 && pathname.startsWith("/feed") && (
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

        <Link
          href="/profile"
          className={clsx(
            "m-3 flex items-center gap-3 rounded-xl p-3 transition-colors",
            pathname.startsWith("/profile") ? "bg-white/10" : "bg-white/5 hover:bg-white/10"
          )}
        >
          <Avatar src={me.avatar} name={me.name} size={36} className="ring-2 ring-green-500/60" />
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-semibold">Supro</span>
            <span className="block text-[11px] text-green-100/70">Green Learning Profile</span>
          </span>
        </Link>
      </aside>

      {/* Main column */}
      <div className="min-w-0 flex-1">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-gray-200 bg-white/90 px-4 backdrop-blur lg:px-8">
          <Link href="/feed" className="lg:hidden flex items-center gap-2 mr-1">
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
              <Lightning size={13} weight="fill" /> 2,840 XP
            </span>
            <span className="flex items-center gap-1.5 rounded-pill bg-[#FFF4E0] px-2.5 py-1 text-[12px] font-semibold text-[#B25E00]">
              <Fire size={13} weight="fill" /> 9-day
            </span>
            <span className="hidden sm:flex items-center gap-1.5 rounded-pill bg-gray-100 px-2.5 py-1 text-[12px] font-semibold text-gray-800">
              <Coins size={13} weight="fill" /> 1,450 cr
            </span>
          </div>
        </header>

        <main className="px-4 py-6 pb-24 lg:px-8 lg:pb-10">{children}</main>

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
