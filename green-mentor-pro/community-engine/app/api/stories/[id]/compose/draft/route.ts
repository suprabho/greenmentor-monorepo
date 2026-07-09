/**
 * Draft — step 3 of the compose pipeline. One Claude call writes the full
 * story body from the accepted outline sections, grounded in the sources.
 * Regenerates the whole body_markdown in one shot rather than per-section
 * (vismay does per-section with compare-and-set writes for concurrent
 * generation — unneeded here since one admin edits one story at a time).
 */

import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/auth/apiGate";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { getStory, updateStory } from "@/lib/db/stories";
import { listStorySources } from "@/lib/db/story-sources";
import { buildSourcesContext } from "@/lib/stories/compose";
import { HOUSE_STYLE_EXEMPLAR } from "@/lib/stories/fewshot";

export const runtime = "nodejs";
export const maxDuration = 90;

const inputSchema: Anthropic.Messages.Tool["input_schema"] = {
  type: "object",
  additionalProperties: false,
  properties: {
    body_markdown: {
      type: "string",
      description:
        "Full story body in Markdown, following the outline section-for-section, in order. Rules:\n" +
        '- Normal section: one "## <Heading>" then 2-4 short prose paragraphs. Inline emphasis allowed: **bold**, *italic*, and [text](https://real-url). Put lists inside a story:callout block, never as raw "- " markdown. Separate major parts with a line that is only "---".\n' +
        '- kind "hero" (only the first section, if any): emit ONLY a ```story:hero fence (NO "## heading"), JSON {"eyebrow"?:string,"title":string,"subtitle"?:string,"theme"?:"teal"|"green"|"ink"}.\n' +
        '- kind "chart": prose, then exactly one ```story:chart fence, JSON {"title":string,"chartType":"bar"|"line","categories":string[],"series":[{"name":string,"values":number[]}]} built ONLY from numbers present in the sources — omit the chart (prose only) if the sources lack real numbers; never invent data.\n' +
        '- kind "callout": prose, then one ```story:callout fence, JSON {"title"?:string,"items":string[],"ordered"?:boolean} — ordered:true for a numbered "practitioner summary".\n' +
        '- Anywhere it strengthens the piece you MAY add a ```story:pullquote fence, JSON {"text":string,"attribution"?:string}, or a ```story:cta fence, JSON {"label":string,"href":string} (href must be a real URL from the sources — never invent one).\n' +
        "Every fenced block contains ONLY minified JSON. Do not include a top-level H1 (the title renders separately) and do not use any other or unlabelled fenced code blocks.",
    },
  },
  required: ["body_markdown"],
};

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApiUser();
  if ("error" in gate) return gate.error;
  const { id } = await params;

  if (!isServiceRoleConfigured()) return NextResponse.json({ ok: true, mode: "unconfigured" });
  const client = createAdminClient();

  const story = await getStory(client, id);
  if (!story) return NextResponse.json({ error: "story not found" }, { status: 404 });

  const { chosenAngleId, angles, outline, brief } = story.compose_state;
  const angle = angles.find((a) => a.id === chosenAngleId);
  const accepted = outline.filter((e) => e.accepted).sort((a, b) => a.order - b.order);
  if (accepted.length === 0) {
    return NextResponse.json({ error: "accept at least one outline section before drafting" }, { status: 400 });
  }

  const sources = await listStorySources(client, id);

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set server-side" }, { status: 500 });
  }

  const outlineList = accepted
    .map((e, i) => `${i + 1}. [${e.kind}] ${e.heading} — ${e.intent}`)
    .join("\n");

  const system = `You are a staff writer for GreenMentor, a sustainability brand. Voice: plain, credible, no hype. Write the full body for a "${story.content_type}" titled "${story.title}"${
    angle ? `, pursuing the angle "${angle.title}" (thesis: ${angle.thesis})` : ""
  }. Only state facts present in the sources below — never fabricate statistics, quotes, or named people. Follow this outline section-for-section, in order:\n${outlineList}${
    brief ? `\n\nAuthor's steer: ${brief}` : ""
  }\n\nEmulate the structure and tone of this GreenMentor house-style example — mirror its voice and block usage, but do NOT copy its content (it is illustrative only):\n${HOUSE_STYLE_EXEMPLAR}\n\nCall write_draft.`;

  const sourcesContext = buildSourcesContext(sources);

  try {
    const anthropic = new Anthropic();
    const message = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 8192,
      system,
      tools: [
        {
          name: "write_draft",
          description: "Return the drafted story body.",
          strict: true,
          input_schema: inputSchema,
        },
      ],
      tool_choice: { type: "tool", name: "write_draft" },
      messages: [{ role: "user", content: sourcesContext }],
    });

    const toolUse = message.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return NextResponse.json({ error: "Model did not return a draft" }, { status: 502 });
    }

    const { body_markdown } = toolUse.input as { body_markdown: string };
    const compose_state = { ...story.compose_state, phase: "drafted" as const };
    await updateStory(client, id, { body_markdown, compose_state });
    return NextResponse.json({ ok: true, body_markdown, compose_state });
  } catch (e) {
    return NextResponse.json({ error: `Draft generation failed: ${(e as Error).message}` }, { status: 500 });
  }
}
