// ─────────────────────────────────────────────────────────────────────────────
// SHEETS — map an extracted bill record into the bulk-upload-template row shape
// and persist it to Supabase. One table per bill type.
//
// A "bill" here is the record built in pages/Upload.jsx (extracted + factor + meta).
// `heat_content_of_fuel`, `carbon_content_of_fuel`, `ef_of_*` come from the EFDB
// factor lookup, not the bill itself. Fields the extraction schema doesn't capture
// (`use_type`, `currency`, `site_combination`) default to a sensible value / null
// and stay editable later.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase, supabaseConfigured } from "./supabase.js";

// Single source of truth: table name + display column order for the live table.
// To change the electricity columns, edit `electricity.columns` (and the table DDL).
export const SHEET_SCHEMAS = {
  fuel: {
    table: "fuel_bills",
    label: "Fuel",
    columns: [
      "bill_date", "fuel_type", "use_type", "quantity", "unit",
      "amount_paid", "currency", "site_combination",
      "heat_content_of_fuel", "carbon_content_of_fuel", "ef_of_fuel",
    ],
  },
  electricity: {
    table: "electricity_bills",
    label: "Electricity",
    // Column order mirrors the GreenMentor electricity bulk-upload template.
    // `headers` are the human-readable names the SaaS expects in the CSV header
    // row; `columns` are our internal storage keys (1:1, same order).
    columns: [
      "bill_date", "period_from", "period_to", "facility",
      "electricity_source", "source_type", "transaction_type", "electricity_board",
      "units_kwh", "unit", "amount_paid", "currency",
      "ef_of_electricity", "evidence", "status",
    ],
    headers: [
      "Bill Date", "Billing Start Period", "Billing End Period", "Facility",
      "Electricity Source", "Source Type", "Transaction Type", "Electricity Board",
      "Unit Used", "Unit", "Amount Paid", "Currency",
      "Emission Factor", "Evidence", "Status",
    ],
  },
};

// The external bulk-upload SaaS validates every cell against a fixed master list
// and rejects any value it doesn't recognise ("<field> required"). Stored rows use
// our internal lowercase codes, so we translate them to the SaaS's exact accepted
// strings at CSV-export time (see sheetRowsToCSV) — the DB keeps its own values.

// Accepted Level2 - Level3 site combinations, surfaced as a dropdown on the Sheets
// page. The site is never extracted, so the user stamps one at export — onto
// `site_combination` (fuel) or `facility` (electricity).
export const SITE_COMBINATIONS = [
  "Andhra Pradesh - Kurnool",
  "Gurgaon - Gurgaon",
  "India - Andhra Pradesh",
  "India - Telangana",
  "Segment1 - Delhi",
  "Segment2 - Mumbai",
];

// Our fuel_type code → SaaS master fuel type. Codes with no exact SaaS equivalent
// (natural_gas, biomass, kerosene, other) are intentionally absent and pass through
// unchanged — natural gas stays natural gas rather than being relabelled as CNG —
// so the SaaS flags them for manual fixing instead of silently mislabelling them.
const FUEL_TYPE_EXPORT = {
  diesel:      "Diesel",
  hsd:         "Diesel",            // High-Speed Diesel
  petrol:      "Petrol",
  cng:         "CNG",
  lpg:         "LPG",
  furnace_oil: "Processed fuel oils-residual oil",
  coal:        "Coal (industrial)",
};

// Our internal routing status → SaaS master status. Unmapped values pass through.
const STATUS_EXPORT = {
  approved: "Accepted",
  rejected: "Rejected",
  review:   "In Review",
};

// Fields attached to every row for traceability (alongside the template columns).
function meta(bill) {
  return {
    bill_id:    bill.id,
    file_hash:  bill.file_hash,
    status:     bill.status,
    confidence: bill.overall_confidence ?? null,
    raw:        bill,
  };
}

export function toFuelRow(bill) {
  const e = bill.extracted || {};
  const f = bill.factor || null;
  return {
    ...meta(bill),
    bill_date:              e.invoice_date ?? null,
    fuel_type:              e.fuel_type ?? null,
    // No explicit use_type in extraction — infer Mobile if a vehicle is named.
    use_type:               e.vehicle_number ? "Mobile" : "Stationary",
    quantity:               e.quantity ?? null,
    unit:                   e.quantity_unit ?? null,
    amount_paid:            e.amount_inr ?? null,
    currency:               "INR", // extraction has no currency; Indian bills are INR
    site_combination:       null,  // not extracted — editable later
    heat_content_of_fuel:   null,  // not in the EFDB factor schema today
    carbon_content_of_fuel: f?.carbon_content_fraction ?? null,
    ef_of_fuel:             f?.ef_total_co2e ?? null,
  };
}

