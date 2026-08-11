import { z } from "zod";
import type { AdminFormField, VizModule } from "@vismay/viz-engine";
import { parseWithSchema, type ParseCtx } from "../shared";

export const gmJobSchema = z.object({
  type: z.literal("gmcard:job").default("gmcard:job"),
  jobId: z.string().describe("id of the published job this card renders").default(""),
  variant: z
    .enum(["standard", "compact"])
    .describe("standard: full card; compact: monogram + title + meta only")
    .default("standard"),
  // `hide*` (not `show*`) because VizConfigForm's boolean field DELETES the key
  // when unchecked — a default(true) toggle could never be switched off.
  hideMonogram: z.boolean().default(false),
  hideCompany: z.boolean().default(false),
  hideDetails: z.boolean().default(false),
  hideMeta: z.boolean().describe("hide the location / type / experience row").default(false),
  hideSalary: z.boolean().default(false),
  hideDeadline: z.boolean().default(false),
  hideTags: z.boolean().describe("hide the skill tag chips").default(false),
});

export type GmJobConfig = z.output<typeof gmJobSchema>;

function adminForm(): AdminFormField[] {
  return [
    { kind: "picker", key: "jobId", label: "Job", pickerId: "gm:job", required: true },
    {
      kind: "select",
      key: "variant",
      label: "Layout",
      options: [
        { value: "standard", label: "Standard" },
        { value: "compact", label: "Compact" },
      ],
    },
    { kind: "boolean", key: "hideMonogram", label: "Hide monogram" },
    { kind: "boolean", key: "hideCompany", label: "Hide company" },
    { kind: "boolean", key: "hideDetails", label: "Hide description" },
    { kind: "boolean", key: "hideMeta", label: "Hide location / type" },
    { kind: "boolean", key: "hideSalary", label: "Hide salary" },
    { kind: "boolean", key: "hideDeadline", label: "Hide deadline" },
    { kind: "boolean", key: "hideTags", label: "Hide tag chips" },
  ];
}

const jobModule: VizModule<GmJobConfig> = {
  type: "gmcard:job",
  label: "Job opening",
  slots: ["foreground"],
  schema: gmJobSchema,
  parseConfig: (raw: unknown, ctx: ParseCtx) => parseWithSchema(gmJobSchema, raw, ctx),
  adminForm,
  load: () => import("./Component"),
  readinessProfile: "instant",
  stableIdentity: (c) => `gmcard:job:${c.jobId}`,
};

export default jobModule;
