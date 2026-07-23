"use client";

/**
 * Embedded Zoom webinar player (Meeting SDK — Component View). The heavy SDK is
 * dynamically imported on a user gesture (the "Join" click) so it never loads
 * during SSR or before it's needed, and so the browser's camera/mic prompt is
 * tied to an explicit action. Join credentials come from the server-side
 * signature route (app/api/webinars/[id]/zoom-signature), which is gated on a
 * signed-in session — the SDK secret never reaches the browser.
 */

import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { VideoCamera, CircleNotch } from "@phosphor-icons/react";

/**
 * @zoom/meetingsdk's Component View reads React's internal
 * ReactCurrentOwner/ReactCurrentBatchConfig, which React 19 restructured —
 * without this shim, joining throws "Cannot read properties of undefined
 * (reading 'ReactCurrentOwner')". No official Zoom fix exists yet
 * (devforum.zoom.us/t/react-19-not-supported-with-embedded-sdk/134827).
 * Guarded so it's a harmless no-op once Zoom ships real React 19 support (or
 * if a future React release removes/renames the internals object again).
 */
function patchReactInternalsForZoomSdk() {
  const internals = (
    React as unknown as {
      __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?: Record<string, unknown>;
    }
  ).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
  if (!internals) return;
  if (!internals.ReactCurrentOwner) internals.ReactCurrentOwner = { current: null };
  if (!internals.ReactCurrentBatchConfig) internals.ReactCurrentBatchConfig = { transition: 0 };
}

type Phase = "idle" | "joining" | "joined" | "error";

interface JoinCredentials {
  signature: string;
  sdkKey: string;
  meetingNumber: string;
  password: string;
  userName: string;
  userEmail: string;
}

// The Component View client, kept loosely typed — @zoom/meetingsdk ships its
// own .d.ts but we only touch init/join/leave here.
type EmbeddedClient = {
  init: (opts: Record<string, unknown>) => Promise<void>;
  join: (opts: Record<string, unknown>) => Promise<void>;
  leave: () => Promise<void>;
};

export function ZoomEmbed({ webinarId }: { webinarId: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<EmbeddedClient | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);

  // Leave the meeting when the page unmounts so the session is released.
  useEffect(() => {
    return () => {
      clientRef.current?.leave().catch(() => {});
    };
  }, []);

  const join = async () => {
    if (!rootRef.current) return;
    setPhase("joining");
    setError(null);
    try {
      const res = await fetch(`/api/webinars/${webinarId}/zoom-signature`);
      const body = (await res.json().catch(() => ({}))) as Partial<JoinCredentials> & { error?: string };
      if (!res.ok) throw new Error(body.error ?? `Could not get a join signature (HTTP ${res.status})`);
      const creds = body as JoinCredentials;

      patchReactInternalsForZoomSdk();
      const ZoomMtgEmbedded = (await import("@zoom/meetingsdk/embedded")).default;
      const client = ZoomMtgEmbedded.createClient() as unknown as EmbeddedClient;
      clientRef.current = client;

      await client.init({
        zoomAppRoot: rootRef.current,
        language: "en-US",
        patchJsMedia: true,
      });
      await client.join({
        sdkKey: creds.sdkKey,
        signature: creds.signature,
        meetingNumber: creds.meetingNumber,
        password: creds.password,
        userName: creds.userName,
        userEmail: creds.userEmail,
      });
      setPhase("joined");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join the webinar");
      setPhase("error");
    }
  };

  return (
    <div className="relative h-full min-h-[420px] overflow-hidden rounded-2xl border border-gray-200 bg-gray-900">
      {/* Zoom renders its client into this element once joined. */}
      <div ref={rootRef} className="h-full min-h-[420px] w-full" />

      {phase !== "joined" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center">
          {phase === "joining" ? (
            <>
              <CircleNotch size={28} className="animate-spin text-white/80" />
              <p className="text-[13.5px] text-white/80">Connecting to the webinar…</p>
            </>
          ) : (
            <>
              <VideoCamera size={30} className="text-white/80" weight="fill" />
              <p className="max-w-sm text-[13.5px] text-white/80">
                {phase === "error"
                  ? error ?? "Something went wrong joining the webinar."
                  : "The session runs right here in GreenMentor. Click to join when the host is live."}
              </p>
              <button
                type="button"
                onClick={() => void join()}
                className="mt-1 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-[13.5px] font-semibold text-gray-900 transition-colors hover:bg-gray-100"
              >
                <VideoCamera size={16} weight="fill" />
                {phase === "error" ? "Try again" : "Join webinar"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