export function toElectricityRow(bill) {
  const e = bill.extracted || {};
  const f = bill.factor || null;
  return {
    ...meta(bill),
    bill_date:          e.period_to ?? e.due_date ?? null,
    period_from:        e.period_from ?? null,
    period_to:          e.period_to ?? null,
    facility:           null,                      // not extracted — stamped at export
    electricity_source: e.electricity_source ?? null,
    source_type:        e.source_type ?? null,
    transaction_type:   e.transaction_type ?? null,
    electricity_board:  e.discom ?? null,          // template "Electricity Board"
    units_kwh:          e.units_kwh ?? null,       // template "Unit Used"
    unit:               e.units_kwh != null ? "kWh" : null,
    amount_paid:        e.amount_inr ?? null,
    currency:           "INR",
    ef_of_electricity:  f?.ef_total_co2e ?? null,  // template "Emission Factor"
    evidence:           e.evidence_url ?? null,    // storage URL — null until file upload lands
  };
}

// Insert a bill into the correct sheet based on its detected type.
// Returns the inserted row, null if the type has no sheet (water/other), or throws.
export async function saveBillToSheet(bill) {
  if (!supabaseConfigured) throw new Error("Supabase not configured (set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)");

  let schema, row;
  if (bill.bill_type === "fuel")              { schema = SHEET_SCHEMAS.fuel;        row = toFuelRow(bill); }
  else if (bill.bill_type === "electricity")  { schema = SHEET_SCHEMAS.electricity; row = toElectricityRow(bill); }
  else return null; // water / other — no sheet for these

  const { data, error } = await supabase.from(schema.table).insert(row).select().single();
  if (error) throw new Error(error.message);
  return data;
}

// Backfill the EFDB factor onto an already-saved row. The extraction row is
// written at upload time (factor null); the emission factor is looked up later
// in the Review step, so we patch the EF columns (+ status/raw) by bill_id.
// Returns the updated rows, or null for bill types without a sheet.
export async function updateBillEF(bill) {
  if (!supabaseConfigured) throw new Error("Supabase not configured (set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)");
  const f = bill.factor || null;

  let table, patch;
  if (bill.bill_type === "fuel") {
    table = SHEET_SCHEMAS.fuel.table;
    patch = {
      carbon_content_of_fuel: f?.carbon_content_fraction ?? null,
      ef_of_fuel:             f?.ef_total_co2e ?? null,
      status:                 bill.status,
      raw:                    bill,
    };
  } else if (bill.bill_type === "electricity") {
    table = SHEET_SCHEMAS.electricity.table;
    patch = {
      ef_of_electricity: f?.ef_total_co2e ?? null,
      status:            bill.status,
      raw:               bill,
    };
  } else return null; // water / other — no sheet

  const { data, error } = await supabase.from(table).update(patch).eq("bill_id", bill.id).select();
  if (error) throw new Error(error.message);
  return data;
}

// Serialize sheet rows into a CSV string matching the bulk-upload template:
// header + values restricted to the sheet's template columns (the `meta` fields
// like bill_id/raw are intentionally omitted so the output round-trips as a
// re-uploadable template). RFC-4180 quoting for values with commas/quotes/newlines.
export function sheetRowsToCSV(type, rows, { siteCombination = "" } = {}) {
  const schema = SHEET_SCHEMAS[type];
  if (!schema) throw new Error(`Unknown sheet type: ${type}`);
  const esc = (v) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // Translate a stored cell to the value the SaaS master list expects. The site
  // (site_combination on fuel / facility on electricity) is stamped from the
  // export-time selection (rows never carry one); fuel_type and status are mapped
  // to the SaaS naming (unmapped codes pass through for manual fixing).
  const cell = (col, r) => {
    if (col === "site_combination" || col === "facility") return siteCombination || r[col];
    if (col === "fuel_type")                              return FUEL_TYPE_EXPORT[r.fuel_type] ?? r.fuel_type;
    if (col === "status")                                 return STATUS_EXPORT[r.status] ?? r.status;
    return r[col];
  };
  const header = (schema.headers ?? schema.columns).join(",");
  const lines = rows.map((r) => schema.columns.map((c) => esc(cell(c, r))).join(","));
  return [header, ...lines].join("\n");
}

// Read all rows for a sheet, newest first, for the live table.
export async function fetchSheet(type) {
  if (!supabaseConfigured) throw new Error("Supabase not configured (set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)");
  const schema = SHEET_SCHEMAS[type];
  if (!schema) throw new Error(`Unknown sheet type: ${type}`);
  const { data, error } = await supabase
    .from(schema.table)
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}
