"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarCheck, CalendarPlus } from "@phosphor-icons/react";

/**
 * One-click RSVP toggle for a webinar card. Signed-out users get a link to
 * /login instead — the "webinar_rsvps own" RLS policy needs a session.
 */
export function RsvpButton({
  webinarId,
  initialAttending,
  signedIn,
}: {
  webinarId: string;
  initialAttending: boolean;
  signedIn: boolean;
}) {
  const [attending, setAttending] = useState(initialAttending);
  const [busy, setBusy] = useState(false);

  if (!signedIn) {
    return (
      <Link
        href="/login"
        className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3.5 py-1.5 text-[12.5px] font-semibold text-gray-700 transition-colors hover:bg-gray-50"
      >
        <CalendarPlus size={14} /> Sign in to RSVP
      </Link>
    );
  }

  const toggle = async () => {
    const next = !attending;
    setAttending(next); // optimistic
    setBusy(true);
    try {
      const res = await fetch("/api/webinars/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webinar_id: webinarId, attending: next }),
      });
      if (!res.ok) setAttending(!next);
    } catch {
      setAttending(!next);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={busy}
      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors disabled:opacity-60 ${
        attending
          ? "bg-green-100 text-green-800 hover:bg-green-200"
          : "bg-teal-900 text-white hover:bg-teal-800"
      }`}
    >
      {attending ? (
        <>
          <CalendarCheck size={14} weight="bold" /> Going
        </>
      ) : (
        <>
          <CalendarPlus size={14} /> RSVP
        </>
      )}
    </button>
  );
}
