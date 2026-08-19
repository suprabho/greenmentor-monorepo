/**
 * Which text model the compose flow uses, and which ones this deployment can
 * actually serve.
 *
 * Its own module, importing ONLY `@vismay/story-pipeline/models` — a table of alias
 * strings. `pipeline-store.ts` next door pulls the pack and the pipeline barrel
 * (~600kB of module graph), which a route that answers "what models are there"
 * has no business loading.
 */

import {
  DEFAULT_TEXT_MODEL,
  TEXT_MODEL_CHOICES,
  isAllowedTextModel,
} from "@vismay/story-pipeline/models";

/** True when the pipeline is bypassing the gateway for the Anthropic SDK. */
function usingDirectPath(): boolean {
  return process.env.STORY_PIPELINE_ANTHROPIC_DIRECT === "1";
}

/** Aliases `anthropicModelId` maps to a real Claude model on the direct path. */
const CLAUDE_ALIASES = new Set(["text.claude", "text.opus", "text.fable"]);

/**
 * Measured to fail the pipeline's structured calls on EITHER path — see
 * `gmDefaultTextModel`. Surfaced in the dropdown so an author picking it knows.
 */
const UNRELIABLE = new Set(["text.claude"]);

/**
 * The model GreenMentor composes with by default: `text.fable`, on BOTH paths.
 *
 * Not the pipeline's own default (`text.claude` → claude-sonnet-5), and the reason
 * is measured rather than preferred. Sonnet-5 fails the pipeline's structured calls
 * in two different ways:
 *
 *                       ANGLES schema        SECTION VISUAL schema
 *     direct   sonnet-5   0/4 parsed          n/a (never gets there)
 *     gateway  sonnet-5   2/2 parsed          EMPTY foreground
 *     either   fable-5    2/2 parsed          correct gm-band body
 *
 * On the direct path it renders the whole object as pseudo-XML into the first
 * array-typed field and zod throws — because `generateStructured` returns before
 * reaching its own primary→fallback retry. The gateway has that retry, which fixes
 * angles and outline.
 *
 * The SECTION VISUAL pass fails on the gateway too, and less visibly: its schema is
 * a discriminated union, and sonnet-5 answers it with no layers at all. That does
 * not throw — `normalizeSectionBody` folds an empty foreground away — so the band
 * would be written blank. The section route's corrective retry catches it, but a
 * model that doesn't need the retry is the better default.
 *
 * Still a function rather than a constant: the path is read per-request, and the
 * shape leaves room for the answer to diverge again if it ever does.
 */
export function gmDefaultTextModel(): string {
  return "text.fable";
}

/**
 * Resolve the text model for a call. An out-of-range alias falls back to the
 * default rather than erroring: a stale value stored on a draft should not brick
 * its compose flow.
 */
export function resolveModel(requested: unknown): string {
  if (typeof requested === "string" && requested && isAllowedTextModel(requested)) {
    return requested;
  }
  const fallback = gmDefaultTextModel();
  return isAllowedTextModel(fallback) ? fallback : DEFAULT_TEXT_MODEL;
}

export interface TextModelOption {
  alias: string;
  label: string;
  note?: string;
}

/**
 * The models this deployment can actually serve, for the composer's dropdown.
 *
 * NOT the pipeline's full `TEXT_MODEL_CHOICES`. On the direct-Anthropic path only
 * Claude aliases resolve to a real model — `anthropicModelId` maps everything else
 * to `claude-sonnet-5` and says nothing. Offering GPT, Gemini or Grok there would be
 * a lie the author cannot detect: they would pick "GPT-5.6" and silently get Sonnet.
 *
 * With the gateway (`AI_GATEWAY_API_KEY`, flag dropped) the whole list is reachable,
 * so it is offered whole. `note` carries the measured caveat where there is one.
 */
export function availableTextModels(): TextModelOption[] {
  const direct = usingDirectPath();
  const choices = direct
    ? TEXT_MODEL_CHOICES.filter((c) => CLAUDE_ALIASES.has(c.alias))
    : TEXT_MODEL_CHOICES;
  return choices.map((c) => ({
    alias: c.alias,
    label: c.label,
    ...(UNRELIABLE.has(c.alias)
      ? {
          note: direct
            ? "unreliable here — fails structured calls on the direct path"
            : "unreliable — returns empty bands for the visual pass",
        }
      : {}),
  }));
}
