"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/marketing-ui/Button";
import { Logo, SubBrand } from "@/components/marketing/Logo";
import { track } from "@/lib/utils/analytics";
import { FeedCard } from "@/app/(app)/feed/feed-card";
import { CourseCard } from "@/components/academy/course-card";
import { JobCard } from "@/components/jobs/jobs-board";
import { CYCLE_SIZE, type LandingSamples } from "@/lib/marketing/landing-samples";
import { VerticalCycler } from "./VerticalCycler";
import {
  ChatWelcomePreview,
  CourseCardPreview,
  FeedCardPreview,
  JobCardPreview,
} from "./slide-cards";

/**
 * Single-fold carousel landing for Green Mentor Pro.
 *
 * Four slides — Feed, Academy, AI Hub, Jobs — each a headline, one line of
 * subtitle and one real product card. The whole thing is exactly one viewport
 * tall: the slide area is the only thing that flexes, and it scrolls internally
 * rather than pushing the header or the control bar off-screen on short windows.
 *
 * Each slide's card is the real in-app component fed with real content
 * (`samples`, read on the server); a slide whose sample is missing falls back
 * to the static replica in slide-cards.tsx so the page never shows a hole.
 * The feed and jobs slides carry several rows and cycle through them
 * vertically while that slide is the active one.
 *
 * One component covers both layouts from the design bundle. Below `md` it is
 * the 390px file — eyebrow label, stacked card, bar indicators, swipe. At `md`
 * and up it is the desktop file — copy and card side by side, a numbered tab
 * strip, and the Backed-by lockup on the right.
 */

type SlideCardProps = { samples: LandingSamples; active: boolean };

/** Cadence of the feed / jobs card cycler, and how many cards it holds — the
 *  slide dwells long enough for one full pass (CYCLE_SIZE × CYCLE_MS). */
const CYCLE_MS = 3000;

const SLIDES = [
  {
    id: "feed",
    label: "Feed",
    lead: "ESG news, ",
    accent: "read in a minute.",
    sub: "Regulation, climate and reporting updates in one open feed. Free to read, no account needed.",
    subShort: "Regulation, climate and reporting updates in one open feed. Free to read.",
    seconds: (CYCLE_SIZE * CYCLE_MS) / 1000,
    Card: ({ samples, active }: SlideCardProps) =>
      samples.articles.length ? (
        <VerticalCycler
          items={samples.articles}
          keyOf={(a) => a.id}
          render={(a) => <FeedCard article={a} />}
          active={active}
          intervalMs={CYCLE_MS}
        />
      ) : (
        <FeedCardPreview />
      ),
  },
  {
    id: "academy",
    label: "Academy",
    lead: "Short lessons, ",
    accent: "real credentials.",
    sub: "Bite-sized ESG courses with a quick check after every module. The Fundamental track is free.",
    subShort: "Bite-sized ESG courses with a check after every module. The Fundamental track is free.",
    Card: ({ samples }: SlideCardProps) =>
      samples.course ? <CourseCard {...samples.course} /> : <CourseCardPreview />,
  },
  {
    id: "ai-hub",
    label: "AI Hub",
    lead: "An ESG copilot ",
    accent: "that does the work.",
    sub: "Ask ESG Buddy anything, or run a skill: extract a bill, scope an engagement, draft a data request.",
    subShort: "Ask ESG Buddy anything, or run a skill: extract a bill, scope an engagement.",
    Card: () => <ChatWelcomePreview />,
  },
  {
    id: "jobs",
    label: "Jobs",
    lead: "ESG roles, ",
    accent: "matched to the profile.",
    sub: "Curated roles across India, the GCC and beyond. Filter by country and level, then apply directly.",
    subShort: "Curated roles across India, the GCC and beyond. Apply directly.",
    seconds: (CYCLE_SIZE * CYCLE_MS) / 1000,
    Card: ({ samples, active }: SlideCardProps) =>
      samples.jobs.length ? (
        <VerticalCycler
          items={samples.jobs}
          keyOf={(j) => j.id}
          render={(j) => <JobCard job={j} />}
          active={active}
          intervalMs={CYCLE_MS}
        />
      ) : (
        <JobCardPreview />
      ),
  },
] as const;

