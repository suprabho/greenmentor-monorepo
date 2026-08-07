"use client";

/**
 * The live room's hand-off card, replacing the embedded Meeting SDK player
 * (zoom-embed.tsx) on the live page — the embed was fragile (CDN script tags
 * to dodge the React 19 clash, brittle window-fitting), so the stage now
 * sends the learner to Zoom itself:
 *
 * - "Open Zoom app" → Zoom's launcher page, which deep-links the installed
 *   desktop/mobile app and offers the download when it's missing.
 * - "Join from browser" → straight into Zoom's web client.
 *
 * Both open a new tab so this page — and the polls rail beside it — stays
 * put. The meeting id + passcode are shown with copy affordances because the
 * links carry the plain passcode, not the encrypted token Zoom's own invites
 * embed; when a client rejects that and prompts, the answer is right here.
 *
 * A click is now our only in-app attendance signal, so each join link pings
 * /api/webinars/[id]/join fire-and-forget. Like the old heartbeat, a failed
 * ping must never get between a learner and the session.
 */

import { useEffect, useRef, useState } from "react";
import { Check, Copy, GlobeSimple, VideoCamera } from "@phosphor-icons/react";
import type { ZoomJoin } from "@/lib/webinars/zoom-join";

const COPIED_MS = 1500;

/** "9123 4567 8901" / "123 4567 8901" — the grouping Zoom itself displays. */
function formatMeetingNumber(digits: string): string {
  if (digits.length < 10) return digits;
  return `${digits.slice(0, -8)} ${digits.slice(-8, -4)} ${digits.slice(-4)}`;
}

/** A pill showing one join detail; clicking copies the raw value. */
function CopyField({ label, value, display }: { label: string; value: string; display?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(value);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), COPIED_MS);
    } catch {
      /* clipboard unavailable (insecure origin, or permission denied) */
    }
  };

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={`Copy ${label.toLowerCase()}`}
      className="group inline-flex items-center gap-2 rounded-full bg-white/10 py-1.5 pl-3.5 pr-3 text-[12.5px] transition-colors hover:bg-white/15"
    >
      <span className="font-medium text-white/55">{label}</span>
      <span className="font-semibold tracking-wide text-white">{display ?? value}</span>
      {copied ? (
        <Check size={13} weight="bold" className="text-green-400" />
      ) : (
        <Copy size={13} className="text-white/55 transition-colors group-hover:text-white" />
      )}
    </button>
  );
}

export function ZoomJoinCard({ webinarId, zoom }: { webinarId: string; zoom: ZoomJoin }) {
  // Fire-and-forget; keepalive lets the ping finish even if the browser
  // shifts focus to the Zoom app right away.
  const recordJoin = () => {
    void fetch(`/api/webinars/${webinarId}/join`, { method: "POST", keepalive: true }).catch(() => {});
  };

  return (
    <div className="flex h-full min-h-[420px] flex-col items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-gray-900 p-8 text-center lg:min-h-0">
      <VideoCamera size={30} className="text-white/80" weight="fill" />
      <p className="max-w-sm text-[13.5px] text-white/80">
        This session runs on Zoom. Open it in the Zoom app for the best experience, or join right
        from your browser — either way it opens in a new tab.
      </p>

      <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
        <a
          href={zoom.appUrl}
          target="_blank"
          rel="noreferrer"
          onClick={recordJoin}
          className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-[13.5px] font-semibold text-gray-900 transition-colors hover:bg-gray-100"
        >
          <VideoCamera size={16} weight="fill" /> Open Zoom app
        </a>
        <a
          href={zoom.browserUrl}
          target="_blank"
          rel="noreferrer"
          onClick={recordJoin}
          className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2 text-[13.5px] font-semibold text-white transition-colors hover:bg-white/20"
        >
          <GlobeSimple size={16} weight="bold" /> Join from browser
        </a>
      </div>

      <div className="mt-3 flex flex-col items-center gap-2">
        <p className="text-[11.5px] text-white/50">If Zoom asks for the meeting details, tap to copy:</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <CopyField
            label="Meeting ID"
            value={zoom.meetingNumber}
            display={formatMeetingNumber(zoom.meetingNumber)}
          />
          {zoom.passcode && <CopyField label="Passcode" value={zoom.passcode} />}
        </div>
      </div>
    </div>
  );
}
