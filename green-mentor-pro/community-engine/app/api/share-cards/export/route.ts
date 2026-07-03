import { isAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { screenshotUrl, type ImageFormat } from "@/lib/export/screenshot";
import { fetchShareCardArticles } from "@/lib/share-cards/articles";
import { delHandoff, putHandoff } from "@/lib/share-cards/handoff";
import {
  CARD_RENDER_SCALE,
  collectArticleIds,
  normalizeSnapshot,
  stageSizeFor,
} from "@/lib/share-cards/types";

// Playwright needs the Node runtime (not Edge) and time to drive a browser.
export const runtime = "nodejs";
// The header export learned this the hard way (#68): a software-WebGL aura render
// on the GPU-less Lambda can overrun 60s, and this route does strictly more work
// (a full Next page load + hydration before the settle). Pro allows 300s; it's a
// ceiling, not a cost. Follow-up: extend the Fly render service to shoot URLs and
// proxy this route to it like the header export does.
export const maxDuration = 300;

/**
 * Render a share card to PNG/WebP: resolve the snapshot's article picks
 * server-side, park { snapshot, data } in the export handoff, point a headless
 * browser at /share-cards/render?id=…, and screenshot #card-stage at
 * deviceScaleFactor 1/CARD_RENDER_SCALE — exactly the configured output pixels.
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

  let handoffId: string | null = null;
  try {
    const ids = collectArticleIds(snapshot);
    const articles = ids.length > 0 ? await fetchShareCardArticles(supabase, { ids }) : [];
    handoffId = await putHandoff(supabase, { snapshot, data: { articles } });

    const origin = new URL(req.url).origin;
    const size = stageSizeFor(snapshot.ratio);
    const buf = await screenshotUrl(
      `${origin}/share-cards/render?id=${encodeURIComponent(handoffId)}`,
      {
        selector: "#card-stage",
        viewport: { width: size.w, height: size.h },
        deviceScaleFactor: 1 / CARD_RENDER_SCALE,
        // The aura needs time to warm into a vivid frame; flat/image cards don't.
        settleMs: snapshot.frame.background.type === "aura" ? 2600 : 1200,
        format,
      }
    );

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
    // Actionable hints for the two most common setup gaps.
    let hint = "";
    if (/community_share_card_exports/i.test(msg)) {
      hint =
        " — the export handoff table is missing: apply supabase/migrations/0003_share_card_export_handoff.sql in the Supabase SQL editor.";
    } else if (/Executable doesn't exist|launch/i.test(msg)) {
      hint = " — run `npx playwright install chromium` in green-mentor-pro/community-engine.";
    }
    return new Response(`Export failed: ${msg}${hint}`, { status: 500 });
  } finally {
    if (handoffId) await delHandoff(supabase, handoffId).catch(() => {});
  }
}