const COUNT = SLIDES.length;

/** Where the nav links point — the four app surfaces the slides are about. */
const NAV_LINKS = [
  { href: "/feed", label: "Feed" },
  { href: "/academy", label: "Academy" },
  { href: "/ai-hub", label: "AI Hub" },
  { href: "/jobs", label: "Jobs" },
] as const;

/** Horizontal distance, in px, that counts as a swipe rather than a tap. */
const SWIPE_THRESHOLD = 45;

export function ProCarousel({
  ctaHref,
  samples,
  slideSeconds = 9,
}: {
  /** Resolved server-side so a signed-in visitor lands in the app, not /login. */
  ctaHref: string;
  /** Real content for the product cards; see lib/marketing/landing-samples.ts. */
  samples: LandingSamples;
  /** Default dwell per slide; a slide with its own `seconds` overrides it. */
  slideSeconds?: number;
}) {
  const [index, setIndex] = useState(0);
  /** Manual navigation stops the rotation — a reader who steers shouldn't be
   *  yanked to the next slide mid-sentence. */
  const [paused, setPaused] = useState(false);
  /** Autoplay and the animated progress bar are client-only: rendering them on
   *  the server would either mismatch on hydration or start the timeline before
   *  the page is interactive. */
  const [playing, setPlaying] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const go = useCallback((n: number) => {
    setPaused(true);
    setIndex(((n % COUNT) + COUNT) % COUNT);
  }, []);

  // Respect prefers-reduced-motion by never auto-advancing: the progress bar
  // becomes a plain "slide N of 4" fill and the visitor drives.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setPlaying(!mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const dwellSeconds = ("seconds" in SLIDES[index] ? SLIDES[index].seconds : undefined) ?? slideSeconds;

  useEffect(() => {
    if (!playing || paused) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % COUNT), dwellSeconds * 1000);
    return () => clearTimeout(t);
  }, [playing, paused, index, dwellSeconds]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") go(index + 1);
      if (e.key === "ArrowLeft") go(index - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index]);

  const autoplaying = playing && !paused;

  return (
    <div className="relative flex h-dvh min-h-[560px] flex-col overflow-hidden bg-teal-900 text-white font-[family-name:var(--font-manrope)]">
      {/* Animated color-blend background — the Aura embed running full-bleed
          behind the whole fold, carried over from the previous landing page's
          hero. Decorative only: muted opacity, no pointer events, and hidden
          from assistive tech. `bg-teal-900` on the wrapper is what shows while
          the embed loads (and if it never does). */}
      <iframe
        title="Green Background – Vibrant & Abstract Website Header Design"
        src="https://aura.promad.design/embed/green-background-vibrant-abstract-website-header-design?hideText=true"
        aria-hidden
        tabIndex={-1}
        loading="eager"
        className="pointer-events-none absolute inset-0 z-0 h-full w-full border-0 opacity-60"
      />

      {/* Wordmark device — the deck's giant outlined lockup, color-dodged so it
          picks up the neon tone against the aura. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/wordmark-outline.svg"
        alt=""
        aria-hidden
        className="pointer-events-none absolute bottom-[6%] left-1/2 z-0 h-[34vh] w-auto max-w-none -translate-x-1/2 opacity-35 md:bottom-[-2%] md:h-[min(42vw,400px)] md:opacity-40"
        style={{ mixBlendMode: "color-dodge" }}
      />

      <header className="relative z-30 px-[18px] py-3.5 md:px-[clamp(16px,3vw,40px)] md:pt-5 md:pb-0">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 md:min-h-16 md:flex-wrap md:gap-4 md:rounded-pill md:border md:border-white/[0.12] md:bg-white/[0.06] md:px-6 md:py-3 md:backdrop-blur-[18px]">
          <div className="flex items-center gap-2.5 md:gap-3">
            <Logo variant="dark" className="h-[18px] md:h-[22px]" />
            <span className="hidden h-[18px] w-px bg-white/20 md:block" aria-hidden />
            <SubBrand label="Pro" tone="accent" className="text-[14px] md:text-[17px]" />
          </div>

          <nav aria-label="Primary" className="hidden items-center gap-[clamp(14px,2vw,28px)] md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[14px] font-medium text-white/80 transition-colors hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <Button
            asChild
            variant="accent"
            size="sm"
            className="h-11 rounded-full px-[18px] text-[14px] md:h-[42px] md:px-[22px]"
          >
            <Link
              href={ctaHref}
              onClick={() => track("cta_clicked", { location: "pro_carousel_nav" })}
            >
              <span className="md:hidden">Sign up</span>
              <span className="hidden md:inline">Create account</span>
            </Link>
          </Button>
        </div>
      </header>

      {/* Slide area — the only flexible band. `overflow-y-auto` is what keeps a
          short window (or a phone in landscape) scrolling the slide instead of
          clipping the card. */}
      <div
        className="relative z-10 flex min-h-0 flex-1 items-center overflow-hidden"
        role="region"
        aria-roledescription="carousel"
        aria-label="Green Mentor Pro platform"
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          const start = touchStartX.current;
          touchStartX.current = null;
          if (start === null) return;
          const dx = e.changedTouches[0].clientX - start;
          if (Math.abs(dx) > SWIPE_THRESHOLD) go(index + (dx < 0 ? 1 : -1));
        }}
      >
        <div className="max-h-full w-full overflow-x-hidden overflow-y-auto [scrollbar-width:thin]">
          <div
            className="flex w-[400%] transition-transform duration-[560ms] ease-[var(--ease-gm)] md:duration-[620ms]"
            style={{ transform: `translateX(-${index * 25}%)` }}
          >
            {SLIDES.map((slide, i) => (
              <section
                key={slide.id}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${COUNT}: ${slide.label}`}
                aria-hidden={i !== index}
                className="w-[25%] shrink-0 px-[18px] pt-2 pb-1 md:px-[clamp(20px,4vw,64px)] md:pb-0"
              >
                {/* The stacked layout is drawn for a 390px phone; without a cap
                    it sprawls across the 520–767px band, where the card is still
                    a single column. Small phones never reach the cap. */}
                {/* Frosted panel behind the whole slide — copy and product
                    card together: the aura's bright lobes drift under both,
                    and white-on-neon-green is unreadable without a little
                    separation. */}
                <div className="mx-auto flex max-w-[520px] flex-wrap items-center gap-5 rounded-2xl border border-white/15 bg-white/10 p-5 shadow-[0_8px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl md:max-w-[1240px] md:gap-[clamp(24px,4vw,56px)] md:p-[clamp(24px,3vw,40px)]">
                  <div className="min-w-full md:min-w-[min(100%,300px)] md:shrink md:grow md:basis-[340px]">
                    <p className="text-[11px] tracking-[0.11em] text-green-500 uppercase md:hidden">
                      {slide.label}
                    </p>
                    <h2 className="font-display mt-2.5 text-[30px] leading-[1.1] text-white md:mt-0 md:text-[clamp(30px,3.4vw,52px)] md:leading-[1.06]">
                      {slide.lead}
                      <span className="text-green-500">{slide.accent}</span>
                    </h2>
                    <p className="mt-2.5 max-w-[560px] text-[15px] leading-[1.5] text-white/80 md:mt-3.5 md:text-[clamp(15px,1.3vw,18px)] md:leading-[1.55]">
                      <span className="md:hidden">{slide.subShort}</span>
                      <span className="hidden md:inline">{slide.sub}</span>
                    </p>
                  </div>

                  <div className="min-w-full md:min-w-[min(100%,300px)] md:shrink md:grow-0 md:basis-[440px]">
                    <slide.Card samples={samples} active={i === index} />
                  </div>
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>

      {/* Control bar. The blurred teal scrim is what keeps the wordmark from
          reading through the tabs, progress line and partner logos. */}
      <div
        className="relative z-30 px-[18px] py-[18px] backdrop-blur-[10px] md:px-[clamp(16px,3vw,40px)] md:pt-2 md:pb-[18px]"
        style={{
          background:
            "linear-gradient(to bottom, rgba(1,74,80,0) 0%, rgba(1,74,80,0.72) 31%, rgba(1,74,80,0.92) 100%)",
        }}
      >
        <div className="mx-auto max-w-[1400px]">
          <div className="h-0.5 overflow-hidden bg-white/[0.12]">
            <div
              // Restarting the fill on every slide change needs a fresh element,
              // hence the key — a CSS animation won't replay on a style swap.
              key={`${index}-${autoplaying}`}
              className={cn(
                "h-0.5 w-full origin-left bg-green-500",
                autoplaying && "gm-carousel-progress",
              )}
              style={
                autoplaying
                  ? { animationDuration: `${dwellSeconds}s` }
                  : { transform: `scaleX(${(index + 1) / COUNT})` }
              }
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3.5 pt-3.5 md:gap-4 md:pt-4">
            <div className="flex flex-wrap items-center gap-3.5 md:gap-1.5">
              {/* Phone: bar indicators, each with a 44px touch target. */}
              <div className="flex items-center gap-2.5 md:hidden">
                {SLIDES.map((slide, i) => (
                  <button
                    key={slide.id}
                    type="button"
                    aria-label={`Go to ${slide.label}`}
                    aria-current={i === index}
                    onClick={() => go(i)}
                    className="grid h-11 w-[26px] place-items-center"
                  >
                    <span
                      className={cn(
                        "block h-1 w-[22px] rounded-pill transition-colors",
                        i === index ? "bg-green-500" : "bg-white/[0.28]",
                      )}
                    />
                  </button>
                ))}
              </div>

              {/* Desktop: numbered tab strip. */}
              <div className="hidden items-center gap-1.5 md:flex">
                {SLIDES.map((slide, i) => (
                  <button
                    key={slide.id}
                    type="button"
                    aria-current={i === index}
                    onClick={() => go(i)}
                    className={cn(
                      "flex items-baseline gap-2 rounded-pill px-3.5 py-2 text-[13px] font-semibold whitespace-nowrap transition-colors hover:bg-white/[0.07]",
                      i === index ? "text-green-500" : "text-white/50",
                    )}
                  >
                    <span className="text-[11px] opacity-70">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {slide.label}
                  </button>
                ))}
                <span className="mx-1.5 block h-5 w-px bg-white/[0.18]" aria-hidden />
              </div>

              <div className="flex items-center gap-2 md:gap-1.5">
                <button
                  type="button"
                  aria-label="Previous slide"
                  onClick={() => go(index - 1)}
                  className="grid size-11 place-items-center rounded-full border border-white/25 text-white transition-colors hover:border-green-500 hover:text-green-500 md:size-[42px]"
                >
                  <ArrowLeft size={16} />
                </button>
                <button
                  type="button"
                  aria-label="Next slide"
                  onClick={() => go(index + 1)}
                  className="grid size-11 place-items-center rounded-full border border-white/25 text-white transition-colors hover:border-green-500 hover:text-green-500 md:size-[42px]"
                >
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>

            {/* Wraps onto its own line on a phone; sits opposite the tabs at md. */}
            <div className="flex w-full items-center gap-3 md:w-auto md:gap-3.5">
              <span className="text-[10px] tracking-[0.11em] whitespace-nowrap text-green-100/70 uppercase md:text-[11px]">
                Backed by
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/partner-iimb-nsrcel.png"
                alt="IIMB · NSRCEL"
                className="h-5 w-auto object-contain opacity-85 brightness-0 invert md:h-[26px]"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/partner-iitb.png"
                alt="IIT-B Innovation Centre"
                className="h-5 w-auto object-contain opacity-85 brightness-0 invert md:h-[26px]"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
