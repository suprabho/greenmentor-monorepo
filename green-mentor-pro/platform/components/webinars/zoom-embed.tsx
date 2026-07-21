"use client";

/**
 * Embedded Zoom webinar player (Meeting SDK — Component View). The heavy SDK is
 * loaded on a user gesture (the "Join" click) so it never loads during SSR or
 * before it's needed, and so the browser's camera/mic prompt is tied to an
 * explicit action. Join credentials come from the server-side signature route
 * (app/api/webinars/[id]/zoom-signature), which is gated on a signed-in
 * session — the SDK secret never reaches the browser.
 *
 * The SDK is loaded from Zoom's CDN (their documented script-tag setup: React
 * 18 + redux vendor globals, then the SDK bundle), NOT from the npm package.
 * The npm build declares react as an external, and Next's App Router forces
 * every client module onto the app's React 19, whose internals the SDK can't
 * use — joining then throws "Cannot read properties of undefined (reading
 * 'ReactCurrentOwner')"
 * (devforum.zoom.us/t/react-19-not-supported-with-embedded-sdk/134827). The
 * script tags keep the SDK outside the bundler, so it runs on Zoom's own
 * React 18 globals while the app's module-scoped React 19 is untouched. The
 * SDK pulls its media/wasm assets from source.zoom.us either way, so this
 * adds no new runtime dependency.
 */

import { useEffect, useRef, useState } from "react";
import { VideoCamera, CircleNotch } from "@phosphor-icons/react";

// Keep in sync with the CDN bundles Zoom publishes (source.zoom.us).
const ZOOM_SDK_VERSION = "3.13.2";

// Zoom's documented load order: vendor globals first, SDK bundle last.
const ZOOM_SDK_SCRIPTS = [
  `https://source.zoom.us/${ZOOM_SDK_VERSION}/lib/vendor/react.min.js`,
  `https://source.zoom.us/${ZOOM_SDK_VERSION}/lib/vendor/react-dom.min.js`,
  `https://source.zoom.us/${ZOOM_SDK_VERSION}/lib/vendor/redux.min.js`,
  `https://source.zoom.us/${ZOOM_SDK_VERSION}/lib/vendor/redux-thunk.min.js`,
  `https://source.zoom.us/${ZOOM_SDK_VERSION}/lib/vendor/lodash.min.js`,
  `https://source.zoom.us/${ZOOM_SDK_VERSION}/zoom-meeting-embedded-${ZOOM_SDK_VERSION}.min.js`,
];

type EmbeddedSdk = { createClient: () => unknown };

const scriptPromises = new Map<string, Promise<void>>();

function loadScript(src: string): Promise<void> {
  const cached = scriptPromises.get(src);
  if (cached) return cached;
  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () => {
      scriptPromises.delete(src); // allow a retry after e.g. a network blip
      script.remove();
      reject(new Error("Could not load the Zoom SDK."));
    });
    document.head.appendChild(script);
  });
  scriptPromises.set(src, promise);
  return promise;
}

async function loadZoomEmbeddedSdk(): Promise<EmbeddedSdk> {
  const w = window as unknown as { ZoomMtgEmbedded?: EmbeddedSdk };
  if (w.ZoomMtgEmbedded) return w.ZoomMtgEmbedded;
  for (const src of ZOOM_SDK_SCRIPTS) await loadScript(src);
  if (!w.ZoomMtgEmbedded) throw new Error("The Zoom SDK loaded but did not initialise.");
  return w.ZoomMtgEmbedded;
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

// The Component View client, kept loosely typed — the CDN bundle has no types
// and we only touch init/join/leave here.
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

      const ZoomMtgEmbedded = await loadZoomEmbeddedSdk();
      const client = ZoomMtgEmbedded.createClient() as EmbeddedClient;
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
    <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gray-900">
      {/* Zoom renders its client into this element once joined. */}
      <div ref={rootRef} className="min-h-[420px] w-full" />

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
