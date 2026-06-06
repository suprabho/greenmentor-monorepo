"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { Container } from "@/components/marketing/Container";
import { CountUp } from "@/components/marketing/CountUp";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import { heroStats } from "@/lib/data/hero-stats";
import { instructorCompanies } from "@/lib/data/instructors";
import { mentors } from "@/lib/data/mentors";
import { annualSavingsPercent } from "@/lib/data/plans";
import { guarantee } from "@/lib/data/guarantee";
import { track } from "@/lib/utils/analytics";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-teal-900 text-white">
      {/* Animated color-blend background — the Aura embed running full-bleed
          behind the hero. Decorative only: muted opacity, no pointer events,
          and hidden from assistive tech. */}
      <iframe
        title="Green Background – Vibrant & Abstract Website Header Design"
        src="https://aura.promad.design/embed/green-background-vibrant-abstract-website-header-design?hideText=true"
        aria-hidden
        tabIndex={-1}
        className="pointer-events-none absolute inset-0 z-0 h-full w-full border-0 object-cover opacity-60"
      />

      {/* Wordmark device — the deck's giant outlined `greenmentor` lockup,
          rendered behind body content with color-dodge so it picks up the
          neon tone against the dark teal. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-0 flex justify-center"
        style={{
          height: "min(48vw, 460px)",
          mixBlendMode: "color-dodge",
          opacity: 0.45,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/wordmark-outline.svg"
          alt=""
          className="h-full w-auto max-w-none"
        />
      </div>

      <Container width="wide" className="relative z-10 pt-6 pb-20 md:pt-42 md:pb-28">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_minmax(320px,380px)]">
          {/* Copy column — left-aligned pitch */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
            className="max-w-2xl"
          >
            <h1
              className="font-display text-left text-[clamp(44px,7.5vw,88px)] leading-[1.05] tracking-[-0.02em] text-white"
              style={{ textShadow: "0 2px 24px rgba(0, 0, 0, 0.35)" }}
            >
              The only subscription you need to{" "}
              <span className="text-green-500">master anything in ESG.</span>
            </h1>

            <p className="mt-8 max-w-2xl text-left text-[20px] leading-relaxed text-white/85 md:text-[22px]">
              8 courses. Bi-weekly live sessions with practitioners. Career
              tools. A 40,000+ member community. All included in one
              subscription, cancel anytime.
            </p>

            <div className="mt-10 flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-start">
              <Button
                asChild
                variant="accent"
                size="lg"
                className="w-full sm:w-auto rounded-full"
              >
                <Link
                  href="/onboarding/intro"
                  onClick={() =>
                    track("cta_clicked", { location: "hero", label: "start_4000" })
                  }
                >
                  Get instant @ ₹2,000 for the first month
                </Link>
              </Button>
              <Button
                asChild
                variant="ghost-dark"
                size="lg"
                className="w-full sm:w-auto rounded-full"
              >
                <Link
                  href="/#pricing"
                  onClick={() =>
                    track("cta_clicked", { location: "hero", label: "see_annual" })
                  }
                >
                  Save {annualSavingsPercent}% with Annual Plan
                </Link>
              </Button>
            </div>

            <p className="mt-4 text-left font-bold text-base text-green-100/90">
              {guarantee.short}
            </p>
          </motion.div>

          {/* Mentor ticker — auto-scrolling roster, right rail. The list is
              rendered twice for a seamless loop; the second copy is aria-hidden
              so screen readers and the tab order see each mentor once. Pauses on
              hover; collapses to a static first frame under prefers-reduced-motion. */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: [0.2, 0.7, 0.2, 1] }}
            className="w-full"
          >
            <p className="gm-eyebrow mb-3 text-green-100">Meet your mentors</p>
            <div className="relative h-[520px] overflow-hidden">
              <div className="gm-ticker-mask h-full overflow-hidden">
                <div className="gm-ticker-track py-3">
                  {[...mentors, ...mentors].map((m, i) => (
                    <div
                      key={`${m.name}-${i}`}
                      aria-hidden={i >= mentors.length}
                      className="flex items-stretch overflow-hidden rounded-[18px] border border-white/10 bg-white/[0.05] backdrop-blur-md"
                    >
                      {/* Headshot — spans the full height of the card. Falls
                          back to an initials block when no photo is set. */}
                      <div className="relative w-[136px] shrink-0 self-stretch overflow-hidden bg-teal-800">
                        {m.photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={m.photo}
                            alt={m.name}
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                        ) : (
                          <div
                            className="grid h-full w-full place-items-center bg-green-500/15 text-xl font-semibold text-green-500"
                            aria-hidden
                          >
                            {m.initials}
                          </div>
                        )}
                      </div>

                      {/* Detail */}
                      <div className="min-w-0 flex-1 p-5">
                        <p className="text-[16px] font-semibold leading-tight text-white">
                          {m.name}
                        </p>
                        <p className="mt-1 text-[13px] text-white/55">
                          {m.role}
                        </p>

                        {m.tags.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {m.tags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded-full border border-green-500/20 bg-green-500/10 px-2 py-0.5 text-[10px] text-green-100"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : null}

                        <div className="mt-3 flex items-center gap-2 text-[11px] text-green-100/80">
                          <span
                            className="size-1.5 shrink-0 rounded-full bg-green-500"
                            aria-hidden
                          />
                          <span className="truncate">
                            {m.company}
                            {m.location ? ` · ${m.location}` : ""}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Stat band — four credibility numbers inline, then the instructor
            pill row underneath. Matches the v3 HTML's "credibility upfront"
            shape so the hero doesn't read as a pure pitch. */}
        <div className="mt-16 grid gap-8 xs:grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
          {heroStats.map((stat) => (
            <div key={stat.caption}>
              <CountUp
                value={stat.number}
                className="block text-center font-numeral text-[44px] leading-none text-white md:text-[52px]"
              />
              <div className="text-center text-bold mt-2 text-[14px] text-green-100">
                {stat.caption}
              </div>
            </div>
          ))}
        </div>

        {/* TODO[assets]: confirm the real instructor employer logos in
            instructors.ts (deck names Tata, Nestlé, TUV Rheinland, EY,
            McKinsey, KPMG, Siemens) and ensure each renders crisply. */}
        <div className="mt-40 rounded-md border border-white/10 bg-teal-800/40 p-5 md:p-6 backdrop-blur-3xl">
          <p className="gm-eyebrow text-green-100">Instructors from</p>
          <div className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-5">
            {instructorCompanies.map((co) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={co.name}
                src={co.logo}
                alt={co.name}
                className={cn(
                  "h-7 w-auto object-contain opacity-90 brightness-0 invert md:h-8",
                  co.className,
                )}
              />
            ))}
          </div>
        </div>
      </Container>

      {/* Backed-by row — anchored to right of hero on desktop */}
      <div className="relative z-10 border-t border-white/10 bg-teal-900/80 backdrop-blur-xl">
        <Container width="wide">
          <div className="flex flex-col items-start justify-between gap-4 py-5 sm:flex-row sm:items-center">
            <span className="gm-eyebrow text-green-100">Backed By</span>
            <div className="flex items-center gap-8 opacity-90">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/partner-iimb-nsrcel.png"
                alt="IIMB · NSRCEL"
                className="h-8 w-auto object-contain brightness-0 invert"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/partner-iitb.png"
                alt="IIT-B Innovation Centre"
                className="h-8 w-auto object-contain brightness-0 invert"
              />
            </div>
          </div>
        </Container>
      </div>
    </section>
  );
}
