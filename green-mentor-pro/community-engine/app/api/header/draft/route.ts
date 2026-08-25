import Anthropic from "@anthropic-ai/sdk";
import { fetchGreenMentorAuraScenes } from "@/lib/header/auraScenes";
import {
  AURA_PRESETS,
  BRAND_GREEN,
  SIZE_PRESETS,
  TEMPLATE_PRESETS,
  type AuraPreset,
  type HeaderConfig,
} from "@/lib/header/types";

// The SDK needs the Node runtime (not Edge). Drafting is one quick Haiku call.
export const runtime = "nodejs";
export const maxDuration = 30;

const DEFAULT_AURA_SLUG = AURA_PRESETS[0].slug;

/**
 * Turn a plain-English brief into a (partial) HeaderConfig using Claude Haiku.
 *
 * This is the in-app version of the `aura-header` skill's first step: parse the
 * brief, infer sensible defaults, and pick an on-brand aura. Everything after —
 * preview and PNG export — is the same renderer the studio already uses, so the
 * draft just seeds the editor state. Haiku returns the config via a strict tool
 * call, so the `input` is guaranteed to match the schema (no JSON parsing).
 */
export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      "ANTHROPIC_API_KEY is not set — add it to .env.local to enable AI drafting.",
      { status: 500 }
    );
  }

  let brief: string;
  try {
    const body = await req.json();
    brief = String(body?.brief ?? "").trim();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }
  if (!brief) {
    return new Response("brief is required", { status: 400 });
  }

  // Give Haiku the live brand aura scenes so it picks a real slug (constrained
  // to this list via the schema enum), never a hallucinated one. Fall back to
  // the bundled presets if the aura DB is unreachable.
  let scenes: AuraPreset[];
  try {
    const live = await fetchGreenMentorAuraScenes();
    scenes = live.length ? live : AURA_PRESETS;
  } catch {
    scenes = AURA_PRESETS;
  }
  const auraSlugs = Array.from(
    new Set([DEFAULT_AURA_SLUG, ...scenes.map((s) => s.slug)])
  );
  const auraMenu = scenes
    .map((s) => `- ${s.slug} — ${s.label} (${s.type})`)
    .join("\n");

  const today = new Date().toISOString().slice(0, 10);

  // Mirrors lib/header/types.ts HeaderConfig. Only `title` is required; every
  // other field is optional so the result merges cleanly over the current
  // config (the studio fills the rest from DEFAULT_CONFIG). Structured-output
  // schemas need additionalProperties:false on every object and can't express
  // numeric ranges — scrim guidance lives in the prompt instead.
  const inputSchema: Anthropic.Messages.Tool["input_schema"] = {
    type: "object",
    additionalProperties: false,
    properties: {
      sizeId: {
        type: "string",
        enum: SIZE_PRESETS.map((s) => s.id),
        description: "Output canvas. Default to 'newsletter' unless the brief implies otherwise.",
      },
      auraSlug: {
        type: "string",
        enum: auraSlugs,
        description: "Aura background slug, chosen from the provided list.",
      },
      badge: {
        type: "string",
        description: "Short UPPERCASE tag, e.g. 'FIRESIDE CHAT', 'WEBINAR'. Empty to hide.",
      },
      title: { type: "string", description: "The headline. Keep under ~90 chars." },
      subtitle: { type: "string" },
      chips: {
        type: "array",
        description: "Meta pills (mode / date / time). Icons: 🎥 virtual · 📍 in-person · 📅 date · ⏰ time · 🎙️ speaker series.",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            icon: { type: "string", description: "A single emoji glyph." },
            label: { type: "string" },
          },
          required: ["label"],
        },
      },
      speaker: {
        type: "object",
        additionalProperties: false,
        description: "Omit entirely if no person is named in the brief.",
        properties: {
          name: { type: "string" },
          role: { type: "string" },
          org: { type: "string" },
        },
        required: ["name"],
      },
      speakers: {
        type: "array",
        description:
          "Full speaker roster when the brief names MORE THAN ONE person, lead instructor FIRST. Also set `template` to a multi-speaker layout. Omit for zero or one speaker (use `speaker` instead).",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            role: { type: "string" },
            org: { type: "string" },
            tag: {
              type: "string",
              description: "Card label like 'Host', 'Moderator', 'Speaker'. Omit for the defaults (Host for the lead, Speaker for the rest).",
            },
          },
          required: ["name"],
        },
      },
      template: {
        type: "string",
        enum: TEMPLATE_PRESETS.map((t) => t.id),
        description:
          "Layout template. 'classic' = single footer speaker card (default). Multi-speaker layouts: 'spotlight' (lead front and center, others flanking), 'lineup' (equal speaker columns, good for 3–5), 'billboard' (title left, speaker row bottom-right, 2–4), 'gallery' (big photo cards, 1–4). Pick one of these whenever the roster has 2+ people.",
      },
      theme: {
        type: "object",
        additionalProperties: false,
        properties: {
          scrim: {
            type: "number",
            description: "0–1 darkness of the legibility scrim. Default 0.55; raise toward 0.75 for busy backgrounds or long titles, lower toward 0.3 for airy ones.",
          },
          accent: { type: "string", description: `Accent hex. Default ${BRAND_GREEN}.` },
        },
      },
    },
    required: ["title"],
  };

  const system = `You draft header-image configs for GreenMentor (a sustainability brand; tagline "Sustainability Simplified"). Today is ${today}.

Turn the user's brief into a header config by calling the draft_header tool. Extract the badge, title, optional subtitle, meta chips (mode/date/time), and the people (name, role, org) from the brief. Infer sensible defaults; only set fields the brief supports — leave the rest out so existing defaults apply.

One named person → set \`speaker\`. Two or more → set \`speakers\` with the lead instructor/host FIRST, and pick a multi-speaker \`template\` ('spotlight' for a clear lead + supporting speakers, 'lineup' for an equal panel of 3–5, 'billboard' for 2–4 with a big headline, 'gallery' for 1–4 large photo cards). The speaker grids scale automatically with the roster size.

Pick an aura background slug from this list (match the type to the theme: fluid→tech/data, aurora→premium/evening/energy, ribbon→elegant/corporate, liquid→creative/abstract). When in doubt use ${DEFAULT_AURA_SLUG} (on-brand green):
${auraMenu}

Format dates like "04 June, 2026" and times like "4:00 – 5:00 PM IST". Brand accent is ${BRAND_GREEN}.`;

  try {
    const client = new Anthropic();
    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2048,
      system,
      tools: [
        {
          name: "draft_header",
          description: "Return the drafted header configuration.",
          // Strict tool use guarantees the input matches the schema.
          strict: true,
          input_schema: inputSchema,
        },
      ],
      tool_choice: { type: "tool", name: "draft_header" },
      messages: [{ role: "user", content: brief }],
    });

    const toolUse = message.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return new Response("Model did not return a draft", { status: 502 });
    }

    const config = toolUse.input as Partial<HeaderConfig>;
    return Response.json(
      { config },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    const msg = (e as Error).message ?? "draft failed";
    return new Response(`Draft failed: ${msg}`, { status: 500 });
  }
}
