import { renderHeaderPng } from "@/lib/header/screenshot";
import { DEFAULT_CONFIG, type HeaderConfig } from "@/lib/header/types";

// Playwright needs the Node runtime (not Edge) and time to drive a browser.
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  let config: HeaderConfig;
  try {
    const body = await req.json();
    config = { ...DEFAULT_CONFIG, ...(body?.config ?? {}) };
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  if (!config.title?.trim()) {
    return new Response("config.title is required", { status: 400 });
  }

  try {
    const origin = new URL(req.url).origin;
    const png = await renderHeaderPng(config, { origin, scale: 2 });
    return new Response(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `inline; filename="header-${config.sizeId}.png"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const msg = (e as Error).message ?? "render failed";
    // Most common cause: Playwright browser binary not installed.
    const hint = /Executable doesn't exist|launch/i.test(msg)
      ? " — run `npx playwright install chromium` in green-mentor-pro/prototype."
      : "";
    return new Response(`Export failed: ${msg}${hint}`, { status: 500 });
  }
}
