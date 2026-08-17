/**
 * Per-section generation (engine 2) — the CONTENT pass writes a section's
 * markdown prose, the VISUAL pass writes its config body (constrained by the
 * gm module schemas via the GreenMentor pack), 'combined' runs both.
 *
 * Body: { entryId: string, pass?: 'content' | 'visual' | 'combined',
 *         feedback?: string }.
 *
 * Writes go through casUpdateStoryFiles with a small retry loop: the panel
 * allows concurrent section generations, and markdown + config must move
 * together or anchors and bodies de-sync.
 */

import { NextResponse } from "next/server";
import {
  generateSectionContent,
  generateSectionVisual,
  type ComposeAnswers,
  type ResearchBrief,
  type SectionContext,
  type StoryOutline,
} from "@vismay/story-pipeline";
import { GREENMENTOR_PACK } from "@gm/story-vertical/pack";
import { applyGmBandRhythm, isGmForegroundType } from "@gm/story-vertical";
import { requireAdminApiUser } from "@/lib/auth/apiGate";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { casUpdateStoryFiles, getStory, type StoryRow } from "@/lib/db/stories";
import { listStorySources } from "@/lib/db/story-sources";
import {
  hasMarkdownSection,
  readMarkdownProse,
  replaceConfigBody,
  replaceMarkdownProse,
  sectionAnchor,
  storySourceRowsToDocs,
  visualBodyLayerTypes,
} from "@/lib/stories/pipeline-store";
import type { ComposeOutlineEntry } from "@/lib/db/stories";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

const MAX_CAS_RETRIES = 3;

