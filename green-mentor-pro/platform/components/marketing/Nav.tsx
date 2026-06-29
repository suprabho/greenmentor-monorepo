"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { List, X } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/marketing-ui/Button";
import { Container } from "@/components/marketing/Container";
import { Logo, SubBrand } from "@/components/marketing/Logo";
import { useCtaHref } from "@/components/marketing/MarketingAuthProvider";
import { primaryNav } from "@/lib/data/nav";
import { track } from "@/lib/utils/analytics";

export function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const ctaHref = useCtaHref();

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
        "sticky top-8 mx-auto border-gray-200 z-40 border-b transition-[background-color,border-color,backdrop-filter] duration-200 rounded-full",
        scrolled
          ? "bg-white/90 backdrop-blur"
          : "bg-white/10 backdrop-blur-xl",
      )}
    >
      <Container width="wide">
        <div className="flex h-[72px] items-center justify-between gap-6 md:h-20">
          <div className="flex items-center gap-3">
            <Logo
              variant={scrolled ? "light" : "dark"}
              className="transition-colors"
            />
            <span className="block h-5 w-px bg-gray-200" aria-hidden />
            <SubBrand />
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
                  scrolled
                    ? pathname === link.href
                      ? "text-green-700"
                      : "text-gray-700 hover:text-green-700"
                    : pathname === link.href
                      ? "text-green-200"
                      : "text-white/80 hover:text-white",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <Button asChild variant="ghost-dark" className="rounded-full" size="md">
              <Link
                href={ctaHref}
                onClick={() =>
                  track("cta_clicked", { location: "nav_desktop" })
                }
              >
                Get Started
              </Link>
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
                <Button asChild variant="primary" size="md">
                  <Link
                    href={ctaHref}
                    onClick={() =>
                      track("cta_clicked", { location: "nav_mobile" })
                    }
                  >
                    Get Started
                  </Link>
                </Button>
              </div>
            </nav>
          </Container>
        </div>
      ) : null}
    </header>
  );
}
