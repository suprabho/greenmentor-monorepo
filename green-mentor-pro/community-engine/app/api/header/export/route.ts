import { renderHeader, type ImageFormat } from "@/lib/header/screenshot";
import { DEFAULT_CONFIG, type HeaderConfig } from "@/lib/header/types";

// Playwright needs the Node runtime (not Edge) and time to drive a browser.
export const runtime = "nodejs";
// Software-WebGL rendering on a GPU-less Lambda is CPU-heavy and, on a cold
// start, also pays chromium extraction. 60s wasn't enough (FUNCTION_INVOCATION_
// TIMEOUT); Pro allows up to 300s. This is a ceiling, not a cost — billing is on
// actual runtime — so it only bites a genuinely slow/hung render. Tune down once
// the [renderHeader] phase timings in the function logs show the real duration.
export const maxDuration = 300;

export async function POST(req: Request) {
  let config: HeaderConfig;
  let format: ImageFormat = "png";
  try {
    const body = await req.json();
    config = { ...DEFAULT_CONFIG, ...(body?.config ?? {}) };
    if (body?.format === "webp") format = "webp";
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  if (!config.title?.trim()) {
    return new Response("config.title is required", { status: 400 });
  }

  try {
    const origin = new URL(req.url).origin;
    const buf = await renderHeader(config, { origin, scale: 2, format });
    const contentType = format === "webp" ? "image/webp" : "image/png";
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="header-${config.sizeId}.${format}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const msg = (e as Error).message ?? "render failed";
    // Most common cause: Playwright browser binary not installed.
    const hint = /Executable doesn't exist|launch/i.test(msg)
      ? " — run `npx playwright install chromium` in green-mentor-pro/community-engine."
      : "";
    return new Response(`Export failed: ${msg}${hint}`, { status: 500 });
  }
}
