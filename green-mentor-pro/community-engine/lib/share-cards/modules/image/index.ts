import { z } from "zod";
import type { AdminFormField, VizModule } from "@vismay/viz-engine";
import { parseWithSchema, type ParseCtx } from "../shared";

export const gmImageSchema = z.object({
  type: z.literal("gmcard:image").default("gmcard:image"),
  src: z
    .string()
    .describe("image source — an article image_url, a pasted URL, or an uploaded data URL")
    .default(""),
  objectFit: z.enum(["cover", "contain"]).default("cover"),
  radius: z.enum(["none", "md", "xl"]).default("md"),
});

export type GmImageConfig = z.output<typeof gmImageSchema>;

function adminForm(): AdminFormField[] {
  return [
    { kind: "picker", key: "src", label: "Image", pickerId: "gm:image", required: true },
    {
      kind: "select",
      key: "objectFit",
      label: "Fit",
      options: [
        { value: "cover", label: "Cover" },
        { value: "contain", label: "Contain" },
      ],
    },
    {
      kind: "select",
      key: "radius",
      label: "Corners",
      options: [
        { value: "none", label: "Square" },
        { value: "md", label: "Rounded" },
        { value: "xl", label: "Extra round" },
      ],
    },
  ];
}

const imageModule: VizModule<GmImageConfig> = {
  type: "gmcard:image",
  label: "Image",
  slots: ["foreground"],
  schema: gmImageSchema,
  parseConfig: (raw: unknown, ctx: ParseCtx) => parseWithSchema(gmImageSchema, raw, ctx),
  adminForm,
  load: () => import("./Component"),
  readinessProfile: "instant",
};

export default imageModule;
