/**
 * POST → import recent posts from a Substack publication's RSS feed as story
 * sources (one `kind: "link"` row per post, body reduced to plaintext), so a
 * draft can be grounded in — and match the voice of — the existing newsletter.
 * Defaults to the GreenMentor Substack; pass { url } to import another.
 *
 * Same admin-allowlist gate + service-role write as the other compose routes.
 */
import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/auth/apiGate";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { insertStorySource, type StorySourceRow } from "@/lib/db/story-sources";
import { fetchSubstackPosts, DEFAULT_SUBSTACK_FEED } from "@/lib/stories/substackFeed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApiUser();
  if ("error" in gate) return gate.error;
  const { id } = await params;

  if (!isServiceRoleConfigured()) return NextResponse.json({ ok: true, mode: "unconfigured" });
  const client = createAdminClient();

  const body = (await req.json().catch(() => ({}))) as { url?: string; limit?: number };
  const feedUrl = body.url?.trim() || DEFAULT_SUBSTACK_FEED;
  const limit = Math.min(Math.max(Number(body.limit) || 5, 1), 12);

  let posts;
  try {
    posts = await fetchSubstackPosts(feedUrl, limit);
  } catch (e) {
    return NextResponse.json({ error: `Substack fetch failed: ${(e as Error).message}` }, { status: 502 });
  }
  if (posts.length === 0) {
    return NextResponse.json({ error: "No posts found in that feed" }, { status: 404 });
  }

  const sources: StorySourceRow[] = [];
  for (const p of posts) {
    const source = await insertStorySource(client, {
      story_id: id,
      kind: "link",
      title: p.title,
      url: p.url,
      extracted_text: p.text || null,
      status: p.text ? "extracted" : "failed",
      error: p.text ? null : "No body text in feed",
    });
    sources.push(source);
  }
  return NextResponse.json({ ok: true, sources });
}