function buildContext(
  story: StoryRow,
  entry: ComposeOutlineEntry,
  docs: ReturnType<typeof storySourceRowsToDocs>
): SectionContext | { error: string } {
  const outline = story.compose_state.storyOutline as StoryOutline | undefined;
  if (!outline) {
    return { error: "compose state has no pipeline outline — regenerate the outline" };
  }
  // Join by the index stamped at outline time; heading match is the fallback
  // for drafts outlined before pipelineIndex existed.
  const stub =
    (typeof entry.pipelineIndex === "number"
      ? outline.sections[entry.pipelineIndex]
      : undefined) ?? outline.sections.find((s) => s.heading === entry.heading);
  if (!stub) {
    return {
      error:
        `outline entry "${entry.heading}" has no matching pipeline stub — ` +
        "the heading was likely renamed after the outline was generated; " +
        "regenerate the outline to re-sync",
    };
  }
  const pb = story.compose_state.pipelineBrief;
  const brief: ResearchBrief = {
    summary: pb?.summary ?? "",
    keyFacts: pb?.keyFacts ?? [],
    entities: pb?.entities ?? [],
    suggestedFormat: "deck",
    candidateAngles: [],
    questions: [],
  };
  const angle = story.compose_state.angles.find(
    (a) => a.id === story.compose_state.chosenAngleId
  );
  const answers: ComposeAnswers = angle
    ? { "lead-angle": `${angle.title} — ${angle.thesis}` }
    : {};
  return { source: "outline", outline, stub, sources: docs, brief, answers };
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApiUser();
  if ("error" in gate) return gate.error;
  const { id } = await params;

  if (!isServiceRoleConfigured()) return NextResponse.json({ ok: true, mode: "unconfigured" });
  const client = createAdminClient();

  const body = (await req.json().catch(() => ({}))) as {
    entryId?: string;
    pass?: "content" | "visual" | "combined";
    feedback?: string;
  };
  const pass = body.pass ?? "combined";
  if (!body.entryId) return NextResponse.json({ error: "entryId is required" }, { status: 400 });
  const feedback = body.feedback?.trim();

  for (let attempt = 0; attempt < MAX_CAS_RETRIES; attempt++) {
    const story = await getStory(client, id);
    if (!story) return NextResponse.json({ error: "story not found" }, { status: 404 });
    if (story.body_format !== "vismay" || !story.body_markdown || !story.config_json) {
      return NextResponse.json({ error: "not a web story" }, { status: 400 });
    }
    const entry = story.compose_state.outline.find((e) => e.id === body.entryId);
    if (!entry) return NextResponse.json({ error: "outline entry not found" }, { status: 404 });
    if (!entry.sectionId) {
      return NextResponse.json({ error: "materialize the section first" }, { status: 400 });
    }

    const anchor = sectionAnchor(story.config_json, entry.sectionId) ?? entry.heading;
    if (!hasMarkdownSection(story.body_markdown, anchor)) {
      return NextResponse.json(
        {
          error:
            `markdown heading "${anchor}" not found — it was likely renamed in the ` +
            "document pane. Restore the heading (or update the section's `text` " +
            "anchor in the config) before regenerating, or the prose would be lost.",
        },
        { status: 409 }
      );
    }
    const sources = await listStorySources(client, id);
    const docs = storySourceRowsToDocs(sources);
    const ctx = buildContext(story, entry, docs);
    if ("error" in ctx) {
      return NextResponse.json({ error: ctx.error }, { status: 400 });
    }

    let md = story.body_markdown;
    let cfg = story.config_json;
    const refine = feedback ? { feedback, previous: undefined } : undefined;

    try {
      let content = {
        heading: entry.heading,
        paragraphs: readMarkdownProse(md, anchor),
        kind: entry.kind,
      };

      if (pass === "content" || pass === "combined") {
        const draft = await generateSectionContent(ctx, {
          pack: GREENMENTOR_PACK,
          ...(refine ? { refine: { feedback: refine.feedback, previous: content } } : {}),
        });
        md = replaceMarkdownProse(md, anchor, draft.paragraphs);
        content = { heading: entry.heading, paragraphs: draft.paragraphs, kind: draft.kind };
      }

      if (pass === "visual" || pass === "combined") {
        let visual = await generateSectionVisual(ctx, content, {
          pack: GREENMENTOR_PACK,
          ...(refine && pass === "visual"
            ? { refine: { feedback: refine.feedback, previous: undefined } }
            : {}),
        });
        // The pipeline's schema legally admits vismay's core layer types
        // (text, bigStat, quote, …) next to the gm modules, but those render
        // outside the GreenMentor design language. One corrective retry; a
        // persistent leak still lands and surfaces as a gm-layers-only lint
        // warning on save.
        const offBrand = visualBodyLayerTypes(
          visual.body as Record<string, unknown>
        ).filter((t) => !isGmForegroundType(t));
        if (offBrand.length > 0) {
          visual = await generateSectionVisual(ctx, content, {
            pack: GREENMENTOR_PACK,
            refine: {
              feedback:
                `Your previous body used core layer type(s) ${offBrand.join(", ")}, ` +
                "which render outside the GreenMentor design language. Rebuild the " +
                "body using ONLY gm:* vertical modules (plus 'chart' when the outline " +
                "plans one) — choose the gm module that fits this content.",
              previous: undefined,
            },
          });
        }
        cfg = replaceConfigBody(cfg, entry.sectionId, visual.body);
        // Re-stamp the band + regions form (idempotent for untouched sections).
        cfg = JSON.stringify(applyGmBandRhythm(JSON.parse(cfg)), null, 2);
      }
    } catch (e) {
      return NextResponse.json(
        { error: `Section generation failed: ${(e as Error).message}` },
        { status: 502 }
      );
    }

    const next = await casUpdateStoryFiles(
      client,
      id,
      { body_markdown: md, config_json: cfg },
      story.updated_at
    );
    if (next !== null) {
      return NextResponse.json({ ok: true, entryId: entry.id, pass });
    }
    // CAS conflict: another section landed between our read and write —
    // re-read and re-apply (the generation result is section-local, but we
    // regenerate rather than splice stale output into fresher documents).
  }

  return NextResponse.json(
    { error: "story kept changing during generation — retry" },
    { status: 409 }
  );
}
