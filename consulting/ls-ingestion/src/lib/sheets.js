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
    columns: [
      "bill_date", "period_from", "period_to", "discom", "account_number",
      "units_kwh", "peak_units_kwh", "offpeak_units_kwh", "solar_export_kwh",
      "sanctioned_load_kw", "amount_paid", "currency", "site_combination",
      "ef_of_electricity",
    ],
  },
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
    discom:             e.discom ?? null,
    account_number:     e.account_number ?? null,
    units_kwh:          e.units_kwh ?? null,
    peak_units_kwh:     e.peak_units_kwh ?? null,
    offpeak_units_kwh:  e.offpeak_units_kwh ?? null,
    solar_export_kwh:   e.solar_export_kwh ?? null,
    sanctioned_load_kw: e.sanctioned_load_kw ?? null,
    amount_paid:        e.amount_inr ?? null,
    currency:           "INR",
    site_combination:   null,
    ef_of_electricity:  f?.ef_total_co2e ?? null,
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
