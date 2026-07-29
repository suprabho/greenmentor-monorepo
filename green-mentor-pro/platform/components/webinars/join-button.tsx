"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, VideoCamera } from "@phosphor-icons/react";
import {
  formatCountdown,
  getWebinarPhase,
  joinOpensAt,
  type TimedWebinar,
  type WebinarPhase,
} from "@/lib/webinars/status";

/**
 * The Join slot on a webinar card. Joining only opens 10 minutes before the
 * scheduled start, so until then the slot shows a live countdown that flips
 * itself to the Join link — the cards are server-rendered once and would
 * otherwise stay stale for anyone leaving the page open.
 *
 * `serverNow` seeds the first render so SSR and hydration agree; the ticker
 * takes over with the client clock only after mount.
 */
export function JoinButton({
  webinarId,
  scheduledAt,
  durationMinutes,
  serverNow,
}: {
  webinarId: string;
  scheduledAt: string | null;
  durationMinutes: number | null;
  serverNow: string;
}) {
  const [view, setView] = useState(() =>
    computeView({ scheduledAt, durationMinutes }, Date.parse(serverNow))
  );

  useEffect(() => {
    const webinar = { scheduledAt, durationMinutes };
    const tick = () =>
      setView((prev) => {
        const next = computeView(webinar, Date.now());
        // Same label ⇒ hand back the previous object so React skips the
        // re-render; only the ~once-a-minute changes reach the DOM.
        return next.phase === prev.phase && next.label === prev.label ? prev : next;
      });
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [scheduledAt, durationMinutes]);

  if (view.phase === "joinable") {
    return (
      <Link
        href={`/webinars/${webinarId}/live`}
        className="inline-flex items-center gap-1.5 rounded-full bg-teal-900 px-3.5 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-teal-800"
      >
        <VideoCamera size={14} weight="fill" /> Join
      </Link>
    );
  }

  if (view.phase === "scheduled") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3.5 py-1.5 text-[12.5px] font-semibold text-gray-500">
        <Clock size={14} /> Join in {view.label}
      </span>
    );
  }

  // Ended, or no date set yet — there's nothing to join.
  return null;
}

function computeView(webinar: TimedWebinar, now: number): { phase: WebinarPhase; label: string } {
  const phase = getWebinarPhase(webinar, now);
  const opens = joinOpensAt(webinar);
  return {
    phase,
    label: phase === "scheduled" && opens !== null ? formatCountdown(opens - now) : "",
  };
}
