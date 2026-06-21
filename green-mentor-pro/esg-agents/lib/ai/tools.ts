import { tool } from "ai";
import { z } from "zod";

/**
 * Generative-UI tools for ESG Buddy. Each tool has a structured zod inputSchema
 * (the model fills it) and an `execute` that returns structured output; the client
 * renders a component per `tool-<name>` part instead of plain text.
 */

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24) || "x";

/** Draft a structured ESG data request → rendered as an editable Data Request card. */
export const draftDataRequest = tool({
  description:
    "Draft a structured ESG data request when the user wants to formally ask a site or department for a specific data point (e.g. monthly grid electricity for a plant). Returns a structured request that renders as an editable card the user can send to the collection portal. Prefer this over describing the request in prose.",
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
    // Structured output — normalized + identified, ready for the collection portal.
    return {
      request_id: `req_${slug(input.metric)}_${slug(input.site)}`,
      channel: "portal" as const,
      status: "draft" as const,
      ...input,
    };
  },
});

export const tools = { draftDataRequest };
