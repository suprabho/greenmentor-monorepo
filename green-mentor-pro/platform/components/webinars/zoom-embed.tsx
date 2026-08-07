"use client";

/**
 * Embedded Zoom webinar player. The stage is a same-origin iframe onto
 * app/(fullbleed)/webinars/[slug]/stage, which boots Zoom's **Client View** —
 * the full web-client UI (edge-to-edge tiles, full-width toolbar). Client
 * View paints over its whole viewport, so the iframe gives it one: no more
 * Component View "suspension window" letterboxing inside a fixed base aspect.
 *
 * The iframe only mounts on the Join click, so the multi-megabyte SDK never
 * loads before it's needed and the camera/mic prompt stays tied to a user
 * gesture. The stage document reports back over postMessage
 * ({ source: "gm-zoom-stage", event: "joined" | "left" | "error" }); "left"
 * covers both the user leaving and the host ending the meeting (Zoom's
 * leaveUrl round-trip). Unmounting the iframe is the leave mechanism — the
 * stage inits with leaveOnPageUnload, so tearing down the document exits the
 * meeting immediately.
 *
 * All SDK loading/join specifics (and why it's CDN script tags, not the npm
 * package) live in the stage client: app/(fullbleed)/webinars/[slug]/stage.
 */

import { useEffect, useState } from "react";
import { VideoCamera } from "@phosphor-icons/react";

type Phase = "idle" | "live" | "left" | "error";

type StageMessage = {
  source?: string;
  event?: "joined" | "left" | "error";
  message?: string;
};

/** How often to tell the server the learner is still watching. */
const HEARTBEAT_MS = 60_000;

export function ZoomEmbed({ webinarId }: { webinarId: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Iframe key: every (re)join mounts a fresh stage document, which fetches a
  // fresh signature — same one-mint-per-click attendance semantics as before.
  const [session, setSession] = useState(0);

  // Listen for the stage document's bridge events while the iframe is up.
  useEffect(() => {
    if (phase !== "live") return;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const data = e.data as StageMessage | undefined;
      if (!data || data.source !== "gm-zoom-stage") return;
      if (data.event === "joined") {
        setJoined(true);
      } else if (data.event === "left") {
        setJoined(false);
        setPhase("left");
      } else if (data.event === "error") {
        setJoined(false);
        setError(data.message ?? null);
        setPhase("error");
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [phase]);

  // While joined, tell the server we're still here so the admin hub can show how
  // long this learner actually stayed (webinar_attendance.last_seen_at) rather
  // than just that they clicked Join. Fire-and-forget — a dropped ping only
  // costs a little precision, so failures are swallowed rather than surfaced.
  useEffect(() => {
    if (!joined) return;
    const ping = () => {
      void fetch(`/api/webinars/${webinarId}/heartbeat`, { method: "POST" }).catch(() => {});
    };
    const timer = setInterval(ping, HEARTBEAT_MS);
    return () => clearInterval(timer);
  }, [joined, webinarId]);

  const join = () => {
    setError(null);
    setJoined(false);
    setSession((s) => s + 1);
    setPhase("live");
  };

  return (
    <div className="relative h-full min-h-[420px] overflow-hidden rounded-2xl border border-gray-200 bg-gray-900 lg:min-h-0">
      {phase === "live" && (
        <iframe
          key={session}
          src={`/webinars/${webinarId}/stage`}
          title="Live webinar stage"
          allow="camera; microphone; display-capture; fullscreen; autoplay"
          allowFullScreen
          className="absolute inset-0 h-full w-full border-0"
        />
      )}

      {phase !== "live" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center">
          <VideoCamera size={30} className="text-white/80" weight="fill" />
          <p className="max-w-sm text-[13.5px] text-white/80">
            {phase === "error"
              ? error ?? "Something went wrong joining the webinar."
              : phase === "left"
                ? "You left the session."
                : "The session runs right here in GreenMentor. Click to join when the host is live."}
          </p>
          <button
            type="button"
            onClick={join}
            className="mt-1 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-[13.5px] font-semibold text-gray-900 transition-colors hover:bg-gray-100"
          >
            <VideoCamera size={16} weight="fill" />
            {phase === "error" ? "Try again" : phase === "left" ? "Rejoin" : "Join webinar"}
          </button>
        </div>
      )}
    </div>
  );
}
