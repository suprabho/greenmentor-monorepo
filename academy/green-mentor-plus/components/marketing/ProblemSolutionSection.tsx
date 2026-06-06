"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
  type MotionValue,
  type MotionStyle,
} from "framer-motion";
import { Container } from "@/components/marketing/Container";
import { SectionHeader } from "@/components/marketing/SectionHeader";
import { painPoints, type PainPoint } from "@/lib/data/pain-points";

/**
 * "The problem → the answer" as a single scroll-driven scene. Replaces the
 * former two separate sections (ProblemSection / SolutionSection): instead of
 * scrolling past two blocks, the visitor scrolls *through* one pinned section
 * whose dark trap-grid cross-fades into the answer rows.
 *
 * Both states read from the same `painPoints` data, so the trap and its fix can
 * never drift apart. The scroll-jacked scene (<ScrollScene/>) runs on md+ with
 * motion allowed; on small screens or under prefers-reduced-motion it degrades
 * to the two states stacked normally (<StaticStack/>), with no pinning and
 * nothing hidden.
 *
 * The scene lives in its own component on purpose: framer-motion's useScroll
 * measures its target ref in a layout effect that only re-runs when the ref
 * *object* changes. Mounting <ScrollScene/> fresh (rather than toggling a ref
 * inside one component) guarantees the ref is attached on its first commit, so
 * scrollYProgress actually tracks. See use-scroll.mjs refWarning.
 */

/* ── shared presentational pieces (identical markup in both states) ── */

function ProblemHeader() {
  return (
    <SectionHeader
      label="Why most ESG learners plateau"
      title={
        <>
          Most ESG learners are stuck, not because they lack effort, but because
          they lack the <span className="text-green-700">right structure.</span>
        </>
      }
      description="Four traps that turn motivated learners into half-finished tabs."
      align="center"
      className="mx-auto"
    />
  );
}

function SolutionHeader() {
  return (
    <SectionHeader
      label="How we solve it"
      title={
        <>
          The problem, <span className="text-green-700">answered.</span>
        </>
      }
      description="Every trap above has a deliberate fix built into the membership. Not a promise, a mechanism."
      align="center"
      className="mx-auto"
    />
  );
}

/**
 * The shared icon chip — the SAME glyph, size, and position in both states.
 * Only its color differs: a fixed Tailwind tone via `className` (static cards)
 * or an animated color via `style` (the morph). The green-500 ring is constant.
 */
function IconChip({
  p,
  className,
  style,
}: {
  p: PainPoint;
  className?: string;
  style?: MotionStyle;
}) {
  const Icon = p.icon;
  return (
    <motion.div
      className={`grid size-11 place-items-center rounded-full border-[2.5px] border-green-500 ${className ?? ""}`}
      style={style}
    >
      <Icon size={20} weight="duotone" aria-hidden />
    </motion.div>
  );
}

/** Text of a dark "trap" card (the icon lives in the persistent chip above). */
function ProblemText({ p }: { p: PainPoint }) {
  return (
    <>
      <h3 className="text-[18px] font-bold leading-snug text-white">
        {p.title}
      </h3>
      <p className="mt-2 text-[15px] leading-relaxed text-green-100">
        {p.description}
      </p>
      <p className="mt-4 border-t border-white/10 pt-4 text-[13px] italic leading-relaxed text-green-100/70">
        &ldquo;{p.echo}&rdquo;
      </p>
    </>
  );
}

