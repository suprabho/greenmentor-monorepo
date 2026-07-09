import { z } from "zod";
import type { VizModule } from "@vismay/viz-engine";
import { parseWithSchema, type ParseCtx } from "../shared";

/** The opening banner of a newsletter: an eyebrow + title (+ subtitle) over a
 *  brand gradient, or laid over a hero image when `src` is given. Exports as an
 *  image (Substack strips the gradient/overlay styling) — see
 *  lib/stories/serializeSubstack.ts. */
export const storyHeroSchema = z.object({
  type: z.literal("story:hero").default("story:hero"),
  eyebrow: z.string().default(""),
  title: z.string().default("Untitled"),
  subtitle: z.string().default(""),
  src: z.string().describe("optional hero image URL").default(""),
  theme: z.enum(["teal", "green", "ink"]).default("teal"),
});

export type StoryHeroConfig = z.output<typeof storyHeroSchema>;

const storyHeroModule: VizModule<StoryHeroConfig> = {
  type: "story:hero",
  label: "Hero",
  slots: ["foreground"],
  schema: storyHeroSchema,
  parseConfig: (raw: unknown, ctx: ParseCtx) => parseWithSchema(storyHeroSchema, raw, ctx),
  load: () => import("./Component"),
  readinessProfile: "instant",
};

export default storyHeroModule;
