import { z } from "zod";
import type { AdminFormField, VizModule } from "@vismay/viz-engine";
import { parseWithSchema, type ParseCtx } from "../shared";

export const gmBadgeSchema = z.object({
  type: z.literal("gmcard:badge").default("gmcard:badge"),
  label: z.string().describe("short pill text, e.g. a series or framework tag").default("ESG BRIEF"),
  tone: z.enum(["accent", "outline", "glass"]).default("accent"),
});

export type GmBadgeConfig = z.output<typeof gmBadgeSchema>;

function adminForm(): AdminFormField[] {
  return [
    { kind: "text", key: "label", label: "Label", placeholder: "ESG BRIEF" },
    {
      kind: "select",
      key: "tone",
      label: "Tone",
      options: [
        { value: "accent", label: "Accent" },
        { value: "outline", label: "Outline" },
        { value: "glass", label: "Glass" },
      ],
    },
  ];
}

const badgeModule: VizModule<GmBadgeConfig> = {
  type: "gmcard:badge",
  label: "Badge",
  slots: ["foreground"],
  schema: gmBadgeSchema,
  parseConfig: (raw: unknown, ctx: ParseCtx) => parseWithSchema(gmBadgeSchema, raw, ctx),
  adminForm,
  load: () => import("./Component"),
  readinessProfile: "instant",
};

export default badgeModule;
