/**
 * POST → serialize this story into Substack-friendly HTML.
 *
 * Works for BOTH body formats, which is the point: a scrollytelling story and a
 * newsletter are two outputs of one composition, not two things to write.
 *   - `blocks` → the original `story:*` fenced-block serializer.
 *   - `vismay` → the band walker, which rasterizes the cover / figure cards /
 *                charts and emits everything else as semantic markup.
 *
 * Rasterizing needs the story-assets bucket (migration 0015) and a browser, so this
 * runs on the Node runtime with a generous budget like the other render routes.
 * Admin-allowlist gated; reads through the service-role client.
 */
import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/auth/apiGate";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { getStory } from "@/lib/db/stories";
import { listStoryCharts } from "@/lib/db/storyCharts";
import { storyBlocksToSubstackHtml } from "@/lib/stories/serializeSubstack";
import { vismayStoryToSubstackHtml } from "@/lib/stories/serializeVismaySubstack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApiUser();
  if ("error" in gate) return gate.error;
  const { id } = await params;

  if (!isServiceRoleConfigured()) return NextResponse.json({ ok: true, mode: "unconfigured" });
  const client = createAdminClient();

  const story = await getStory(client, id);
  if (!story) return NextResponse.json({ error: "story not found" }, { status: 404 });

  // Prefer the body posted from the editor (unsaved edits included); fall back
  // to the persisted draft.
  const body = (await req.json().catch(() => ({}))) as {
    body_markdown?: string;
    config_json?: string;
  };
  const markdown = (body.body_markdown ?? story.body_markdown ?? "").trim();
  if (!markdown) {
    return NextResponse.json({ error: "draft a body before exporting" }, { status: 400 });
  }

  try {
    if (story.body_format === "vismay") {
      const configText = (body.config_json ?? story.config_json ?? "").trim();
      if (!configText) {
        return NextResponse.json({ error: "this story has no config yet" }, { status: 400 });
      }
      // Draft charts, not a publication snapshot: exporting is something an author
      // does while iterating, so it must reflect the charts they can currently see
      // in the preview.
      const chartRows = await listStoryCharts(client, id).catch(() => []);
      const charts: Record<string, unknown> = {};
      for (const row of chartRows) charts[row.chart_id] = row.data;

      const html = await vismayStoryToSubstackHtml({ storyId: id, markdown, configText, charts });
      return NextResponse.json({ ok: true, html });
    }

    const html = await storyBlocksToSubstackHtml(markdown, { storyId: id });
    return NextResponse.json({ ok: true, html });
  } catch (e) {
    const msg = (e as Error).message ?? "export failed";
    const hint = /Executable doesn't exist|launch/i.test(msg)
      ? " — run `npx playwright install chromium`."
      : "";
    return NextResponse.json({ error: `Export failed: ${msg}${hint}` }, { status: 500 });
  }
}
