/**
 * Chart generation (engine 2). The outline declares chart REQUIREMENTS
 * (StoryOutline.charts); this route produces the DATA for one or all of
 * them, grounded strictly in the sources, and stores the GenericChart step
 * payload in community_story_charts — its own table so chart writes never
 * bump the story row's section-CAS token.
 *
 * Body: { chartId?: string, feedback?: string } — omit chartId to generate
 * every outstanding requirement.
 */

import { NextResponse } from "next/server";
import {
  buildChartData,
  generateChart,
  generateChartRequirement,
  type ChartRequirement,
  type ResearchBrief,
  type StoryOutline,
} from "@vismay/story-pipeline";
import { GREENMENTOR_PACK } from "@gm/story-vertical/pack";
import { requireAdminApiUser } from "@/lib/auth/apiGate";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { getStory } from "@/lib/db/stories";
import { listStorySources } from "@/lib/db/story-sources";
import { upsertStoryChart } from "@/lib/db/storyCharts";
import { storySourceRowsToDocs } from "@/lib/stories/pipeline-store";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApiUser();
  if ("error" in gate) return gate.error;
  const { id } = await params;

  if (!isServiceRoleConfigured()) return NextResponse.json({ ok: true, mode: "unconfigured" });
  const client = createAdminClient();

  const story = await getStory(client, id);
  if (!story) return NextResponse.json({ error: "story not found" }, { status: 404 });
  if (story.body_format !== "vismay") {
    return NextResponse.json({ error: "not a web story" }, { status: 400 });
  }

  const outline = story.compose_state.storyOutline as StoryOutline | undefined;
  const requirements = (outline?.charts ?? []) as ChartRequirement[];
  if (requirements.length === 0) {
    return NextResponse.json({ error: "the outline declares no charts" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as { chartId?: string; feedback?: string };
  const targets = body.chartId
    ? requirements.filter((r) => r.id === body.chartId)
    : requirements;
  if (targets.length === 0) {
    return NextResponse.json({ error: `unknown chartId: ${body.chartId}` }, { status: 400 });
  }

  const sources = await listStorySources(client, id);
  const docs = storySourceRowsToDocs(sources);
  const pb = story.compose_state.pipelineBrief;
  const brief: ResearchBrief = {
    summary: pb?.summary ?? "",
    keyFacts: pb?.keyFacts ?? [],
    entities: pb?.entities ?? [],
    suggestedFormat: "deck",
    candidateAngles: [],
    questions: [],
  };

  const generated: string[] = [];
  try {
    for (let requirement of targets) {
      if (body.feedback && body.chartId) {
        requirement = await generateChartRequirement(
          { requirement, brief, sources: docs },
          { pack: GREENMENTOR_PACK, feedback: body.feedback }
        );
      }
      const spec = await generateChart(
        { requirement, brief, sources: docs },
        { pack: GREENMENTOR_PACK }
      );
      await upsertStoryChart(client, id, requirement.id, buildChartData(spec));
      generated.push(requirement.id);
    }
  } catch (e) {
    return NextResponse.json(
      {
        error: `Chart generation failed: ${(e as Error).message}`,
        ...(generated.length ? { generated } : {}),
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, generated });
}
