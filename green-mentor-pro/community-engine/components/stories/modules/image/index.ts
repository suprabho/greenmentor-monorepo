import { z } from "zod";
import type { VizModule } from "@vismay/viz-engine";
import { parseWithSchema, type ParseCtx } from "../shared";

/** A single captioned image. `src` must already be a hosted URL (Substack
 *  re-fetches and re-hosts it at paste time). Serializes to a semantic
 *  <figure><img><figcaption>. */
export const storyImageSchema = z.object({
  type: z.literal("story:image").default("story:image"),
  src: z.string().describe("hosted image URL"),
  alt: z.string().default(""),
  caption: z.string().default(""),
});

export type StoryImageConfig = z.output<typeof storyImageSchema>;

const storyImageModule: VizModule<StoryImageConfig> = {
  type: "story:image",
  label: "Image",
  slots: ["foreground"],
  schema: storyImageSchema,
  parseConfig: (raw: unknown, ctx: ParseCtx) => parseWithSchema(storyImageSchema, raw, ctx),
  load: () => import("./Component"),
  readinessProfile: "instant",
};

export default storyImageModule;
