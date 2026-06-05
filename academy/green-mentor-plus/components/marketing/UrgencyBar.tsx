"use client";

import { CalendarCheck } from "@phosphor-icons/react/dist/ssr";
import { Container } from "@/components/marketing/Container";

/**
 * Contextual urgency (G-6) — a single real upcoming live session.
 *
 * SCAFFOLD: intentionally takes its data via props with NO defaults, so it can
 * only ever render a real, current event. The deck's guidance is explicit —
 * fabricated dates or seat counts destroy trust when discovered. Mount it from
 * the page only once you can pass a genuine session date, topic, and seat count
 * (ideally from a data source, not hard-coded).
 */
export interface UrgencyBarProps {
  /** Human date, e.g. "21 June". */
  date: string;
  /** Session title, e.g. "BRSR Filing for FY2025-26: What's Changed". */
  topic: string;
  /** Real remaining seats. */
  seatsRemaining: number;
}

export function UrgencyBar({ date, topic, seatsRemaining }: UrgencyBarProps) {
  return (
    <div className="bg-green-700 text-white">
      <Container width="wide">
        <div className="flex flex-col items-center justify-center gap-x-3 gap-y-1 py-2.5 text-center text-[13px] sm:flex-row md:text-[14px]">
          <span className="inline-flex items-center gap-1.5 font-semibold">
            <CalendarCheck size={16} weight="bold" aria-hidden />
            Next live session · {date}
          </span>
          <span className="text-white/90">
            &ldquo;{topic}&rdquo; — open to Plus members · {seatsRemaining} seats
            remaining
          </span>
        </div>
      </Container>
    </div>
  );
}
