/**
 * Angles — step 1 of the compose pipeline. One Claude call proposes 3-5
 * distinct story angles grounded in the story's sources; the admin picks one
 * via PATCH. Regenerating angles resets chosenAngleId/outline — an outline
 * generated against a different angle is meaningless.
 */

import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/auth/apiGate";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { getStory, updateStory, type ComposeAngle } from "@/lib/db/stories";
import { listStorySources } from "@/lib/db/story-sources";
import { buildSourcesContext } from "@/lib/stories/compose";

export const runtime = "nodejs";
export const maxDuration = 60;

const inputSchema: Anthropic.Messages.Tool["input_schema"] = {
  type: "object",
  additionalProperties: false,
  properties: {
    angles: {
      type: "array",
      description: "Exactly 3 to 5 angles.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string", description: "Short kebab-case id, unique among these angles, e.g. 'smb-readiness'." },
          title: { type: "string", description: "Punchy angle title, under 80 chars." },
          thesis: { type: "string", description: "1-2 sentence core argument this angle would make." },
          rationale: { type: "string", description: "One sentence: why this angle fits the sources." },
        },
        required: ["id", "title", "thesis", "rationale"],
      },
    },
  },
  required: ["angles"],
};

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApiUser();
  if ("error" in gate) return gate.error;
  const { id } = await params;

  if (!isServiceRoleConfigured()) return NextResponse.json({ ok: true, mode: "unconfigured" });
  const client = createAdminClient();

  const story = await getStory(client, id);
  if (!story) return NextResponse.json({ error: "story not found" }, { status: 404 });

  const sources = await listStorySources(client, id);
  if (sources.length === 0) {
    return NextResponse.json({ error: "add at least one source before generating angles" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as { brief?: string };
  const brief = body.brief?.trim();

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set server-side" }, { status: 500 });
  }

  const system = `You are an editorial strategist for GreenMentor, a sustainability brand. Given a "${story.content_type}" piece titled "${story.title}" and the source material below, propose 3-5 distinct, non-overlapping angles a writer could take. Ground every angle in the sources — do not invent facts not present in them. Call propose_angles.${
    brief ? `\n\nAuthor's steer: ${brief}` : ""
  }`;

  const sourcesContext = buildSourcesContext(sources);

  try {
    const anthropic = new Anthropic();
    const message = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 2048,
      system,
      tools: [
        {
          name: "propose_angles",
          description: "Return the proposed story angles.",
          strict: true,
          input_schema: inputSchema,
        },
      ],
      tool_choice: { type: "tool", name: "propose_angles" },
      messages: [{ role: "user", content: sourcesContext }],
    });

    const toolUse = message.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return NextResponse.json({ error: "Model did not return angles" }, { status: 502 });
    }

    const { angles } = toolUse.input as { angles: ComposeAngle[] };
    const compose_state = {
      ...story.compose_state,
      phase: "angles" as const,
      angles,
      chosenAngleId: null,
      outline: [],
      brief: brief || story.compose_state.brief,
    };
    await updateStory(client, id, { compose_state });
    return NextResponse.json({ ok: true, compose_state });
  } catch (e) {
    return NextResponse.json({ error: `Angle generation failed: ${(e as Error).message}` }, { status: 500 });
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

  const body = (await req.json().catch(() => ({}))) as { chosenAngleId?: string };
  if (!body.chosenAngleId || !story.compose_state.angles.some((a) => a.id === body.chosenAngleId)) {
    return NextResponse.json({ error: "chosenAngleId not found among current angles" }, { status: 400 });
  }

  const compose_state = { ...story.compose_state, chosenAngleId: body.chosenAngleId };
  await updateStory(client, id, { compose_state });
  return NextResponse.json({ ok: true, compose_state });
}
