import { tool } from "ai";
import { z } from "zod";
import path from "node:path";
import { loadAgent, runAgent, type CallableToolFn } from "@gm/agents";
import { agentsRoot } from "./agentsRoot";

/**
 * Standalone "skills" for the Chat page — each is an assistant-invoked tool whose
 * execute runs a packaged agent one-shot via the loadAgent → runAgent seam (the same
 * one app/api/ai-hub/run/route.ts proves). Unlike buildEngagementTools these are NOT
 * bound to an engagement: there's no phase state, no gate, no DB write. The agent
 * works from the input the model supplies plus its own reasoning, and returns
 * structured output the client renders as a card (see MessageList tool-* branches).
 *
 * Grounding (callable) tools are stubbed, exactly as the per-run route does — a chat
 * skill run has no engagement DB/EFDB context to ground against.
 *
 * NOTE: agentsRoot() must be set before any skill executes; the chat route calls
 * ensureOrchestratorInit() up front so it is.
 */

export interface SkillToolCtx {
  orgId: string;
  financialYear?: string;
}

// A chat skill run isn't tied to an engagement, so its grounding tools return a
// benign stub — the agent still emits its structured output from the input + prompt.
const stubCallable: CallableToolFn = (name) => ({
  ok: true,
  stub: true,
  tool: name,
  note: "grounding tool stubbed for a standalone chat-skill run",
});

// Compact BRSR field catalog for one-off bill/invoice extraction. Mirrors the
// USER_FIELD_CATALOG the engagement collection path uses, trimmed to the metrics a
// single utility/fuel/waste document typically carries.
const BILL_FIELD_CATALOG = [
  { metric_code: "energy.electricity.grid", label: "Grid electricity consumption", data_type: "number", required_unit: "kWh", disclosure_code: "BRSR:P6-E7", expected_magnitude: 50000 },
  { metric_code: "energy.electricity.renewable", label: "Renewable electricity consumption", data_type: "number", required_unit: "kWh", disclosure_code: "BRSR:P6-E7", expected_magnitude: 10000 },
  { metric_code: "energy.diesel", label: "Diesel (DG sets / vehicles)", data_type: "number", required_unit: "litres", disclosure_code: "BRSR:P6-E7", expected_magnitude: 12000 },
  { metric_code: "energy.natural_gas", label: "Natural gas / PNG", data_type: "number", required_unit: "scm", disclosure_code: "BRSR:P6-E7", expected_magnitude: 8000 },
  { metric_code: "energy.lpg", label: "LPG", data_type: "number", required_unit: "kg", disclosure_code: "BRSR:P6-E7", expected_magnitude: 2000 },
  { metric_code: "water.municipal", label: "Municipal / third-party water", data_type: "number", required_unit: "kL", disclosure_code: "BRSR:P6-E3", expected_magnitude: 3000 },
  { metric_code: "water.groundwater", label: "Groundwater withdrawal", data_type: "number", required_unit: "kL", disclosure_code: "BRSR:P6-E3", expected_magnitude: 2000 },
  { metric_code: "waste.hazardous", label: "Hazardous waste generated", data_type: "number", required_unit: "tonnes", disclosure_code: "BRSR:P6-E9", expected_magnitude: 50 },
  { metric_code: "waste.non_hazardous", label: "Non-hazardous waste generated", data_type: "number", required_unit: "tonnes", disclosure_code: "BRSR:P6-E9", expected_magnitude: 200 },
];

const DOC_HINTS = [
  "utility_bill", "fuel_invoice", "waste_manifest", "water_bill",
  "hr_spreadsheet", "spend_ledger", "policy", "certificate", "other",
] as const;

const FRAMEWORKS = ["BRSR", "GRI", "ESRS", "ISSB", "SASB", "TCFD"] as const;

/* eslint-disable @typescript-eslint/no-explicit-any */

