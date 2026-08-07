"use client";

/**
 * Boots the Zoom Meeting SDK **Client View** and reports back to the parent
 * frame. Client View (unlike the Component View this replaced) is Zoom's own
 * full web-client UI — edge-to-edge tiles, full-width toolbar — but it paints
 * over the whole viewport, which is exactly why it lives in this iframed page.
 *
 * The SDK comes from Zoom's CDN via script tags, NOT the npm package: the npm
 * build declares react as an external and can't run on the app's React 19
 * (devforum.zoom.us/t/react-19-not-supported-with-embedded-sdk/134827), while
 * the CDN vendor bundles ship Zoom's own React 18 as window globals that never
 * touch the app's module-scoped React. Load order and the vendor list are the
 * Client View flavour from Zoom's official sample (meetingsdk-web-sample
 * CDN/meeting.html): react-redux is required here, lodash is not, and 6.x
 * needs no CSS links — the bundle injects its own styles (confined to this
 * document, which is the other reason for the iframe).
 *
 * Join credentials come from the same signed-in-only signature route the old
 * embed used (app/api/webinars/[id]/zoom-signature); minting one records
 * attendance, and this page only loads after an explicit Join click in the
 * parent, so the one-mint-per-click semantics are unchanged.
 *
 * Bridge to the parent (components/webinars/zoom-embed.tsx):
 *   { source: "gm-zoom-stage", event: "joined" | "left" | "error", message? }
 * posted to our own origin only. "left" arrives via Zoom's leaveUrl: leaving
 * (or the host ending the meeting) navigates THIS frame to ?left=1, the page
 * re-renders, and the splash below posts the event. If the page is opened
 * directly (no parent), the bridge is a no-op and the stage works full-tab.
 */

import { useEffect, useState } from "react";
import { CircleNotch } from "@phosphor-icons/react";

// Keep in sync with the CDN bundles Zoom publishes (source.zoom.us).
const ZOOM_SDK_VERSION = "6.2.0";

// Client View load order per Zoom's sample: vendor globals first, SDK last.
const ZOOM_SDK_SCRIPTS = [
  `https://source.zoom.us/${ZOOM_SDK_VERSION}/lib/vendor/react.min.js`,
  `https://source.zoom.us/${ZOOM_SDK_VERSION}/lib/vendor/react-dom.min.js`,
  `https://source.zoom.us/${ZOOM_SDK_VERSION}/lib/vendor/react-redux.min.js`,
  `https://source.zoom.us/${ZOOM_SDK_VERSION}/lib/vendor/redux.min.js`,
  `https://source.zoom.us/${ZOOM_SDK_VERSION}/lib/vendor/redux-thunk.min.js`,
  `https://source.zoom.us/${ZOOM_SDK_VERSION}/zoom-meeting-${ZOOM_SDK_VERSION}.min.js`,
];

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

// The slice of ZoomMtg we touch, kept loosely typed — the CDN bundle has no
// types. Client View is callback-based (success/error), not promise-based.
type ZoomMtgSdk = {
  setZoomJSLib: (path: string, dir: string) => void;
  preLoadWasm: () => void;
  prepareWebSDK: () => void;
  init: (opts: Record<string, unknown>) => void;
  join: (opts: Record<string, unknown>) => void;
};

interface JoinCredentials {
  signature: string;
  meetingNumber: string;
  password: string;
  userName: string;
  userEmail: string;
}

type StageEvent = "joined" | "left" | "error";

function post(event: StageEvent, message?: string) {
  if (window.parent === window) return; // opened directly — no bridge to feed
  window.parent.postMessage({ source: "gm-zoom-stage", event, message }, window.location.origin);
}

// One-shot per iframe document: React StrictMode double-invokes effects in
// dev, and a second boot would double-join. Every (re)join mounts a fresh
// iframe document, so the flag naturally resets when it should.
let booted = false;

export function StageClient({ webinarId, left }: { webinarId: string; left: boolean }) {
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    if (left) {
      // leaveUrl landing: tell the parent, which unmounts this iframe. The
      // splash below only shows if the page is open directly in a tab.
      post("left");
      return;
    }
    if (booted) return;
    booted = true;

    const fail = (message?: string) => {
      const m = message || "Could not join the webinar.";
      setFailure(m);
      post("error", m);
    };

    void (async () => {
      try {
        const res = await fetch(`/api/webinars/${webinarId}/zoom-signature`);
        const body = (await res.json().catch(() => ({}))) as Partial<JoinCredentials> & { error?: string };
        if (!res.ok) throw new Error(body.error ?? `Could not get a join signature (HTTP ${res.status})`);
        const creds = body as JoinCredentials;

        for (const src of ZOOM_SDK_SCRIPTS) await loadScript(src);
        const ZoomMtg = (window as unknown as { ZoomMtg?: ZoomMtgSdk }).ZoomMtg;
        if (!ZoomMtg) throw new Error("The Zoom SDK loaded but did not initialise.");

        ZoomMtg.setZoomJSLib(`https://source.zoom.us/${ZOOM_SDK_VERSION}/lib`, "/av");
        ZoomMtg.preLoadWasm();
        ZoomMtg.prepareWebSDK(); // the SDK creates and manages #zmmtg-root itself

        ZoomMtg.init({
          // Relative is fine (resolves against our origin) and the SDK
          // navigates this frame, not the top window.
          leaveUrl: `/webinars/${webinarId}/stage?left=1`,
          patchJsMedia: true,
          // Parent unmounts the iframe (or the tab closes) = leave instantly
          // instead of lingering into meeting failover.
          leaveOnPageUnload: true,
          // One click in the parent goes straight into the meeting, matching
          // the old embed. Flip to false to get Zoom's device-preview screen.
          disablePreview: true,
          success: () => {
            ZoomMtg.join({
              // sdkKey was removed from join options in SDK v4 — the
              // signature carries the app key.
              signature: creds.signature,
              meetingNumber: creds.meetingNumber,
              passWord: creds.password, // Client View spells it passWord
              userName: creds.userName,
              userEmail: creds.userEmail,
              success: () => post("joined"),
              error: (reason: { errorMessage?: string } | undefined) => fail(reason?.errorMessage),
            });
          },
          error: (reason: { errorMessage?: string } | undefined) => fail(reason?.errorMessage),
        });
      } catch (e) {
        fail(e instanceof Error ? e.message : undefined);
      }
    })();
  }, [left, webinarId]);

  // Backdrop + boot splash. Zoom paints its own full-viewport UI over this
  // the moment init lands, so past that point none of it is visible.
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-3 bg-[#0b0b0b] p-8 text-center">
      {left ? (
        <p className="text-[13.5px] text-white/80">You’ve left the session.</p>
      ) : failure ? (
        <p className="max-w-sm text-[13.5px] text-white/80">{failure}</p>
      ) : (
        <>
          <CircleNotch size={28} className="animate-spin text-white/80" />
          <p className="text-[13.5px] text-white/80">Connecting to the webinar…</p>
        </>
      )}
    </div>
  );
}
