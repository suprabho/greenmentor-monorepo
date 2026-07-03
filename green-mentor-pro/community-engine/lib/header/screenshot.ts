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

/**
 * Launch a headless Chromium that works both locally and on serverless (Vercel).
 *
 * Locally (and for the CLI render script) we use the full `playwright` package
 * and the Chromium it downloaded via `npx playwright install`. On Vercel / AWS
 * Lambda that binary doesn't exist and the filesystem is read-only, so we drive
 * a serverless-packaged Chromium from `@sparticuz/chromium` via `playwright-core`.
 */
async function launchBrowser() {
  const onServerless =
    !!process.env.AWS_LAMBDA_FUNCTION_VERSION || !!process.env.VERCEL_ENV;

  if (onServerless) {
    const chromium = (await import("@sparticuz/chromium")).default;
    const { chromium: playwright } = await import("playwright-core");
    return playwright.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  // Lazy import so the Next build never hard-depends on the local browser binary.
  const { chromium } = await import("playwright");
  return chromium.launch({ headless: true });
}

/** Output formats. Playwright only screenshots PNG/JPEG, so WebP is a post-pass. */
export type ImageFormat = "png" | "webp";

export type ScreenshotOpts = {
  /** Origin used to resolve app-relative asset paths (speaker photo). */
  origin?: string;
  /** Pixel density of the export. 2 = retina-crisp. */
  scale?: number;
  /** ms to let the aura animation + fonts settle before the shot. */
  settleMs?: number;
  /** Encoded output format. Default "png". */
  format?: ImageFormat;
  /** WebP quality (1–100). Ignored for PNG. Default 90. */
  quality?: number;
};

/**
 * Render a header to an encoded image buffer.
 *
 * Always screenshots PNG first (Playwright can't emit WebP); when format is
 * "webp" we transcode the lossless PNG with sharp. The buffer's encoding
 * matches `opts.format` — callers set Content-Type / filename accordingly.
 */
export async function renderHeader(
  config: HeaderConfig,
  opts: ScreenshotOpts = {}
): Promise<Buffer> {
  const { origin, scale = 2, settleMs = 2600, format = "png", quality = 90 } = opts;
  const size = sizeFor(config.sizeId);
  const html = headerDocumentHTML(config, { origin });

  // Phase timings surface in the Vercel function logs. A serverless render is
  // CPU-bound (software WebGL via SwiftShader on a GPU-less Lambda), so when it's
  // slow this shows exactly which phase is eating the budget instead of guessing.
  const t0 = Date.now();
  const mark = (phase: string) =>
    console.log(`[renderHeader] ${phase} +${Date.now() - t0}ms`);

  const browser = await launchBrowser();
  mark("browser-launched");
  try {
    const page = await browser.newPage({
      viewport: { width: size.width, height: size.height },
      deviceScaleFactor: scale,
    });
    // "load" (not "networkidle"): the aura background is a continuously-animating
    // WebGL iframe, so network-idle buys nothing here — we rely on the explicit
    // settle below. It also stops a slow subresource (Google Fonts) from padding
    // the wait on the Lambda.
    await page.setContent(html, { waitUntil: "load", timeout: 30_000 });
    mark("content-loaded");

    // Best-effort font wait, capped: document.fonts.ready can stay pending forever
    // if a webfont never settles (the .catch only handles rejection, not a
    // never-resolving promise), which would hang the whole invocation until Vercel
    // kills it with FUNCTION_INVOCATION_TIMEOUT. Cap it and render with fallbacks.
    await Promise.race([
      page.evaluate(() => (document as Document).fonts.ready),
      page.waitForTimeout(5_000),
    ]).catch(() => {});
    mark("fonts-ready");

    // Give the aura canvas a moment to warm up into a vivid frame.
    await page.waitForTimeout(settleMs);
    mark("settled");

    const el = await page.$("#header");
    const png = (el
      ? await el.screenshot({ type: "png" })
      : await page.screenshot({ type: "png" })) as Buffer;
    mark("screenshot");

    if (format === "webp") {
      // Lazy import so the PNG path (and the Next build) never hard-depends on
      // sharp's native binary.
      const sharp = (await import("sharp")).default;
      const webp = await sharp(png).webp({ quality }).toBuffer();
      mark("encoded-webp");
      return webp;
    }
    return png;
  } finally {
    await browser.close();
    mark("browser-closed");
  }
}
