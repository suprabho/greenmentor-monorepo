import { tool } from "ai";
import { z } from "zod";

/**
 * Generative-UI tools for ESG Buddy. Each tool has a structured zod inputSchema
 * (the model fills it) and an `execute` that returns structured output; the client
 * renders a component per `tool-<name>` part instead of plain text.
 */

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24) || "x";

const CADENCE: Record<string, string> = {
  per_site_per_month: "broken down month by month",
  per_site_per_quarter: "broken down quarter by quarter",
  per_site_annual: "as a single figure for the period",
  org_annual: "as a single organisation-wide figure for the period",
};

/**
 * Compose the request as a plain-text message the user can paste into an email or
 * WhatsApp. There is no collection portal yet, so the message IS the deliverable —
 * it has to stand on its own without a link to reply on.
 */
function composeMessage(i: {
  metric: string;
  unit: string;
  site: string;
  period: string;
  granularity: string;
  data_owner: string;
  disclosure_codes: string[];
  evidence_required: string[];
  deadline?: string | null;
}): string {
  const lines: string[] = [];
  lines.push(`Hi ${i.data_owner},`);
  lines.push("");
  lines.push(
    `We're pulling together the ESG disclosures for ${i.period} and need one data point from your side.`,
  );
  lines.push("");
  lines.push(
    `What we need: ${i.metric} at ${i.site} for ${i.period}, reported in ${i.unit}, ${CADENCE[i.granularity] ?? "for the period"}.`,
  );
  if (i.evidence_required.length) {
    lines.push("");
    lines.push(
      `Please attach supporting evidence so the figure is auditable — ${i.evidence_required.join(", ")}.`,
    );
  }
  if (i.disclosure_codes.length) {
    lines.push("");
    lines.push(`This feeds ${i.disclosure_codes.join(" and ")}, so the numbers need to be exact.`);
  }
  lines.push("");
  lines.push(
    i.deadline
      ? `Could you send this across by ${i.deadline}? If any part is missing or estimated, flag it rather than leaving it blank — a known estimate is much easier to work with than a gap.`
      : `Could you send this across when you get a chance? If any part is missing or estimated, flag it rather than leaving it blank — a known estimate is much easier to work with than a gap.`,
  );
  lines.push("");
  lines.push("Happy to jump on a quick call if anything here is unclear.");
  lines.push("");
  lines.push("Thanks!");
  return lines.join("\n");
}

/** Draft an ESG data request → rendered as a card with a ready-to-send plain-text message. */
export const draftDataRequest = tool({
  description:
    "Draft an ESG data request when the user wants to formally ask a site or department for a specific data point (e.g. monthly grid electricity for a plant). Returns a plain-text message the user can edit and paste into an email or WhatsApp, plus the structured fields behind it. Prefer this over describing the request in prose.",
  inputSchema: z.object({
    metric: z.string().describe("Human label, e.g. 'Grid electricity consumption'"),
    metric_code: z.string().nullish().describe("Machine code if known, e.g. 'energy.electricity.grid'"),
    unit: z.string().describe("Required unit, e.g. 'kWh', 'kL', 'litres', 'tonnes'"),
    site: z.string().describe("Site / facility the data is for, e.g. 'Pune Plant'"),
    period: z.string().describe("Reporting period, e.g. 'FY2025-26' or 'Apr 2025'"),
    granularity: z
      .enum(["per_site_per_month", "per_site_per_quarter", "per_site_annual", "org_annual"])
      .describe("Collection granularity"),
    data_owner: z.string().describe("Role or person responsible, e.g. 'Site Facilities'"),
    disclosure_codes: z
      .array(z.string())
      .describe("Framework codes this feeds, e.g. ['BRSR:P6-E7', 'GRI:305-2']"),
    evidence_required: z
      .array(z.string())
      .describe("Acceptable evidence, e.g. ['monthly electricity bills (PDF)']"),
    deadline: z.string().nullish().describe("ISO date (YYYY-MM-DD), optional"),
  }),
  execute: async (input) => {
    return {
      request_id: `req_${slug(input.metric)}_${slug(input.site)}`,
      status: "draft" as const,
      subject: `Data request — ${input.metric}, ${input.site} (${input.period})`,
      message: composeMessage(input),
      ...input,
    };
  },
});

export const tools = { draftDataRequest };
