import { z } from "zod";
import type { VizModule } from "@vismay/viz-engine";
import { parseWithSchema, type ParseCtx } from "../shared";

/** A pull quote / highlighted line, optionally attributed. Serializes to a
 *  semantic <blockquote> (Substack keeps blockquotes). */
export const storyPullquoteSchema = z.object({
  type: z.literal("story:pullquote").default("story:pullquote"),
  text: z.string(),
  attribution: z.string().default(""),
});

export type StoryPullquoteConfig = z.output<typeof storyPullquoteSchema>;

const storyPullquoteModule: VizModule<StoryPullquoteConfig> = {
  type: "story:pullquote",
  label: "Pull quote",
  slots: ["foreground"],
  schema: storyPullquoteSchema,
  parseConfig: (raw: unknown, ctx: ParseCtx) => parseWithSchema(storyPullquoteSchema, raw, ctx),
  load: () => import("./Component"),
  readinessProfile: "instant",
};

export default storyPullquoteModule;
