/**
 * POST → serialize this story's body_markdown into Substack-friendly HTML.
 * Rasterizes the hero/chart blocks to hosted PNGs along the way (needs the
 * story-assets bucket — migration 0015), so it runs on the Node runtime with a
 * generous budget like the other render routes. Admin-allowlist gated; reads
 * through the service-role client.
 */
import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/auth/apiGate";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { getStory } from "@/lib/db/stories";
import { storyBlocksToSubstackHtml } from "@/lib/stories/serializeSubstack";

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
  const body = (await req.json().catch(() => ({}))) as { body_markdown?: string };
  const markdown = (body.body_markdown ?? story.body_markdown ?? "").trim();
  if (!markdown) {
    return NextResponse.json({ error: "draft a body before exporting" }, { status: 400 });
  }

  try {
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
