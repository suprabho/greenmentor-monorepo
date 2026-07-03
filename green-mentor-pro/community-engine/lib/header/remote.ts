// Proxy to the warm-browser render service (green-mentor-pro/header-render-service,
// on Fly). We generate the header HTML here — the single source of truth — and the
// service just drives Chromium and screenshots it. This keeps the heavy, cold-start-
// prone, software-WebGL render off the Vercel Lambda.
//
// When HEADER_RENDER_URL is unset (e.g. local dev), the export route skips this and
// renders in-process with local Playwright instead (see lib/header/screenshot.ts).

import { headerDocumentHTML } from "./render";
import { sizeFor, type HeaderConfig } from "./types";
import type { ImageFormat } from "./screenshot";

/** True when the export route should proxy to the Fly render service. */
export function renderServiceConfigured(): boolean {
  return !!process.env.HEADER_RENDER_URL;
}

export type RemoteRenderOpts = {
  origin?: string;
  scale?: number;
  format?: ImageFormat;
  quality?: number;
};

/**
 * Render a header via the Fly service. Throws on a non-200 so the route's catch can
 * surface the reason. Bounded by an abort timeout well under the route's maxDuration
 * so a stuck service fails fast instead of burning the whole function budget.
 */
export async function renderHeaderViaService(
  config: HeaderConfig,
  opts: RemoteRenderOpts = {}
): Promise<Buffer> {
  const base = process.env.HEADER_RENDER_URL;
  const secret = process.env.HEADER_RENDER_SECRET;
  if (!base) throw new Error("HEADER_RENDER_URL is not set");
  if (!secret) throw new Error("HEADER_RENDER_SECRET is not set");

  const { origin, scale = 2, format = "png", quality = 90 } = opts;
  const size = sizeFor(config.sizeId);
  const html = headerDocumentHTML(config, { origin });

  const res = await fetch(`${base.replace(/\/+$/, "")}/shot`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-render-secret": secret,
    },
    body: JSON.stringify({
      html,
      width: size.width,
      height: size.height,
      dpr: scale,
      format,
      quality,
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`render service ${res.status}: ${detail.slice(0, 300)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}