function ProblemGrid() {
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {painPoints.map((p) => (
        <li
          key={p.id}
          className="min-h-[320px] rounded-lg border border-gray-200 bg-linear-to-br from-green-700 to-green-900 p-7 transition-colors hover:border-green-500/60"
        >
          <IconChip p={p} className="text-green-100" />
          <div className="mt-6">
            <ProblemText p={p} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Text of a light "fix" card (the icon lives in the persistent chip above). */
function SolutionText({ p }: { p: PainPoint }) {
  return (
    <>
      <h3 className="text-[18px] font-bold leading-snug text-ink">
        {p.solutionTitle}
      </h3>
      <p className="mt-2 text-[15px] leading-relaxed text-gray-700">
        {p.solution}
      </p>
    </>
  );
}

function SolutionGrid() {
  // Same grid + same icon chip as ProblemGrid; only the chip's icon color and
  // the copy change. No problem text is restated — the shared icon is the link.
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {painPoints.map((p) => (
        <li
          key={p.id}
          className="min-h-[320px] rounded-lg border border-gray-200 bg-white p-7 transition-colors hover:border-green-500/60"
        >
          <IconChip p={p} className="text-green-700" />
          <div className="mt-6">
            <SolutionText p={p} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * One cell of the scroll-driven morph — a SINGLE card. Its dark "trap" wash
 * fades out to reveal the white "fix" card beneath (one border, one box), while
 * the problem and fix copy cross-fade inside a grid "stack" so the card
 * auto-sizes to the taller content. Each cell gets its OWN slice of scroll
 * progress (staggered by `index`), so the cards convert one-by-one, left →
 * right, instead of all at once.
 */
function MorphCard({
  p,
  index,
  scrollYProgress,
}: {
  p: PainPoint;
  index: number;
  scrollYProgress: MotionValue<number>;
}) {
  // Sequential, lightly-gapped windows: cell 0 flips first, then 1, 2, 3.
  const start = 0.3 + index * 0.12;
  const end = start + 0.1;

  const problemOpacity = useTransform(scrollYProgress, [start, end], [1, 0]);
  const problemY = useTransform(scrollYProgress, [start, end], [0, -12]);
  const solutionOpacity = useTransform(scrollYProgress, [start, end], [0, 1]);
  const solutionY = useTransform(scrollYProgress, [start, end], [12, 0]);
  // Same icon, same chip — only its color shifts from light (on the dark card)
  // to green-700 (on the white card) as the cell flips.
  const iconColor = useTransform(
    scrollYProgress,
    [start, end],
    ["#DAF4D7", "#009C62"],
  );

  return (
    <li className="relative overflow-hidden rounded-lg border border-gray-200 bg-white transition-colors hover:border-green-500/60">
      {/* Dark trap wash — fades out to reveal the white fix card underneath. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-linear-to-br from-green-700 to-green-900"
        style={{ opacity: problemOpacity }}
      />
      <div className="relative p-7">
        {/* Persistent chip — same glyph/size/position; only the color animates. */}
        <IconChip p={p} style={{ color: iconColor }} />
        {/* Copy cross-fades below the chip. Both share cell 1/1, so the card
            sizes to the taller (problem) copy; no fixed height needed. */}
        <div className="mt-6 grid grid-cols-1 [&>*]:col-start-1 [&>*]:row-start-1">
          <motion.div style={{ opacity: problemOpacity, y: problemY }}>
            <ProblemText p={p} />
          </motion.div>
          <motion.div style={{ opacity: solutionOpacity, y: solutionY }}>
            <SolutionText p={p} />
          </motion.div>
        </div>
      </div>
    </li>
  );
}

/* ── static fallback: mobile + reduced-motion ── */

function StaticStack() {
  return (
    <section>
      <div className="bg-white py-24 md:py-28">
        <Container width="wide">
          <ProblemHeader />
          <div className="mt-16">
            <ProblemGrid />
          </div>
        </Container>
      </div>
      <div className="bg-section-fade py-24 md:py-28">
        <Container width="wide">
          <SolutionHeader />
          <div className="mt-14">
            <SolutionGrid />
          </div>
        </Container>
      </div>
    </section>
  );
}

/* ── scroll-driven scene: lg+ with motion allowed ── */

function ScrollScene() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  // Header cross-fade (problem → answer), timed to lead the card sequence so
  // the frame says "How we solve it" as the first cells begin flipping.
  const problemOpacity = useTransform(scrollYProgress, [0, 0.22, 0.34], [1, 1, 0]);
  const problemHeaderY = useTransform(scrollYProgress, [0, 0.34], [0, -28]);
  const solutionOpacity = useTransform(scrollYProgress, [0.28, 0.46, 1], [0, 1, 1]);
  const solutionHeaderY = useTransform(scrollYProgress, [0.28, 0.62], [28, 0]);

  // White → soft-green wash as the trap cards convert to fixes.
  const bgOpacity = useTransform(scrollYProgress, [0.28, 0.72], [0, 1]);

  // Bottom progress rail.
  const railWidth = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);
  const trapLabelOpacity = useTransform(scrollYProgress, [0.3, 0.5], [1, 0.4]);
  const fixLabelOpacity = useTransform(scrollYProgress, [0.5, 0.72], [0.4, 1]);

  return (
    <section ref={ref} className="relative bg-white" style={{ height: "240vh" }}>
      <div className="sticky top-0 flex min-h-screen items-center overflow-hidden py-8">
        {/* White base + green wash that fades in as the problem resolves. */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-section-fade"
          style={{ opacity: bgOpacity }}
        />

        <Container width="wide" className="relative w-full">
          {/* Header cross-fade — both headers share cell 1/1, so the box sizes
              to the taller (problem) header and can never overlap the cards. */}
          <div className="mx-auto grid max-w-3xl grid-cols-1 items-center [&>*]:col-start-1 [&>*]:row-start-1">
            <motion.div style={{ opacity: problemOpacity, y: problemHeaderY }}>
              <ProblemHeader />
            </motion.div>
            <motion.div style={{ opacity: solutionOpacity, y: solutionHeaderY }}>
              <SolutionHeader />
            </motion.div>
          </div>

          {/* Staggered in-place morph — each cell overlays its dark trap card
              and light fix card and flips on its own slice of scroll, so the
              four cards convert one-by-one (left → right) rather than all at
              once. The scene only runs at lg+ (single row of 4). */}
          <div className="mt-8">
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {painPoints.map((p, i) => (
                <MorphCard
                  key={p.id}
                  p={p}
                  index={i}
                  scrollYProgress={scrollYProgress}
                />
              ))}
            </ul>
          </div>

          {/* Progress rail — affordance that the section morphs as you scroll. */}
          <div className="mx-auto mt-6 flex max-w-xs items-center gap-3">
            <motion.span
              className="gm-eyebrow shrink-0 text-gray-500"
              style={{ opacity: trapLabelOpacity }}
            >
              The trap
            </motion.span>
            <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-gray-200">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full bg-green-500"
                style={{ width: railWidth }}
              />
            </div>
            <motion.span
              className="gm-eyebrow shrink-0 text-green-700"
              style={{ opacity: fixLabelOpacity }}
            >
              The fix
            </motion.span>
          </div>
        </Container>
      </div>
    </section>
  );
}

/* ── chooser ── */

export function ProblemSolutionSection() {
  const reduce = useReducedMotion();
  const [sceneEnabled, setSceneEnabled] = useState(false);

  // Start false so SSR and the first client render both produce the static
  // fallback (no hydration mismatch), then upgrade to the pinned scene at lg+
  // when motion is allowed. Gated at 1024px (not 768px) because the mirrored
  // grid is 2 columns / 2 rows between 768–1023px — too tall to pin without
  // clipping the header/rail. At lg+ it's a single row of 4, so the pinned
  // stage stays short; tablets/phones use the stacked fallback.
  useEffect(() => {
    if (reduce) {
      setSceneEnabled(false);
      return;
    }
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setSceneEnabled(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [reduce]);

  return sceneEnabled ? <ScrollScene /> : <StaticStack />;
}
