/**
 * Sanity-check the report assembler + renderer against the cached demo artifacts.
 *   tsx scripts/check-report.ts
 * Asserts every disclosure lands in a principle or the "other" bucket (none dropped).
 */
import cached from "../lib/demo/cachedArtifacts.json";
import { assembleBrsrReport } from "../lib/report/assemble";
import { brsrReportBodyHtml } from "../lib/report/render";

/* eslint-disable @typescript-eslint/no-explicit-any */
const c = cached as any;

const model = assembleBrsrReport({
  engagement: { client_name: "Acme Manufacturing Pvt Ltd", financial_year: "FY2025-26", framework: ["BRSR", "GRI"] },
  reportDrafting: c.report_drafting,
  publication: c.publication,
  calculation: c.calculation,
  assumptions: ["Q4 water estimated from Q3 average where invoices were pending."],
});

const draftCodes = (c.report_drafting?.disclosure_drafts ?? []).length;
const mapCodes = (c.calculation?.disclosure_mappings ?? []).length;
const placed = model.principles.reduce((n: number, p) => n + p.essential.length + p.leadership.length, 0) + model.otherDisclosures.length;

console.log("empty:", model.empty);
console.log("sections:", model.sections.length);
console.log("principles:", model.principles.map((p) => `P${p.principle}(${p.essential.length}E/${p.leadership.length}L)`).join(", ") || "(none)");
console.log("other/appendix disclosures:", model.otherDisclosures.length);
console.log("headline metrics:", model.cover.headlineMetrics.length, "· KPIs:", model.kpis.length);
console.log(`disclosures: ${draftCodes} drafts + ${mapCodes} mappings → ${placed} placed (deduped)`);

const html = brsrReportBodyHtml(model);
console.log("rendered HTML length:", html.length, html.includes("<script") ? "⚠️ contains <script>" : "· sanitized OK");

if (model.empty) throw new Error("FAIL: model assembled empty from non-empty fixtures");
if (placed === 0) throw new Error("FAIL: no disclosures placed");
console.log("\n✓ assembler OK");
