/**
 * Recap topic selection — the step between attaching a weekly recap and
 * generating angles. Picking ONE of the recap's topics:
 *   1. attaches that topic's grounding sources as real story_sources (feed
 *      articles via the pipeline path, curated URLs via the guarded link
 *      path), deduped by url against what's already attached — generation
 *      clips each source, so the chosen topic's material must be first-class
 *      sources rather than buried in the condensed recap text;
 *   2. snapshots the topic into compose_state (recapTopicId/recapTopic) so the
 *      angles route derives a topic steer from compose_state alone — the steer
 *      survives "Generate angles" re-clicks, which send only {model};
 *   3. resets angles/outline — angles steered by a different topic are
 *      meaningless, mirroring the regenerate semantics.
 *
 * This is deliberately a separate POST from /angles: the source fetches have
 * independent failure modes (a dead curated URL becomes a visible failed row,
 * never a lost LLM call), and the UI chains the two so it feels like one action.
 */

import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/auth/apiGate";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { getStory, updateStory } from "@/lib/db/stories";
import { listStorySources } from "@/lib/db/story-sources";
import { getRecap } from "@/lib/db/recaps";
import { attachLinkSource, attachPipelineArticleSource } from "@/lib/stories/attach-sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A topic can carry a few curated URLs that need live guarded fetches.
export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApiUser();
  if ("error" in gate) return gate.error;
  const { id } = await params;

  if (!isServiceRoleConfigured()) return NextResponse.json({ ok: true, mode: "unconfigured" });
  const client = createAdminClient();

  const story = await getStory(client, id);
  if (!story) return NextResponse.json({ error: "story not found" }, { status: 404 });

  const recapId = story.compose_state.recapId;
  if (!recapId) {
    return NextResponse.json({ error: "attach a recap source before picking a topic" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as { recapTopicId?: string };
  const recapTopicId = body.recapTopicId?.trim();
  if (!recapTopicId) return NextResponse.json({ error: "recapTopicId is required" }, { status: 400 });

  const recap = await getRecap(client, recapId);
  if (!recap) return NextResponse.json({ error: "attached recap no longer exists" }, { status: 404 });

  const topic = recap.topics.find((t) => t.id === recapTopicId);
  if (!topic) {
    return NextResponse.json({ error: "recapTopicId not found in the attached recap" }, { status: 400 });
  }

  // Attach the topic's grounding sources, skipping urls already present (a
  // re-pick or an overlapping topic must not duplicate rows).
  const existing = await listStorySources(client, id);
  const existingUrls = new Set(existing.map((s) => s.url).filter(Boolean));
  for (const ref of topic.sourceRefs) {
    if (existingUrls.has(ref.url)) continue;
    existingUrls.add(ref.url);
    if (ref.type === "article") {
      // A since-deleted article just doesn't attach; the recap keeps its ref.
      await attachPipelineArticleSource(client, id, ref.id);
    } else {
      await attachLinkSource(client, id, ref.url, ref.title);
    }
  }

  const compose_state = {
    ...story.compose_state,
    recapTopicId,
    recapTopic: {
      id: topic.id,
      title: topic.title,
      category: topic.category,
      summary: topic.summary,
      keyFacts: topic.keyFacts,
    },
    angles: [],
    chosenAngleId: null,
    outline: [],
  };
  await updateStory(client, id, { compose_state });

  const sources = await listStorySources(client, id);
  return NextResponse.json({ ok: true, compose_state, sources });
}
