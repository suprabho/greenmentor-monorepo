"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Cycles through a short list of cards one at a time: the current card slides
 * up and out while the next slides up and in, every `intervalMs`. The two
 * layers share one grid cell so the container is never empty mid-swap.
 *
 * Runs only while `active` — a slide the visitor can't see shouldn't tick —
 * and restarts from the first item when it becomes active again, so every
 * pass through the carousel opens on the same card. Never advances under
 * prefers-reduced-motion: the first item just stays put.
 */
export function VerticalCycler<T>({
  items,
  render,
  keyOf,
  active,
  intervalMs = 3000,
}: {
  items: readonly T[];
  render: (item: T) => ReactNode;
  keyOf: (item: T) => string;
  active: boolean;
  intervalMs?: number;
}) {
  const [index, setIndex] = useState(0);
  const [previous, setPrevious] = useState<number | null>(null);

  useEffect(() => {
    if (!active) {
      setIndex(0);
      setPrevious(null);
      return;
    }
    if (items.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      setIndex((i) => {
        setPrevious(i);
        return (i + 1) % items.length;
      });
    }, intervalMs);
    return () => clearInterval(t);
  }, [active, items.length, intervalMs]);

  // Drop the outgoing layer once its exit animation has finished so it can't
  // stack up under the next swap.
  useEffect(() => {
    if (previous === null) return;
    const t = setTimeout(() => setPrevious(null), 600);
    return () => clearTimeout(t);
  }, [previous, index]);

  const current = items[index];
  if (current === undefined) return null;

  return (
    <div className="grid h-full grid-rows-[minmax(0,1fr)] [&>*]:h-full [&>*]:min-h-0 [&>*>*]:h-full" aria-live="off">
      {previous !== null && items[previous] !== undefined && (
        <div
          key={`out-${keyOf(items[previous])}`}
          aria-hidden
          className="gm-cycle-out pointer-events-none col-start-1 row-start-1"
        >
          {render(items[previous])}
        </div>
      )}
      <div key={`in-${keyOf(current)}`} className="gm-cycle-in col-start-1 row-start-1">
        {render(current)}
      </div>
    </div>
  );
}