export function buildSkillTools(ctx: SkillToolCtx) {
  // Standalone runs aren't engagement-scoped; give the agent runtime a stable,
  // clearly non-persistent id so any stubbed grounding call is self-describing.
  const runCtx = { orgId: ctx.orgId, engagementId: "skill_standalone", financialYear: ctx.financialYear };

  async function run<O = any>(agentKey: string, input: unknown): Promise<O> {
    const agent = loadAgent(path.join(agentsRoot(), agentKey));
    const result = await runAgent<unknown, O>(agent, input, runCtx, { runCallableTool: stubCallable });
    return result.output;
  }

  // Turn any run failure into a structured, renderable error instead of aborting the
  // chat stream (the AI Hub's house rule: never leak a raw error into the transcript).
  async function guarded<O>(work: () => Promise<O>): Promise<O | { error: string }> {
    try {
      return await work();
    } catch (e) {
      return { error: String(e instanceof Error ? e.message : e) };
    }
  }

  return {
    runScopingSkill: tool({
      description:
        "Run the Kick-off & Scoping skill: turn a brief description of an ESG/BRSR reporting engagement into a structured scope charter (objectives, frameworks in scope with rationale, reporting boundary), a phased project plan, a RACI matrix, and any open questions. Call this when the user wants to scope, plan, or kick off a reporting engagement — NOT for answering a conceptual question about scoping. Infer sensible fields from the conversation; the client renders the result as a Scope card. After it returns, do NOT restate the scope in your reply — the card is the answer; add only follow-up questions.",
      inputSchema: z.object({
        client_name: z.string().describe("The reporting entity, e.g. 'Acme Manufacturing Ltd'."),
        sector: z.string().nullish().describe("Sector/industry, e.g. 'Cement', 'IT Services'."),
        listing_status: z.enum(["listed", "unlisted", "subsidiary"]).nullish().describe("Listing status — drives BRSR applicability."),
        frameworks: z.array(z.enum(FRAMEWORKS)).nullish().describe("Candidate frameworks; defaults to ['BRSR','GRI'] if omitted."),
        reporting_year: z.string().nullish().describe("Reporting FY label, e.g. 'FY2025-26'."),
        brief: z.string().nullish().describe("Free-text objectives/brief for the engagement."),
      }),
      execute: async (input) =>
        guarded(() =>
          run("kickoff-scoping", {
            tenant_id: ctx.orgId,
            engagement_id: "skill_standalone",
            client: {
              legal_name: input.client_name,
              ...(input.sector ? { sector: input.sector } : {}),
              ...(input.listing_status ? { listing_status: input.listing_status } : {}),
            },
            candidate_frameworks: input.frameworks?.length ? input.frameworks : ["BRSR", "GRI"],
            ...(input.reporting_year ? { reporting_period: { fy: input.reporting_year } } : {}),
            ...(input.brief ? { brief: input.brief } : {}),
            clarifications: [],
          }),
        ),
    }),

    extractBillSkill: tool({
      description:
        "Run the Bill / Document Extraction skill: parse the text of a utility bill, fuel or waste invoice, or similar ESG evidence document into structured dataset rows (metric, value, unit, period) with per-field provenance and a confidence per row. Call this when the user has PROVIDED a document's text (pasted, or from an uploaded/parsed file) and wants the numbers pulled out. Pass the document text in `document_text`. The client renders the result as an Extracted-data table. After it returns, do NOT restate the extracted rows in your reply — the table is the answer; add only follow-up questions.",
      inputSchema: z.object({
        document_text: z.string().describe("The document's text content (bill/invoice/spreadsheet text). Required — do not call without it."),
        site_name: z.string().nullish().describe("Site/facility the document is for, e.g. 'Pune Plant'."),
        reporting_year: z.string().nullish().describe("Reporting FY label, e.g. 'FY2025-26'."),
        document_hint: z.enum(DOC_HINTS).nullish().describe("Best guess at the document kind, if known."),
      }),
      execute: async (input) => {
        if ((input.document_text ?? "").trim().length < 20) {
          return { error: "No document text was provided. Ask the user to paste the bill/invoice text (or upload a document) before running extraction." };
        }
        return guarded(() =>
          run("data-collection", {
            tenant_id: ctx.orgId,
            engagement_id: "skill_standalone",
            financial_year: input.reporting_year ?? ctx.financialYear ?? "FY2025-26",
            quarter: null,
            site: { site_id: "site_1", site_name: input.site_name ?? "Site 1" },
            field_catalog: BILL_FIELD_CATALOG,
            data_request_list: [],
            document: {
              document_hint: input.document_hint ?? "utility_bill",
              uploaded_by: "user",
              source_documents: ["chat_upload"],
            },
            document_text: input.document_text,
          }),
        );
      },
    }),

    understandEpdSkill: tool({
      description:
        "Run the EPD Understanding skill: read the text of an Environmental Product Declaration (EPD) and extract a structured summary — product, declared/functional unit, programme operator, PCR and reference standards (EN 15804 / ISO 14025), GWP (fossil/biogenic/total) per life-cycle module (A1–A3 … C, D), validity, and verification. Call this when the user has PROVIDED EPD text and wants it explained or turned into usable embodied-carbon factors. Pass the text in `epd_text`. The client renders the result as an EPD card. After it returns, do NOT restate the EPD summary in your reply — the card is the answer; add only follow-up questions.",
      inputSchema: z.object({
        epd_text: z.string().describe("The EPD document text (pasted, or parsed from a PDF). Required — do not call without it."),
        product_name: z.string().nullish().describe("Optional product-name hint."),
      }),
      execute: async (input) => {
        if ((input.epd_text ?? "").trim().length < 20) {
          return { error: "No EPD text was provided. Ask the user to paste the EPD text (or upload the EPD document) before running this skill." };
        }
        return guarded(() =>
          run("epd-understanding", {
            epd_text: input.epd_text,
            ...(input.product_name ? { product_name: input.product_name } : {}),
          }),
        );
      },
    }),
  };
}
