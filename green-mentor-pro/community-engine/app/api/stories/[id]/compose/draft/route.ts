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

export const runtime = "nodejs";
export const maxDuration = 90;

const inputSchema: Anthropic.Messages.Tool["input_schema"] = {
  type: "object",
  additionalProperties: false,
  properties: {
    body_markdown: {
      type: "string",
      description:
        'Full story body in Markdown. Emit one "## <Heading>" per accepted outline section, in the given order, each followed by 2-4 short prose paragraphs (no bullet or numbered lists — plain paragraphs only). For a section whose kind is "chart", follow its prose with exactly one fenced ```story:chart block containing ONLY minified JSON matching {"title":string,"chartType":"bar"|"line","categories":string[],"series":[{"name":string,"values":number[]}]} built from numbers actually present in the sources — omit the chart entirely (plain prose only) if the sources don\'t support real numbers, never invent data. Do not include a top-level H1 (the story title renders separately) and do not use any other fenced code blocks.',
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
  }\n\nCall write_draft.`;

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
