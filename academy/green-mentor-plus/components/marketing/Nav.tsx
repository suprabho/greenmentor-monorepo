"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { List, X } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/marketing/Container";
import { Logo, SubBrand } from "@/components/marketing/Logo";
import { primaryNav } from "@/lib/data/nav";

export function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-[background-color,border-color,backdrop-filter] duration-200",
        scrolled
          ? "border-gray-200 bg-white/90 backdrop-blur"
          : "border-transparent bg-white",
      )}
    >
      <Container width="wide">
        <div className="flex h-[72px] items-center justify-between gap-6 md:h-20">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="hidden h-5 w-px bg-gray-200 md:block" aria-hidden />
            <SubBrand className="hidden md:inline" />
          </div>

          <nav
            aria-label="Primary"
            className="hidden items-center gap-8 md:flex"
          >
            {primaryNav.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "text-[15px] font-medium transition-colors",
                  pathname === link.href
                    ? "text-green-700"
                    : "text-gray-700 hover:text-green-700",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <Button asChild variant="ghost-light" size="sm">
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild variant="primary" size="md">
              <Link href="/onboarding/intro">Get Started</Link>
            </Button>
          </div>

          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="grid size-11 place-items-center rounded-full border border-gray-200 bg-white text-ink md:hidden"
          >
            {open ? <X size={20} weight="bold" /> : <List size={20} weight="bold" />}
          </button>
        </div>
      </Container>

      {open ? (
        <div className="border-t border-gray-200 bg-white md:hidden">
          <Container width="wide">
            <nav className="grid gap-1 py-4" aria-label="Mobile">
              {primaryNav.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "rounded-lg px-3 py-3 text-[16px] font-medium",
                    pathname === link.href
                      ? "bg-green-100 text-green-700"
                      : "text-ink hover:bg-gray-50",
                  )}
                >
                  {link.label}
                </Link>
              ))}
              <div className="mt-3 grid gap-2 border-t border-gray-200 pt-4">
                <Button asChild variant="outline" size="md">
                  <Link href="/login">Log in</Link>
                </Button>
                <Button asChild variant="primary" size="md">
                  <Link href="/onboarding/intro">Get Started</Link>
                </Button>
              </div>
            </nav>
          </Container>
        </div>
      ) : null}
    </header>
  );
}
