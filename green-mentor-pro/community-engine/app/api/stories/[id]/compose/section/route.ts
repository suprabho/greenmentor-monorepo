/**
 * Per-section generation (engine 2) — the CONTENT pass writes a section's
 * markdown prose, the VISUAL pass writes its config body (constrained by the
 * gm module schemas via the GreenMentor pack), 'combined' runs both.
 *
 * Body: { entryId: string, pass?: 'content' | 'visual' | 'combined',
 *         feedback?: string }.
 *
 * Concurrency: the panel allows parallel section generations over CE's
 * single-row storage, so writes go through casUpdateStoryFiles (markdown +
 * config must move together or anchors and bodies de-sync). Generation runs
 * ONCE, outside the write loop — its result is section-local (this section's
 * prose paragraphs + this section's config body), so on a CAS conflict we
 * re-read the fresh documents and RE-APPLY the already-generated result
 * instead of regenerating. That keeps conflict retries at milliseconds;
 * regenerating inside the loop made N parallel sections burn 2 model calls
 * per lost race and time out into 409s.
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
import {
  applyGmBandRhythm,
  completeGmCoverBody,
  isGmForegroundType,
} from "@gm/story-vertical";
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

/** Re-apply attempts after a CAS conflict. Application is cheap (no model
 *  calls), so N parallel section writers settle within a few rounds. */
const MAX_APPLY_RETRIES = 6;

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

  // ── Phase 1: generate (expensive, exactly once) ─────────────────────────
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

  const refine = feedback ? { feedback, previous: undefined } : undefined;
  /** Section-local generation results, applied (and re-applied) below. */
  let draftParagraphs: string[] | null = null;
  let sectionBody: Record<string, unknown> | null = null;

  try {
    let content = {
      heading: entry.heading,
      paragraphs: readMarkdownProse(story.body_markdown, anchor),
      kind: entry.kind,
    };

    if (pass === "content" || pass === "combined") {
      const draft = await generateSectionContent(ctx, {
        pack: GREENMENTOR_PACK,
        ...(refine ? { refine: { feedback: refine.feedback, previous: content } } : {}),
      });
      draftParagraphs = draft.paragraphs;
      content = { heading: entry.heading, paragraphs: draft.paragraphs, kind: draft.kind };
    }

    if (pass === "visual" || pass === "combined") {
      let visual = await generateSectionVisual(ctx, content, {
        pack: GREENMENTOR_PACK,
        ...(refine && pass === "visual"
          ? { refine: { feedback: refine.feedback, previous: undefined } }
          : {}),
      });
      // Two failure classes get ONE corrective retry each; a persistent
      // miss still lands and surfaces as a lint warning on save.
      //
      // 1. Core-layer leakage: the pipeline's schema legally admits
      //    vismay's core layer types (text, bigStat, quote, …) next to the
      //    gm modules, but those render outside the GreenMentor design
      //    language.
      // 2. Empty visual: the model sometimes emits only section-level
      //    fields (kind/layout) with no foreground layers at all — the
      //    band then renders blank.
      const isCover = entry.kind === "hero" || entry.kind === "cover";
      const layerTypes = visualBodyLayerTypes(visual.body as Record<string, unknown>);
      const offBrand = layerTypes.filter((t) => !isGmForegroundType(t));
      const plannedChart =
        "stub" in ctx && ctx.stub && typeof ctx.stub.chartId === "string"
          ? ctx.stub.chartId
          : undefined;
      if (offBrand.length > 0 || (layerTypes.length === 0 && !isCover)) {
        const feedback =
          offBrand.length > 0
            ? `Your previous body used core layer type(s) ${offBrand.join(", ")}, ` +
              "which render outside the GreenMentor design language. Rebuild the " +
              "body using ONLY gm:* vertical modules (plus 'chart' when the outline " +
              "plans one) — choose the gm module that fits this content."
            : "Your previous body had NO foreground layers, so the slide renders " +
              "blank. Emit exactly one gm:* vertical module in the foreground " +
              "that carries this section's content" +
              (plannedChart
                ? `, or a chart layer referencing the planned chart id "${plannedChart}"`
                : "") +
              ".";
        visual = await generateSectionVisual(ctx, content, {
          pack: GREENMENTOR_PACK,
          refine: { feedback, previous: undefined },
        });
      }
      // GM covers complete deterministically: map the authored eyebrow/dek
      // cover surface into a gm:hero band (the core prompt forbids the
      // model from authoring cover foreground layers).
      let body = visual.body as Record<string, unknown>;
      if (isCover) {
        body = completeGmCoverBody(body, { heading: entry.heading });
      } else if (visualBodyLayerTypes(body).length === 0 && plannedChart) {
        // Still empty after the corrective retry, but the outline planned a
        // chart whose data is generated independently — reference it
        // deterministically rather than shipping a blank band.
        const { layout: _layout, ...rest } = body;
        body = {
          ...rest,
          foreground: {
            layout: "free",
            regions: { default: [{ type: "chart", id: plannedChart }] },
          },
        };
      }
      sectionBody = body;
    }
  } catch (e) {
    return NextResponse.json(
      { error: `Section generation failed: ${(e as Error).message}` },
      { status: 502 }
    );
  }

  // ── Phase 2: apply + CAS write (cheap, retried) ─────────────────────────
  // On a conflict another section's write landed between our read and ours;
  // re-read the fresh documents and splice this section's result into them.
  let expectedUpdatedAt = story.updated_at;
  let freshMd = story.body_markdown;
  let freshCfg = story.config_json;
  for (let attempt = 0; attempt < MAX_APPLY_RETRIES; attempt++) {
    if (attempt > 0) {
      // Small jittered backoff so N parallel writers fan out.
      await new Promise((r) => setTimeout(r, 75 * attempt + Math.random() * 75));
      const fresh = await getStory(client, id);
      if (!fresh?.body_markdown || !fresh.config_json) {
        return NextResponse.json({ error: "story disappeared mid-write" }, { status: 409 });
      }
      expectedUpdatedAt = fresh.updated_at;
      freshMd = fresh.body_markdown;
      freshCfg = fresh.config_json;
    }

    const freshAnchor = sectionAnchor(freshCfg, entry.sectionId) ?? anchor;
    let md = freshMd;
    let cfg = freshCfg;
    if (draftParagraphs) {
      if (!hasMarkdownSection(md, freshAnchor)) {
        return NextResponse.json(
          {
            error:
              `markdown heading "${freshAnchor}" vanished while generating — ` +
              "the section was edited concurrently; reload and retry",
          },
          { status: 409 }
        );
      }
      md = replaceMarkdownProse(md, freshAnchor, draftParagraphs);
    }
    if (sectionBody) {
      try {
        cfg = replaceConfigBody(cfg, entry.sectionId, sectionBody);
      } catch {
        return NextResponse.json(
          { error: "section disappeared from the config while generating — reload and retry" },
          { status: 409 }
        );
      }
      // Re-stamp the band + regions form (idempotent for untouched sections).
      cfg = JSON.stringify(applyGmBandRhythm(JSON.parse(cfg)), null, 2);
    }

    const next = await casUpdateStoryFiles(
      client,
      id,
      { body_markdown: md, config_json: cfg },
      expectedUpdatedAt
    );
    if (next !== null) {
      return NextResponse.json({ ok: true, entryId: entry.id, pass });
    }
  }

  return NextResponse.json(
    { error: "story kept changing while saving the generated section — retry" },
    { status: 409 }
  );
}
