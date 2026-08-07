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
const ZOOM_SDK_VERSION = "6.2.0";

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

/** How often to tell the server the learner is still watching. */
const HEARTBEAT_MS = 60_000;

/**
 * Fit the meeting "suspension window" to the stage so it behaves like Zoom's
 * own web client instead of a floating popup. The SDK honours the requested
 * width but treats height as a floor — it grows the window to
 * width × baseHeight/baseWidth for the current view (speaker's base is
 * 568×400; while receiving a screen share the base height becomes 615), so
 * requesting the container's raw size overflows any stage wider than the base
 * aspect. Instead: take the full height, cap the width to what that height
 * allows, and centre the leftover via popper.anchorPosition — video
 * letterboxes inside the window, like Zoom's own client. disableDraggable
 * renders the window position:absolute at that anchor rather than as a
 * react-draggable float.
 */
const STAGE_BASE_WIDTH = 568;

function stageVideoOptions(container: { width: number; height: number }, receivingShare: boolean) {
  const stageWidth = Math.floor(container.width);
  const height = Math.max(135, Math.floor(container.height));
  const maxWidth = Math.floor((height * STAGE_BASE_WIDTH) / (receivingShare ? 615 : 400));
  const width = Math.max(240, Math.min(stageWidth, maxWidth));
  return {
    // "speaker" as a string literal — the CDN bundle has no runtime enum. It
    // must be present in every payload (init and updates): an update without
    // it can snap the user's chosen view back to gallery.
    defaultViewType: "speaker",
    isResizable: false,
    popper: {
      disableDraggable: true,
      anchorPosition: { top: 0, left: Math.max(0, Math.floor((stageWidth - width) / 2)) },
    },
    viewSizes: {
      default: { width, height },
      ribbon: { width: 300, height },
    },
  };
}

interface JoinCredentials {
  signature: string;
  meetingNumber: string;
  password: string;
  userName: string;
  userEmail: string;
}

// The Component View client, kept loosely typed — the CDN bundle has no types
// and this is the small slice of its surface we touch. updateVideoOptions and
// on/off exist in both 3.13.2 and the 6.x line.
type EmbeddedClient = {
  init: (opts: Record<string, unknown>) => Promise<void>;
  join: (opts: Record<string, unknown>) => Promise<void>;
  leave: () => Promise<void>;
  updateVideoOptions: (opts: Record<string, unknown>) => void;
  on: (event: string, callback: (payload: unknown) => void) => void;
  off: (event: string, callback: (payload: unknown) => void) => void;
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

  // While joined, tell the server we're still here so the admin hub can show how
  // long this learner actually stayed (webinar_attendance.last_seen_at) rather
  // than just that they clicked Join. Fire-and-forget — a dropped ping only
  // costs a little precision, so failures are swallowed rather than surfaced.
  useEffect(() => {
    if (phase !== "joined") return;
    const ping = () => {
      void fetch(`/api/webinars/${webinarId}/heartbeat`, { method: "POST" }).catch(() => {});
    };
    const timer = setInterval(ping, HEARTBEAT_MS);
    return () => clearInterval(timer);
  }, [phase, webinarId]);

  // Keep the meeting window glued to the stage while joined: re-fit when the
  // container resizes and when a screen share starts/stops (share receive
  // swaps in a taller base, so the width cap tightens). updateVideoOptions
  // diffs internally, so repeats with unchanged sizes are no-ops, and the SDK
  // re-applies viewSizes itself on speaker/gallery/ribbon switches.
  useEffect(() => {
    if (phase !== "joined") return;
    const el = rootRef.current;
    const client = clientRef.current;
    if (!el || !client) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let receivingShare = false;
    let lastApplied = "";

    const apply = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width < 48 || rect.height < 48) return; // hidden/collapsed — keep the last fit
      const options = stageVideoOptions(rect, receivingShare);
      const key = JSON.stringify([options.viewSizes, options.popper.anchorPosition]);
      if (key === lastApplied) return;
      lastApplied = key;
      client.updateVideoOptions(options);
    };
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(apply, 200);
    };
    const onShareChange = (payload: unknown) => {
      receivingShare = (payload as { state?: string } | undefined)?.state === "Active";
      lastApplied = ""; // same box, different height law — force a resend
      schedule();
    };

    apply(); // layout can shift between the pre-init measure and join resolving
    const observer = new ResizeObserver(schedule);
    observer.observe(el);
    client.on("active-share-change", onShareChange);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
      client.off("active-share-change", onShareChange);
    };
  }, [phase]);

  const join = async () => {
    const root = rootRef.current;
    if (!root) return;
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

      // The join overlay is absolutely positioned, so the root div already has
      // its final stage size here; the guard covers a hidden/collapsed layout
      // (the SDK needs positive pixel sizes).
      const rect = root.getBoundingClientRect();
      const stage =
        rect.width >= 48 && rect.height >= 48
          ? { width: rect.width, height: rect.height }
          : { width: 960, height: 540 };

      await client.init({
        zoomAppRoot: root,
        language: "en-US",
        patchJsMedia: true,
        customize: { video: stageVideoOptions(stage, false) },
      });
      await client.join({
        // sdkKey was removed from join options in SDK v4 — the signature carries the app key
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
    <div className="zoom-stage relative h-full min-h-[420px] overflow-hidden rounded-2xl border border-gray-200 bg-gray-900 lg:min-h-0">
      {/* Zoom renders its client into this element once joined. Positioned so
          the pinned meeting window anchors to it exactly (see globals.css
          ".zoom-stage" and stageVideoOptions above). */}
      <div ref={rootRef} className="absolute inset-0" />

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
