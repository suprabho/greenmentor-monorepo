"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CaretDown, ImageSquare, Leaf, SignOut } from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { clsx } from "clsx";
import { ADMIN_SECTIONS } from "@/lib/admin/sections";

interface ToolLink {
  href: string;
  name: string;
  icon: Icon;
  /** Only shown to allowlisted admins (the section pages are admin-gated). */
  adminOnly: boolean;
  soon: boolean;
}

/**
 * Every maker tool in one flat list. The single "Tools" dropdown here is the
 * only tool navigation — pages don't carry their own tab strips.
 */
const TOOLS: ToolLink[] = [
  { href: "/header-studio", name: "Aura Header", icon: ImageSquare, adminOnly: false, soon: false },
  ...ADMIN_SECTIONS.map((s) => ({
    href: s.href,
    name: s.name,
    icon: s.icon,
    adminOnly: true,
    soon: s.status === "soon",
  })),
];

const isUnder = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

const navLinkCls = (active: boolean) =>
  clsx(
    "rounded-pill px-3 py-1.5 transition-colors",
    active ? "bg-teal-900 text-white" : "text-gray-600 hover:bg-gray-100 hover:text-ink"
  );

/** Top navigation shown on every signed-in page (hidden on /login). */
export function SiteHeader({ email, isAdmin = false }: { email: string; isAdmin?: boolean }) {
  const pathname = usePathname() ?? "";
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsRef = useRef<HTMLDivElement | null>(null);

  const tools = TOOLS.filter((t) => isAdmin || !t.adminOnly);
  const toolsActive = tools.some((t) => !t.soon && isUnder(pathname, t.href));

  // Close the dropdown on navigation, outside click, or Escape.
  useEffect(() => setToolsOpen(false), [pathname]);
  useEffect(() => {
    if (!toolsOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) setToolsOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setToolsOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [toolsOpen]);

  return (
    <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 items-center gap-4 px-5 xl:max-w-6xl">
        <Link href={isAdmin ? "/" : "/library"} className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-[9px] bg-teal-900 text-green-500">
            <Leaf size={17} weight="fill" />
          </span>
          <span className="text-[14px] font-semibold tracking-tight text-ink">Community</span>
        </Link>
        <nav className="flex items-center gap-1 text-[13px] font-medium">
          {isAdmin && (
            <Link href="/" className={navLinkCls(pathname === "/")}>
              Home
            </Link>
          )}
          <Link href="/library" className={navLinkCls(isUnder(pathname, "/library"))}>
            Library
          </Link>
          <div ref={toolsRef} className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={toolsOpen}
              onClick={() => setToolsOpen((o) => !o)}
              className={clsx(navLinkCls(toolsActive), "flex items-center gap-1")}
            >
              Tools
              <CaretDown
                size={11}
                weight="bold"
                className={clsx("transition-transform", toolsOpen && "rotate-180")}
              />
            </button>
            {toolsOpen && (
              <div
                role="menu"
                className="absolute left-0 top-full mt-2 w-60 rounded-[14px] border border-gray-200 bg-white p-1.5 shadow-lift"
              >
                {tools.map((t) =>
                  t.soon ? (
                    <span
                      key={t.href}
                      title="Coming soon"
                      className="flex cursor-not-allowed items-center gap-2.5 rounded-[10px] px-3 py-2 text-gray-400"
                    >
                      <t.icon size={16} />
                      {t.name}
                      <span className="ml-auto rounded-pill bg-gray-100 px-2 py-0.5 text-[10.5px] font-semibold text-gray-500">
                        Soon
                      </span>
                    </span>
                  ) : (
                    <Link
                      key={t.href}
                      href={t.href}
                      role="menuitem"
                      className={clsx(
                        "flex items-center gap-2.5 rounded-[10px] px-3 py-2 transition-colors",
                        isUnder(pathname, t.href)
                          ? "bg-green-50 text-green-700"
                          : "text-gray-700 hover:bg-gray-100 hover:text-ink"
                      )}
                    >
                      <t.icon size={16} />
                      {t.name}
                    </Link>
                  )
                )}
              </div>
            )}
          </div>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          {email && (
            <span className="hidden text-[12.5px] text-gray-600 sm:block">{email}</span>
          )}
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-pill border border-gray-200 px-3 py-1.5 text-[12.5px] font-semibold text-gray-700 transition-colors hover:bg-gray-100"
            >
              <SignOut size={14} /> Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
