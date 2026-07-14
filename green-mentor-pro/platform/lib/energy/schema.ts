// Zod payload schemas for the Energy route handlers. The platform's existing
// routes validate inline, but the Energy forms carry ~12 fields each, so a
// declared schema is the clearer, safer choice here (zod is already a dep).

import { z } from "zod";

// Accept numbers or numeric strings from the form; empty string / null → undefined.
const num = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
  z.number().finite(),
);
// Optional numeric: blanks the form sends ("" / null) become absent, not an error.
// The .optional() must live INSIDE the preprocess target — an outer .optional() only
// short-circuits literal `undefined`, so "" / null would fall through and be rejected.
const optNum = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
  z.number().finite().optional(),
);

// Optional UUID: the form sends "" for an unselected picker; treat that as absent.
const optUuid = z.preprocess(
  (v) => (v === "" ? undefined : v),
  z.string().uuid().nullable().optional(),
);

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

export const fuelEntrySchema = z.object({
  site_id: optUuid,
  bill_date: isoDate,
  fuel_type_id: z.string().uuid(),
  use_type_id: optUuid,
  quantity: num.refine((n) => n > 0, "quantity must be > 0"),
  unit_id: optUuid,
  amount_paid: optNum,
  currency_id: optUuid,
  heat_content: optNum,
  carbon_content: optNum,
  manual_ef: optNum,
  evidence_paths: z.array(z.string()).default([]),
});
export type FuelEntryInput = z.infer<typeof fuelEntrySchema>;

export const electricityEntrySchema = z
  .object({
    site_id: optUuid,
    bill_date: isoDate,
    bill_start: isoDate.nullable().optional(),
    bill_end: isoDate.nullable().optional(),
    electricity_source_id: z.string().uuid(),
    transaction_type: z.string().min(1).nullable().optional(),
    electricity_board: z.string().nullable().optional(),
    unit_used: num.refine((n) => n > 0, "unit_used (kWh) must be > 0"),
    unit_id: optUuid,
    solar_export_kwh: optNum,
    amount_paid: optNum,
    currency_id: optUuid,
    manual_ef: optNum,
    evidence_paths: z.array(z.string()).default([]),
  })
  .refine(
    (v) => !v.bill_start || !v.bill_end || v.bill_end >= v.bill_start,
    { message: "bill_end must be on or after bill_start", path: ["bill_end"] },
  );
export type ElectricityEntryInput = z.infer<typeof electricityEntrySchema>;

export const fugitiveEntrySchema = z.object({
  method: z.preprocess((v) => Number(v), z.number().int().min(1).max(5)),
  site_id: optUuid,
  reporting_year: optNum,
  gas: z.string().min(1, "gas is required").nullable().optional(),
  database_source: z.string().min(1).nullable().optional(),
  equipment_type: z.string().nullable().optional(), // equipment master name
  unit_id: optUuid,
  evidence_paths: z.array(z.string()).default([]),
  // Method-specific numeric inputs (all optional; each method uses a subset).
  amount_refrigerant_charged: optNum,
  refrigerant_capacity: optNum,
  quantity_purchased: optNum,
  inventory_start: optNum,
  inventory_end: optNum,
  purchased: optNum,
  disposed: optNum,
  service_refrigerant_purchases: optNum,
  retiring_equipment_capacity: optNum,
  recovered_refrigerant: optNum,
  new_equipment_capacity: optNum,
  new_equipment_refrigerant_purchases: optNum,
  suppressant_capacity: optNum,
  number_of_units: optNum,
  emission_factor: optNum,
});
export type FugitiveEntryInput = z.infer<typeof fugitiveEntrySchema>;

export const siteSchema = z.object({
  business_unit: z.string().min(1),
  location: z.string().min(1),
});
export type SiteInput = z.infer<typeof siteSchema>;

export const rejectSchema = z.object({
  feedback: z.string().min(1, "feedback is required to reject"),
});
