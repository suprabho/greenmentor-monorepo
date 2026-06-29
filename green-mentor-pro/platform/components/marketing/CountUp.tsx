"use client";

import { useEffect, useRef } from "react";
import { useInView, useMotionValue, animate } from "framer-motion";

interface CountUpProps {
  /** Display string such as "5,000+", "40,000+", "10+". */
  value: string;
  className?: string;
  /** Animation length in seconds. */
  duration?: number;
}

/**
 * Animates a formatted stat from 0 up to its target the first time it scrolls
 * into view. Splits the string into a non-numeric prefix/suffix (e.g. the "+")
 * and the numeric core, so "40,000+" counts up and re-renders with grouping.
 */
export function CountUp({ value, className, duration = 1.6 }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const motionValue = useMotionValue(0);

  const match = value.match(/^(\D*)([\d,]+)(.*)$/);
  const prefix = match?.[1] ?? "";
  const numericString = match?.[2] ?? value;
  const suffix = match?.[3] ?? "";
  const target = Number(numericString.replace(/,/g, ""));
  const useGrouping = numericString.includes(",");

  useEffect(() => {
    if (!inView || Number.isNaN(target)) return;
    const controls = animate(motionValue, target, {
      duration,
      ease: [0.2, 0.7, 0.2, 1],
      onUpdate: (latest) => {
        const node = ref.current;
        if (!node) return;
        node.textContent =
          prefix +
          Math.round(latest).toLocaleString("en-US", { useGrouping }) +
          suffix;
      },
    });
    return () => controls.stop();
  }, [inView, target, duration, motionValue, prefix, suffix, useGrouping]);

  // Fall back to the raw string when there's no parseable number.
  if (Number.isNaN(target)) {
    return <span className={className}>{value}</span>;
  }

  return (
    <span ref={ref} className={className}>
      {prefix}0{suffix}
    </span>
  );
}
