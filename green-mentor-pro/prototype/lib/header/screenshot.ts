// Server-side header -> PNG via a real headless browser.
//
// We use Playwright (not html-to-image) precisely BECAUSE the background is a
// cross-origin aura iframe: client-side canvas capture taints on cross-origin
// frames, but a real browser screenshot captures the composited pixels — the
// genuine animated aura included.
//
// Shared by both the export API route and the skill's CLI script.

import { headerDocumentHTML } from "./render";
import { sizeFor, type HeaderConfig } from "./types";

export type ScreenshotOpts = {
  /** Origin used to resolve app-relative asset paths (speaker photo). */
  origin?: string;
  /** Pixel density of the export. 2 = retina-crisp. */
  scale?: number;
  /** ms to let the aura animation + fonts settle before the shot. */
  settleMs?: number;
};

export async function renderHeaderPng(
  config: HeaderConfig,
  opts: ScreenshotOpts = {}
): Promise<Buffer> {
  const { origin, scale = 2, settleMs = 2600 } = opts;
  const size = sizeFor(config.sizeId);
  const html = headerDocumentHTML(config, { origin });

  // Lazy import so the Next build never hard-depends on the browser binary.
  const { chromium } = await import("playwright");

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: size.width, height: size.height },
      deviceScaleFactor: scale,
    });
    await page.setContent(html, { waitUntil: "networkidle", timeout: 30_000 });
    // Make sure web fonts are in before we measure text.
    await page.evaluate(() => (document as Document).fonts.ready).catch(() => {});
    // Give the aura canvas a moment to warm up into a vivid frame.
    await page.waitForTimeout(settleMs);

    const el = await page.$("#header");
    const buf = el
      ? await el.screenshot({ type: "png" })
      : await page.screenshot({ type: "png" });
    return buf as Buffer;
  } finally {
    await browser.close();
  }
}
