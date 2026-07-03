import { renderHeader, type ImageFormat } from "@/lib/header/screenshot";
import { renderHeaderViaService, renderServiceConfigured } from "@/lib/header/remote";
import { DEFAULT_CONFIG, type HeaderConfig } from "@/lib/header/types";

// Node runtime (not Edge): the local-fallback path drives a browser, and the proxy
// path awaits the render service over fetch.
export const runtime = "nodejs";
// When HEADER_RENDER_URL is set, the heavy render happens on the warm Fly service
// and this route just proxies — but it stays alive awaiting that response, so it
// still needs headroom (bounded by the 120s fetch timeout in remote.ts). The local
// fallback renders in-process, which is CPU-heavy software WebGL. Pro allows 300s;
// it's a ceiling, not a cost (billing is on actual runtime).
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
    // Prefer the warm Fly render service; fall back to in-process Playwright when
    // it isn't configured (local dev).
    const buf = renderServiceConfigured()
      ? await renderHeaderViaService(config, { origin, scale: 2, format })
      : await renderHeader(config, { origin, scale: 2, format });
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
