import { isAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { type ImageFormat } from "@/lib/export/screenshot";
import { renderErrorHint, renderShareCard } from "@/lib/share-cards/renderCard";
import { normalizeSnapshot } from "@/lib/share-cards/types";

// Playwright needs the Node runtime (not Edge) and time to drive a browser.
export const runtime = "nodejs";
// The header export learned this the hard way (#68): a software-WebGL aura render
// on the GPU-less Lambda can overrun 60s, and this route does strictly more work
// (a full Next page load + hydration before the settle). Pro allows 300s; it's a
// ceiling, not a cost. Follow-up: extend the Fly render service to shoot URLs and
// proxy this route to it like the header export does.
export const maxDuration = 300;

/**
 * Render a share card to PNG/WebP and stream the bytes back as a download.
 * The render pipeline itself (handoff → headless browser → screenshot) lives
 * in lib/share-cards/renderCard.ts, shared with the publish route.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.email)) {
    return new Response("Not authorized", { status: 403 });
  }

  let raw: unknown;
  let format: ImageFormat = "png";
  try {
    const body = await req.json();
    raw = body?.snapshot;
    if (body?.format === "webp") format = "webp";
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const snapshot = normalizeSnapshot(raw);
  if (snapshot.foreground.length === 0) {
    return new Response("Add at least one layer before exporting", { status: 400 });
  }

  try {
    const origin = new URL(req.url).origin;
    const buf = await renderShareCard(supabase, snapshot, { origin, format });

    const contentType = format === "webp" ? "image/webp" : "image/png";
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="share-card-${snapshot.ratio.replace(":", "x")}.${format}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const msg = (e as Error).message ?? "render failed";
    return new Response(`Export failed: ${msg}${renderErrorHint(msg)}`, { status: 500 });
  }
}
