import Link from "next/link";
import { Container } from "@/components/marketing/Container";
import { Logo } from "@/components/marketing/Logo";
import { footerSections } from "@/lib/data/nav";

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-teal-900 text-white">
      {/* Outlined wordmark device — the deck's signature footer motif */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center opacity-[0.18] mix-blend-screen"
        style={{ height: "180px" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/wordmark-outline.svg"
          alt=""
          className="h-full w-auto max-w-none"
        />
      </div>

      <Container width="wide" className="relative py-20">
        <div className="grid gap-12 md:grid-cols-4">
          <div className="md:col-span-1">
            <Logo variant="dark" />
            <p className="mt-5 max-w-xs text-[15px] leading-relaxed text-white/80">
              Community-led ESG learning and compliance — built with practitioners,
              backed by IIMB (NSRCEL) and IIT-B Innovation Centre.
            </p>
          </div>

          {footerSections.map((section) => (
            <div key={section.title}>
              <h4 className="gm-eyebrow text-green-100">{section.title}</h4>
              <ul className="mt-5 space-y-3">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-[15px] text-white/80 transition-colors hover:text-green-500"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col gap-4 border-t border-white/15 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-white/60">
            © {new Date().getFullYear()} Greenmentor. All rights reserved.
          </p>
          <p className="text-[13px] text-white/60">
            help@greenmentor.co · Courses delivered via Learnyst
          </p>
        </div>
      </Container>
    </footer>
  );
}
