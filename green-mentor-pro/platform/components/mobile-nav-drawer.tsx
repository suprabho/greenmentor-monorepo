"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Coins, Fire, Leaf, Lightning, SignIn, WhatsappLogo, X } from "@phosphor-icons/react";
import { clsx } from "clsx";
import { Avatar } from "@/components/ui";
import { Logo } from "@/components/marketing/Logo";
import { MobileDrawer } from "@/components/mobile-drawer";
import type { ShellStats, ShellViewer } from "@/components/shell";
import { NAV_GROUPS } from "@/lib/app-nav";
import { WHATSAPP_COMMUNITY_LABEL, WHATSAPP_COMMUNITY_URL } from "@/lib/data/community";
import { track } from "@/lib/utils/analytics";

/**
 * The hamburger drawer: the desktop sidebar's content (nav groups, WhatsApp,
 * stats, profile) as a sub-lg overlay. Every link closes the drawer on tap —
 * navigating to the current route never fires a pathname effect, so the Shell's
 * close-on-route-change alone would leave it hanging open.
 */
export function MobileNavDrawer({
  stats,
  viewer,
  onClose,
}: {
  stats?: ShellStats;
  viewer?: ShellViewer;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const statPills = stats
    ? [
        { label: `${stats.xp.toLocaleString()} XP`, icon: Lightning, iconClass: "text-green-400" },
        { label: `${stats.streakDays}-day`, icon: Fire, iconClass: "text-orange-400" },
        { label: `${stats.coins.toLocaleString()} cr`, icon: Coins, iconClass: "text-white/70" },
      ]
    : [];

  return (
    <MobileDrawer label="Navigation" onClose={onClose} panelClassName="bg-teal-900 text-white">
      <div className="flex items-center justify-between pt-6 pb-4 pl-5 pr-3">
        <Link href="/home" onClick={onClose} aria-label="Green Mentor Pro home" className="flex items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-[6px] bg-green-500 text-teal-900">
            <Leaf size={20} weight="fill" />
          </span>
          <span className="leading-tight whitespace-nowrap">
            <Logo bare variant="dark" className="block h-5" />
            <span className="mt-0.5 block text-[11px] font-medium uppercase tracking-[0.18em] text-green-500">
              Pro
            </span>
          </span>
        </Link>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close navigation"
          className="grid size-8 shrink-0 place-items-center rounded-lg text-white/55 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.heading ?? "top"}>
            {group.heading !== null && (
              <p className="px-3 pt-4 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/35">
                {group.heading}
              </p>
            )}
            {group.items.map((item) => (
              <div key={item.href}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={clsx(
                    "flex items-center gap-3 rounded-[6px] px-3 py-2.5 text-[13.5px] font-medium transition-colors",
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
                  <span className="whitespace-nowrap">{item.label}</span>
                </Link>
                {item.children.length > 0 && pathname.startsWith(item.href) && (
                  <div className="ml-4 mt-0.5 space-y-0.5 border-l border-white/10 pl-3">
                    {item.children.map((c) => (
                      <Link
                        key={c.href}
                        href={c.href}
                        onClick={onClose}
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

      <a
        href={WHATSAPP_COMMUNITY_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          track("whatsapp_community_clicked");
          onClose();
        }}
        className="mx-3 mt-3 flex items-center gap-3 rounded-[6px] px-3 py-2.5 text-[13.5px] font-medium text-white/65 transition-colors hover:bg-white/5 hover:text-white"
      >
        <WhatsappLogo size={19} className="shrink-0 text-[#25D366]" weight="fill" />
        <span className="whitespace-nowrap">{WHATSAPP_COMMUNITY_LABEL}</span>
      </a>

      {statPills.length > 0 && (
        <div className="mx-3 mt-3 flex flex-wrap gap-1.5">
          {statPills.map((s) => (
            <span
              key={s.label}
              title={s.label}
              className="flex items-center gap-1.5 rounded-pill bg-white/10 px-2.5 py-1 text-[12px] font-semibold text-white/90"
            >
              <s.icon size={13} weight="fill" className={clsx("shrink-0", s.iconClass)} />
              {s.label}
            </span>
          ))}
        </div>
      )}

      {viewer ? (
        <Link
          href="/profile"
          onClick={onClose}
          className={clsx(
            "m-3 flex items-center gap-3 rounded-xl p-3 transition-colors",
            pathname.startsWith("/profile") ? "bg-white/10" : "bg-white/5 hover:bg-white/10"
          )}
        >
          <Avatar
            src={viewer.avatarUrl ?? undefined}
            name={viewer.name}
            size={36}
            className="shrink-0 ring-2 ring-green-500/60"
          />
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-semibold">{viewer.name}</span>
            <span className="block text-[11px] text-green-100/70">Green Learning Profile</span>
          </span>
        </Link>
      ) : (
        <Link
          href="/login"
          onClick={onClose}
          className="m-3 flex items-center gap-3 rounded-xl bg-white/5 p-3 transition-colors hover:bg-white/10"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/10 text-green-400">
            <SignIn size={18} weight="bold" />
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold">Sign in</span>
            <span className="block text-[11px] text-green-100/70">Track XP, streaks &amp; credits</span>
          </span>
        </Link>
      )}
    </MobileDrawer>
  );
}
