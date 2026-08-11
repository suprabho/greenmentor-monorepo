import type { SupabaseClient } from "@supabase/supabase-js";
import { screenshotUrl, type ImageFormat } from "@/lib/export/screenshot";
import { fetchShareCardArticles } from "./articles";
import { delHandoff, putHandoff } from "./handoff";
import {
  CARD_RENDER_SCALE,
  collectArticleIds,
  stageSizeFor,
  type ShareCardSnapshotV1,
} from "./types";

/**
 * Render a share-card snapshot to image bytes: resolve the snapshot's article
 * picks server-side, park { snapshot, data } in the export handoff, point a
 * headless browser at /share-cards/render?id=…, and screenshot #card-stage at
 * deviceScaleFactor 1/CARD_RENDER_SCALE — exactly the configured output pixels.
 *
 * Shared by the download export (app/api/share-cards/export) and the platform
 * publish route (app/api/share-cards/[id]/publish).
 */
export async function renderShareCard(
  supabase: SupabaseClient,
  snapshot: ShareCardSnapshotV1,
  opts: { origin: string; format?: ImageFormat }
): Promise<Buffer> {
  let handoffId: string | null = null;
  try {
    const ids = collectArticleIds(snapshot);
    const articles = ids.length > 0 ? await fetchShareCardArticles(supabase, { ids }) : [];
    handoffId = await putHandoff(supabase, { snapshot, data: { articles } });

    const size = stageSizeFor(snapshot.ratio);
    // Vercel Deployment Protection intercepts the headless browser's visit to
    // our own deployment URL (it has no session). When the project has
    // "Protection Bypass for Automation" enabled, Vercel injects this secret —
    // pass it as query params; the set-bypass-cookie flag covers the page's
    // JS/CSS subresource requests too.
    const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    const bypassParams = bypass
      ? `&x-vercel-protection-bypass=${encodeURIComponent(bypass)}&x-vercel-set-bypass-cookie=true`
      : "";
    return await screenshotUrl(
      `${opts.origin}/share-cards/render?id=${encodeURIComponent(handoffId)}${bypassParams}`,
      {
        selector: "#card-stage",
        viewport: { width: size.w, height: size.h },
        deviceScaleFactor: 1 / CARD_RENDER_SCALE,
        // The aura needs time to warm into a vivid frame; flat/image cards don't.
        settleMs: snapshot.frame.background.type === "aura" ? 2600 : 1200,
        format: opts.format ?? "png",
      }
    );
  } finally {
    if (handoffId) await delHandoff(supabase, handoffId).catch(() => {});
  }
}

/** Actionable hints for the most common render-setup gaps, appended to the
 *  raw error message the routes return. */
export function renderErrorHint(msg: string): string {
  if (/community_share_card_exports/i.test(msg)) {
    return " — the export handoff table is missing: apply supabase/migrations/0003_share_card_export_handoff.sql in the Supabase SQL editor.";
  }
  if (/never showed|waitForSelector/i.test(msg) && process.env.VERCEL_ENV) {
    return " — likely Vercel Deployment Protection blocking the headless browser: enable 'Protection Bypass for Automation' in the Vercel project settings (adds VERCEL_AUTOMATION_BYPASS_SECRET) and redeploy.";
  }
  if (/Executable doesn't exist|launch/i.test(msg)) {
    return " — run `npx playwright install chromium` in green-mentor-pro/community-engine.";
  }
  return "";
}
