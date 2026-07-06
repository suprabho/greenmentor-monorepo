import { z } from "zod";
import type { VizModule } from "@vismay/viz-engine";
import { parseWithSchema, type ParseCtx } from "../shared";

/** A simple, self-contained bar/line chart embedded in a story body via a
 *  ```story:chart fenced block. Unlike viz-engine's built-in `chart` module
 *  (which only references a chart stored elsewhere), this one carries its own
 *  data — the compose pipeline's draft step emits it inline, LLM-authored. */
export const storyChartSchema = z.object({
  type: z.literal("story:chart").default("story:chart"),
  title: z.string().default(""),
  chartType: z.enum(["bar", "line"]).default("bar"),
  categories: z.array(z.string()).min(1),
  series: z
    .array(z.object({ name: z.string(), values: z.array(z.number()) }))
    .min(1),
});

export type StoryChartConfig = z.output<typeof storyChartSchema>;

const storyChartModule: VizModule<StoryChartConfig> = {
  type: "story:chart",
  label: "Chart",
  slots: ["foreground"],
  schema: storyChartSchema,
  parseConfig: (raw: unknown, ctx: ParseCtx) => parseWithSchema(storyChartSchema, raw, ctx),
  load: () => import("./Component"),
  readinessProfile: "instant",
};

export default storyChartModule;
