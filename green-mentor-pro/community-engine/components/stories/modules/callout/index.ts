import { z } from "zod";
import type { VizModule } from "@vismay/viz-engine";
import { parseWithSchema, type ParseCtx } from "../shared";

/** A boxed list of points — e.g. a "Practitioner summary" of numbered
 *  takeaways, or a tip/warning callout. Serializes to a semantic
 *  <ul>/<ol> (Substack keeps lists), optionally under a bold title. */
export const storyCalloutSchema = z.object({
  type: z.literal("story:callout").default("story:callout"),
  title: z.string().default(""),
  items: z.array(z.string()).min(1),
  ordered: z.boolean().describe("numbered instead of bulleted").default(false),
  tone: z.enum(["info", "tip", "warn"]).default("info"),
});

export type StoryCalloutConfig = z.output<typeof storyCalloutSchema>;

const storyCalloutModule: VizModule<StoryCalloutConfig> = {
  type: "story:callout",
  label: "Callout / key points",
  slots: ["foreground"],
  schema: storyCalloutSchema,
  parseConfig: (raw: unknown, ctx: ParseCtx) => parseWithSchema(storyCalloutSchema, raw, ctx),
  load: () => import("./Component"),
  readinessProfile: "instant",
};

export default storyCalloutModule;
