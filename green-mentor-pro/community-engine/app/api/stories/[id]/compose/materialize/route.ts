/**
 * Compose stage 3.5 (engine 2) — materialize accepted outline entries into
 * real story sections, then advance to the CONTENT phase. Adapted from
 * vismay admin's materialize route to CE's single-row storage:
 *
 * - Incremental: only accepted entries WITHOUT a sectionId are appended, so
 *   re-runs pick up stragglers without duplicating sections.
 * - First run on a template-seeded draft rebuilds from a clean base
 *   (frontmatter + config defaults, dropping the template's placeholder
 *   sections); later runs append onto the story as-is.
 * - Each appended section gets an empty regions-form foreground placeholder;
 *   the CONTENT/VISUAL passes fill it. applyGmBandRhythm then stamps the
 *   gm:surface band per section.
 * - The write is a CAS update over (body_markdown, config_json) so a
 *   concurrent section write can't be clobbered.
 */

import { NextResponse } from "next/server";
import { appendStorySection } from "@vismay/content-source/storySection";
import { applyGmBandRhythm } from "@gm/story-vertical";
import { requireAdminApiUser } from "@/lib/auth/apiGate";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { casUpdateStoryFiles, getStory, updateStory } from "@/lib/db/stories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApiUser();
  if ("error" in gate) return gate.error;
  const { id } = await params;

  if (!isServiceRoleConfigured()) return NextResponse.json({ ok: true, mode: "unconfigured" });
  const client = createAdminClient();

  const story = await getStory(client, id);
  if (!story) return NextResponse.json({ error: "story not found" }, { status: 404 });
  if (story.body_format !== "vismay" || !story.body_markdown || !story.config_json) {
    return NextResponse.json({ error: "not a web story" }, { status: 400 });
  }

  const state = story.compose_state;
  const accepted = state.outline.filter((e) => e.accepted && !e.sectionId);
  if (accepted.length === 0) {
    return NextResponse.json(
      { error: "accept at least one new outline section first" },
      { status: 400 }
    );
  }

  // Base: first materialize on a seeded draft keeps only frontmatter +
  // defaults (drops the template placeholders); re-runs append in place.
  const alreadyMaterialized = state.outline.some((e) => e.sectionId);
  let md: string;
  let cfg: string;
  if (alreadyMaterialized) {
    md = story.body_markdown;
    cfg = story.config_json;
  } else {
    const fmMatch = story.body_markdown.match(/^---\n([\s\S]*?)\n---\n?/);
    md = fmMatch ? `---\n${fmMatch[1]}\n---\n` : "";
    const cfgObj = JSON.parse(story.config_json) as { defaults?: unknown };
    cfg = JSON.stringify({ defaults: cfgObj.defaults ?? {} }, null, 2) + "\n";
  }

  const nextOutline = state.outline.map((e) => ({ ...e }));
  for (const entry of accepted) {
    const r = appendStorySection(
      md,
      cfg,
      {
        heading: entry.heading,
        paragraphs: [entry.intent || ""],
        kind: entry.kind,
        // Empty regions-form placeholder — the VISUAL pass fills `default`.
        body: { foreground: { layout: "free", regions: { default: [] as unknown[] } } },
      },
      "json"
    );
    md = r.markdown;
    cfg = r.configYaml;
    const idx = nextOutline.findIndex((e) => e.id === entry.id);
    if (idx >= 0) nextOutline[idx].sectionId = r.id;
  }

  // Stamp the corpus band rhythm (gm:surface per section, regions form).
  cfg = JSON.stringify(applyGmBandRhythm(JSON.parse(cfg)), null, 2);

  const nextVersion = await casUpdateStoryFiles(
    client,
    id,
    { body_markdown: md, config_json: cfg },
    story.updated_at
  );
  if (nextVersion === null) {
    return NextResponse.json(
      { error: "story changed while materializing — reload and retry" },
      { status: 409 }
    );
  }

  const compose_state = {
    ...state,
    outline: nextOutline,
    phase: state.phase === "outline" ? ("content" as const) : state.phase,
  };
  await updateStory(client, id, { compose_state });

  return NextResponse.json({ ok: true, compose_state, materialized: accepted.length });
}
