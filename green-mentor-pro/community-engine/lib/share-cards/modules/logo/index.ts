import { z } from "zod";
import type { AdminFormField, VizModule } from "@vismay/viz-engine";
import { BRAND_GREEN } from "@/lib/header/types";
import { parseWithSchema, type ParseCtx } from "../shared";

export const gmLogoSchema = z.object({
  type: z.literal("gmcard:logo").default("gmcard:logo"),
  color: z.string().describe("wordmark hex color").default(BRAND_GREEN),
  fill: z.boolean().describe("solid-filled wordmark instead of the hollow outline").default(false),
});

export type GmLogoConfig = z.output<typeof gmLogoSchema>;

function adminForm(): AdminFormField[] {
  return [
    { kind: "text", key: "color", label: "Color (hex)", placeholder: BRAND_GREEN },
    { kind: "boolean", key: "fill", label: "Solid fill" },
  ];
}

const logoModule: VizModule<GmLogoConfig> = {
  type: "gmcard:logo",
  label: "GreenMentor wordmark",
  slots: ["foreground"],
  schema: gmLogoSchema,
  parseConfig: (raw: unknown, ctx: ParseCtx) => parseWithSchema(gmLogoSchema, raw, ctx),
  adminForm,
  load: () => import("./Component"),
  readinessProfile: "instant",
};

export default logoModule;
