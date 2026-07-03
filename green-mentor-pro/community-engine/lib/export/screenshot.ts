// Shared headless-browser screenshot infrastructure.
//
// We use Playwright (not client-side canvas capture) precisely BECAUSE the
// backgrounds are cross-origin aura iframes: client capture taints on
// cross-origin frames, but a real browser screenshot captures the composited
// pixels — the genuine animated aura included.
//
// Two consumers:
//   • lib/header/screenshot.ts   — renders a self-contained HTML string (setContent)
//   • app/api/share-cards/export — points the browser at /share-cards/render (goto)

/**
 * Launch a headless Chromium that works both locally and on serverless (Vercel).
 *
 * Locally (and for the CLI render script) we use the full `playwright` package
 * and the Chromium it downloaded via `npx playwright install`. On Vercel / AWS
 * Lambda that binary doesn't exist and the filesystem is read-only, so we drive
 * a serverless-packaged Chromium from `@sparticuz/chromium` via `playwright-core`.
 */
export async function launchBrowser() {
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

/** Encode a PNG screenshot into the requested output format. Sharp is lazy-
 *  imported so the PNG path (and the Next build) never hard-depends on its
 *  native binary. */
export async function encodeImage(
  png: Buffer,
  format: ImageFormat,
  quality = 90
): Promise<Buffer> {
  if (format !== "webp") return png;
  const sharp = (await import("sharp")).default;
  return await sharp(png).webp({ quality }).toBuffer();
}

export type ScreenshotUrlOpts = {
  /** CSS selector of the element to screenshot (falls back to the viewport). */
  selector: string;
  /** Browser viewport in CSS pixels — the element's intrinsic render size. */
  viewport: { width: number; height: number };
  /** Pixel density multiplier: output px = CSS px × deviceScaleFactor. */
  deviceScaleFactor?: number;
  /** ms to let animations (the aura) + images settle before the shot. */
  settleMs?: number;
  format?: ImageFormat;
  /** WebP quality (1–100). Ignored for PNG. */
  quality?: number;
};

/**
 * Load a URL headlessly and screenshot one element. Waits for the document
 * `load` event, web fonts, every <img> decode, then a settle delay so the aura
 * iframe has warmed into a vivid frame.
 *
 * If @sparticuz/chromium's compositor ever hangs on very large stages, the
 * fallback is a raw-CDP `Page.captureScreenshot` with `captureBeyondViewport`
 * (see deconXpromad website/studio/lib/composition/screenshot.ts).
 */
export async function screenshotUrl(url: string, opts: ScreenshotUrlOpts): Promise<Buffer> {
  const {
    selector,
    viewport,
    deviceScaleFactor = 2,
    settleMs = 2600,
    format = "png",
    quality = 90,
  } = opts;

  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport, deviceScaleFactor });
    // Not `networkidle` — the aura iframe streams continuously and would stall it.
    await page.goto(url, { waitUntil: "load", timeout: 30_000 });
    try {
      await page.waitForSelector(selector, { timeout: 15_000 });
    } catch {
      // Say WHERE the browser actually landed — an auth wall / error page is
      // indistinguishable from a render bug in a bare selector timeout.
      const landedTitle = await page.title().catch(() => "?");
      const landedUrl = page.url();
      throw new Error(
        `render page never showed ${selector} — the headless browser landed on "${landedTitle}" (${landedUrl})`
      );
    }
    // Fonts + images in before we measure/paint the final frame. Both waits are
    // CAPPED: document.fonts.ready (and a stalled <img> decode) can stay pending
    // forever, which would hang the invocation until the platform kills it —
    // the exact FUNCTION_INVOCATION_TIMEOUT class of bug the header renderer hit.
    await Promise.race([
      page.evaluate(() => (document as Document).fonts.ready),
      page.waitForTimeout(5_000),
    ]).catch(() => {});
    await Promise.race([
      page.evaluate(() =>
        Promise.all(
          Array.from(document.images)
            .filter((img) => !img.complete)
            .map((img) => img.decode().catch(() => {}))
        )
      ),
      page.waitForTimeout(5_000),
    ]).catch(() => {});
    await page.waitForTimeout(settleMs);

    const el = await page.$(selector);
    const png = (el
      ? await el.screenshot({ type: "png" })
      : await page.screenshot({ type: "png" })) as Buffer;
    return await encodeImage(png, format, quality);
  } finally {
    await browser.close();
  }
}
