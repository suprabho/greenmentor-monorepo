/**
 * Outline — step 2 of the compose pipeline. One Claude call turns the chosen
 * angle into an ordered list of section stubs; the admin edits/reorders/
 * accepts them via PATCH before drafting. No lint/retry pass (vismay has one
 * for its much larger section taxonomy — scoped out here).
 */

import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/auth/apiGate";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { getStory, updateStory, type ComposeOutlineEntry } from "@/lib/db/stories";
import { listStorySources } from "@/lib/db/story-sources";
import { buildSourcesContext } from "@/lib/stories/compose";

export const runtime = "nodejs";
export const maxDuration = 60;

const inputSchema: Anthropic.Messages.Tool["input_schema"] = {
  type: "object",
  additionalProperties: false,
  properties: {
    outline: {
      type: "array",
      description: "Exactly 3 to 8 sections.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string", description: "Stable kebab-case id for this section." },
          heading: { type: "string", description: "Section heading — will render as an H2." },
          intent: { type: "string", description: "One sentence: what this section should accomplish." },
          kind: {
            type: "string",
            enum: ["prose", "chart"],
            description: "'chart' only if the sources contain numeric data suited to a simple bar/line chart; otherwise 'prose'.",
          },
        },
        required: ["id", "heading", "intent", "kind"],
      },
    },
  },
  required: ["outline"],
};

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApiUser();
  if ("error" in gate) return gate.error;
  const { id } = await params;

  if (!isServiceRoleConfigured()) return NextResponse.json({ ok: true, mode: "unconfigured" });
  const client = createAdminClient();

  const story = await getStory(client, id);
  if (!story) return NextResponse.json({ error: "story not found" }, { status: 404 });

  const { chosenAngleId, angles } = story.compose_state;
  const angle = angles.find((a) => a.id === chosenAngleId);
  if (!angle) return NextResponse.json({ error: "select an angle first" }, { status: 400 });

  const sources = await listStorySources(client, id);

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set server-side" }, { status: 500 });
  }

  const system = `You are an editorial strategist for GreenMentor, a sustainability brand. Given a "${story.content_type}" piece titled "${story.title}" pursuing the angle "${angle.title}" (thesis: ${angle.thesis}), propose an ordered outline of 3-8 sections that builds the case. Ground every section in the source material below — do not invent facts. Call propose_outline.`;

  const sourcesContext = buildSourcesContext(sources);

  try {
    const anthropic = new Anthropic();
    const message = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 2048,
      system,
      tools: [
        {
          name: "propose_outline",
          description: "Return the proposed section outline.",
          strict: true,
          input_schema: inputSchema,
        },
      ],
      tool_choice: { type: "tool", name: "propose_outline" },
      messages: [{ role: "user", content: sourcesContext }],
    });

    const toolUse = message.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return NextResponse.json({ error: "Model did not return an outline" }, { status: 502 });
    }

    const { outline } = toolUse.input as {
      outline: Array<Pick<ComposeOutlineEntry, "id" | "heading" | "intent" | "kind">>;
    };
    const compose_state = {
      ...story.compose_state,
      phase: "outline" as const,
      outline: outline.map((e, i) => ({ ...e, order: i, accepted: true })),
    };
    await updateStory(client, id, { compose_state });
    return NextResponse.json({ ok: true, compose_state });
  } catch (e) {
    return NextResponse.json({ error: `Outline generation failed: ${(e as Error).message}` }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApiUser();
  if ("error" in gate) return gate.error;
  const { id } = await params;

  if (!isServiceRoleConfigured()) return NextResponse.json({ ok: true, mode: "unconfigured" });
  const client = createAdminClient();

  const story = await getStory(client, id);
  if (!story) return NextResponse.json({ error: "story not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { outline?: ComposeOutlineEntry[] };
  const outline = body.outline;
  if (!Array.isArray(outline) || outline.length === 0) {
    return NextResponse.json({ error: "outline must be a non-empty array" }, { status: 400 });
  }
  if (!outline.some((e) => e.accepted)) {
    return NextResponse.json({ error: "at least one section must be accepted" }, { status: 400 });
  }

  const compose_state = { ...story.compose_state, outline };
  await updateStory(client, id, { compose_state });
  return NextResponse.json({ ok: true, compose_state });
}
