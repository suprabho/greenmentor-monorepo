"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Leaf } from "@phosphor-icons/react/dist/ssr";
import { Container } from "@/components/marketing/Container";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Badge";
import { heroStats } from "@/lib/data/hero-stats";
import { instructorCompanies } from "@/lib/data/instructors";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-teal-900 text-white">
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

      <Container width="wide" className="relative z-10 pt-16 pb-20 md:pt-24 md:pb-28">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
          className="max-w-5xl"
        >
          <Eyebrow tone="teal">
            <Leaf size={14} weight="fill" className="inline -mt-0.5 mr-1.5" />
            Greenmentor Plus
          </Eyebrow>

          <h1 className="font-display mt-8 text-[clamp(44px,7.5vw,88px)] leading-[1.05] tracking-[-0.02em] text-white">
            The only subscription you need to{" "}
            <span className="text-green-500">master anything in ESG.</span>
          </h1>

          <p className="mt-8 max-w-2xl text-[20px] leading-relaxed text-white/85 md:text-[22px]">
            Courses, live expert sessions, career tools, and a community of
            40,000+ sustainability professionals — all in one place, for one
            simple price.
          </p>

          <div className="mt-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Button
              asChild
              variant="accent"
              size="lg"
              iconRight={<ArrowRight size={18} weight="bold" />}
            >
              <Link href="/onboarding/intro">Start for ₹4,000 / month</Link>
            </Button>
            <Button asChild variant="ghost-dark" size="lg">
              <Link href="/pricing">Annual plan · ₹44,000 / year</Link>
            </Button>
          </div>
        </motion.div>

        {/* Stat band — four credibility numbers inline, then the instructor
            pill row underneath. Matches the v3 HTML's "credibility upfront"
            shape so the hero doesn't read as a pure pitch. */}
        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {heroStats.map((stat) => (
            <div key={stat.caption}>
              <div className="font-numeral text-[44px] leading-none text-white md:text-[52px]">
                {stat.number}
              </div>
              <div className="mt-2 text-[14px] text-green-100">
                {stat.caption}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-[18px] border border-white/10 bg-teal-800/40 p-5 md:p-6">
          <p className="gm-eyebrow text-green-100">
            Instructors with experience at
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {instructorCompanies.map((co) => (
              <span
                key={co}
                className="rounded-full bg-green-100 px-3 py-1 text-[12px] font-semibold text-teal-900"
              >
                {co}
              </span>
            ))}
          </div>
        </div>
      </Container>

      {/* Backed-by row — anchored to right of hero on desktop */}
      <div className="relative z-10 border-t border-white/10 bg-teal-900/80">
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
