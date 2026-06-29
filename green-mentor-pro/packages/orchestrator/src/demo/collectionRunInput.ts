/**
 * Input + output mapping for a REAL data-collection agent run from the demo board.
 * Feeds the agent a utility-bill as text (no vision/storage needed) so a live
 * Claude call extracts a typed dataset, which we map into review-queue items.
 */
import type { ReviewItem, Confidence } from "./fixtures";

/** A realistic MSEDCL (Maharashtra) HT industrial electricity bill, as plain text. */
export const SAMPLE_BILL_TEXT = `MAHARASHTRA STATE ELECTRICITY DISTRIBUTION CO. LTD (MSEDCL)
TAX INVOICE / ENERGY BILL

Consumer Name : ACME MANUFACTURING PVT LTD — Pune Plant
Consumer No   : 170012345678        Tariff Category : HT-I Industrial
Bill Month    : April 2025          Billing Period  : 01-Apr-2025 to 30-Apr-2025
Sanctioned Load : 1500 kVA          Contract Demand : 1350 kVA
Meter No      : 9921004455

Present Reading  : 8,84,210 kWh
Previous Reading : 8,36,000 kWh
Multiplying Factor : 1
Units Consumed (kWh) : 48,210

Energy Charges        Rs. 3,61,575.00
Fixed/Demand Charges  Rs.   94,500.00
Electricity Duty      Rs.   30,675.00
Net Amount Payable    Rs. 4,86,750.00
Due Date : 20-May-2025`;

/** Assemble the Phase-4 data-collection input for one request against the bill. */
export function buildCollectionInput() {
  return {
    org_id: "org_acme",
    tenant_id: "org_acme",
    engagement_id: "eng_acme_fy2526",
    financial_year: "FY2025-26",
    quarter: "Q1",
    site: { site_id: "site_pune", site_name: "Pune Plant" },
    field_catalog: [
      {
        metric_code: "energy.electricity.grid",
        label: "Grid electricity consumption",
        data_type: "number",
        required_unit: "kWh",
        disclosure_code: "BRSR:P6-E7",
        expected_magnitude: 50000,
      },
      { metric_code: "billing.period_start", label: "Period start", data_type: "date" },
      { metric_code: "billing.period_end", label: "Period end", data_type: "date" },
    ],
    data_request_list: [
      {
        request_id: "req_grid_elec",
        metric_code: "energy.electricity.grid",
        data_owner: "Site Facilities",
        period_start: "2025-04-01",
        period_end: "2025-04-30",
        prior_status: "open",
      },
    ],
    document: {
      storage_path: "demo/pune_apr2025_bill.txt",
      document_hint: "utility_bill",
      uploaded_by: "demo",
      uploaded_at: "2026-07-02T09:12:00Z",
    },
    // The bill content the agent extracts from (passed as text for the demo).
    document_text: SAMPLE_BILL_TEXT,
  };
}

type Prov = { value?: unknown; source_snippet?: string | null; extraction_note?: string | null } | undefined;

/** Map the agent's dataset_rows output into review-queue items for the panel. */
export function rowsToReviewItems(output: unknown): ReviewItem[] {
  const rows = (output as { dataset_rows?: unknown[] })?.dataset_rows ?? [];
  return rows.map((raw, i) => {
    const r = raw as Record<string, unknown>;
    const rv = r.reported_value as Prov;
    const ru = r.reported_unit as Prov;
    const conf = (r.overall_confidence as Confidence) ?? "low";
    const num = typeof rv?.value === "number" ? rv.value : Number(rv?.value ?? 0);
    return {
      id: `live_${i}`,
      item: String(r.metric_code ?? "metric"),
      site: String(r.site_id ?? "—"),
      value: Number.isFinite(num) ? num : 0,
      unit: String(ru?.value ?? ""),
      confidence: conf,
      sourceSnippet: rv?.source_snippet ?? "(no snippet returned)",
      reviewRequired: conf === "low" || r.is_outlier === true,
      note: (r.outlier_note as string) ?? rv?.extraction_note ?? undefined,
      status: "submitted",
    };
  });
}
