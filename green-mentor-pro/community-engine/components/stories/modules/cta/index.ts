import { z } from "zod";
import type { VizModule } from "@vismay/viz-engine";
import { parseWithSchema, type ParseCtx } from "../shared";

/** A call-to-action: a branded pill button, or an inline text link. Serializes
 *  to a semantic <a> (Substack keeps links; the pill styling degrades to a bold
 *  link there, or can be exported as an image if pixel-fidelity is needed). */
export const storyCtaSchema = z.object({
  type: z.literal("story:cta").default("story:cta"),
  label: z.string().default("Learn more"),
  href: z.string(),
  style: z.enum(["pill", "link"]).default("pill"),
});

export type StoryCtaConfig = z.output<typeof storyCtaSchema>;

const storyCtaModule: VizModule<StoryCtaConfig> = {
  type: "story:cta",
  label: "Call to action",
  slots: ["foreground"],
  schema: storyCtaSchema,
  parseConfig: (raw: unknown, ctx: ParseCtx) => parseWithSchema(storyCtaSchema, raw, ctx),
  load: () => import("./Component"),
  readinessProfile: "instant",
};

export default storyCtaModule;
