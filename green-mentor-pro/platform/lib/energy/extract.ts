// Smart Upload — AI bill extraction for the Energy forms. Rebuild of the legacy
// greenmentor-in-fe billExtraction flow (Claude vision → resolve to masters →
// validate → prefill). Here the model is reached through @gm/agents'
// resolveBuddyModel() (AI Gateway or direct Anthropic), and we use the AI SDK's
// generateObject with a strict schema instead of a bespoke endpoint. The bill
// file is sent straight to the vision model — no separate OCR step.

import { generateObject } from "ai";
import { resolveBuddyModel } from "@gm/agents";
import { z } from "zod";
import type { EnergyMasters } from "./types";

export type BillType = "fuel" | "electricity";

// ── Extraction schemas (all fields nullable — a bill may omit any of them) ──
const fuelExtraction = z.object({
  bill_date: z.string().nullable().describe("invoice date, YYYY-MM-DD"),
  fuel_type: z.string().nullable().describe("e.g. Diesel, Petrol, LPG, Natural Gas"),
  quantity: z.number().nullable().describe("fuel quantity consumed/purchased"),
  unit: z.string().nullable().describe("e.g. litres, kg, m3"),
  amount_paid: z.number().nullable(),
  currency: z.string().nullable().describe("ISO code e.g. INR, USD"),
  invoice_number: z.string().nullable(),
});
const electricityExtraction = z.object({
  bill_date: z.string().nullable().describe("invoice date, YYYY-MM-DD"),
  bill_start: z.string().nullable().describe("billing period start, YYYY-MM-DD"),
  bill_end: z.string().nullable().describe("billing period end, YYYY-MM-DD"),
  units_kwh: z.number().nullable().describe("electricity consumed in kWh"),
  amount_paid: z.number().nullable(),
  currency: z.string().nullable(),
  electricity_source: z.string().nullable().describe("e.g. Grid, Solar, DG Set"),
  account_number: z.string().nullable(),
});

export type FuelExtraction = z.infer<typeof fuelExtraction>;
export type ElectricityExtraction = z.infer<typeof electricityExtraction>;
export type Extraction = Partial<FuelExtraction & ElectricityExtraction>;

/** Send the bill to the vision model and get structured fields back. */
export async function extractBill(
  billType: BillType,
  bytes: Uint8Array,
  mediaType: string,
): Promise<Extraction> {
  const { model } = resolveBuddyModel();
  const schema = billType === "fuel" ? fuelExtraction : electricityExtraction;
  const { object } = await generateObject({
    model,
    schema,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              `Extract the ${billType} bill fields from this document. Use null for anything ` +
              `not clearly present — never guess. Dates must be YYYY-MM-DD; numbers must be plain ` +
              `numeric values (no units or currency symbols).`,
          },
          { type: "file", data: bytes, mediaType },
        ],
      },
    ],
  });
  return object as Extraction;
}

// ── Resolve extracted strings → master ids ──────────────────────────────────
const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Aliases the model's free text may use for our seeded master names.
const FUEL_ALIASES: Record<string, string> = {
  hsd: "highspeeddiesel", dieseloil: "diesel", motorspirit: "petrol", gasoline: "petrol",
  cookinggas: "lpg", png: "naturalgas", pipednaturalgas: "naturalgas",
};
const SOURCE_ALIASES: Record<string, string> = {
  grid: "gridelectricity", eb: "gridelectricity", discom: "gridelectricity",
  dg: "dieselgenerator", dgset: "dieselgenerator", genset: "dieselgenerator", solarpv: "solar",
};

function matchByName<T extends { id: string; name: string }>(
  list: T[],
  raw: string | null | undefined,
  aliases: Record<string, string> = {},
): T | null {
  const key = norm(raw);
  if (!key) return null;
  const target = aliases[key] ?? key;
  return (
    list.find((x) => norm(x.name) === target) ??
    list.find((x) => norm(x.name).includes(target) || target.includes(norm(x.name))) ??
    null
  );
}

export interface ResolvedMasters {
  fuel_type_id?: string;
  unit_id?: string;
  currency_id?: string;
  electricity_source_id?: string;
  notes: string[]; // fields we couldn't confidently resolve
}

export function resolveToMasters(billType: BillType, ex: Extraction, m: EnergyMasters): ResolvedMasters {
  const notes: string[] = [];
  const out: ResolvedMasters = { notes };
  const currency = m.currencies.find((c) => norm(c.code) === norm(ex.currency) || norm(c.name) === norm(ex.currency));
  if (ex.currency && currency) out.currency_id = currency.id;
  else if (ex.currency) notes.push(`currency "${ex.currency}" not matched`);

  const unit = matchByName(m.units, ex.unit);
  if (ex.unit && unit) out.unit_id = unit.id;
  else if (ex.unit) notes.push(`unit "${ex.unit}" not matched`);

  if (billType === "fuel") {
    const ft = matchByName(m.fuelTypes, ex.fuel_type, FUEL_ALIASES);
    if (ex.fuel_type && ft) out.fuel_type_id = ft.id;
    else if (ex.fuel_type) notes.push(`fuel type "${ex.fuel_type}" not matched — pick manually`);
  } else {
    const src = matchByName(m.electricitySources, ex.electricity_source, SOURCE_ALIASES);
    if (ex.electricity_source && src) out.electricity_source_id = src.id;
    else if (ex.electricity_source) notes.push(`source "${ex.electricity_source}" not matched — pick manually`);
  }
  return out;
}

// ── Validation (ported from legacy lib/billExtraction/validation.js) ─────────
export type Severity = "hard" | "flag";
export interface ValidationFlag {
  rule: string;
  severity: Severity;
  label: string;
}
export interface ValidationResult {
  status: "passed" | "flagged" | "failed";
  flags: ValidationFlag[];
}

export function runBillValidation(billType: BillType, ex: Extraction): ValidationResult {
  const flags: ValidationFlag[] = [];
  const add = (rule: string, severity: Severity, label: string) => flags.push({ rule, severity, label });

  if (billType === "electricity") {
    if (!ex.bill_start || !ex.bill_end) add("E_PERIOD", "flag", "Billing period dates missing");
    else if (ex.bill_end < ex.bill_start) add("E_ORDER", "hard", "Period end is before start");
    else {
      const days = (Date.parse(ex.bill_end) - Date.parse(ex.bill_start)) / 86_400_000;
      if (days > 95) add("E_LONG", "flag", `Billing period is ${Math.round(days)} days (>95)`);
    }
    if (!ex.units_kwh || ex.units_kwh <= 0) add("E_UNITS", "hard", "Units (kWh) missing or not positive");
    if (ex.amount_paid && ex.units_kwh) {
      const rate = ex.amount_paid / ex.units_kwh;
      if (rate < 2 || rate > 30) add("E_RATE", "flag", `Rate ${rate.toFixed(2)}/kWh is outside 2–30`);
    }
  } else {
    if (!ex.quantity || ex.quantity <= 0) add("F_QTY", "hard", "Quantity missing or not positive");
    if (!ex.fuel_type) add("F_TYPE", "flag", "Fuel type not detected");
    if (!ex.invoice_number) add("F_INV", "flag", "Invoice number not detected");
  }

  const hasHard = flags.some((f) => f.severity === "hard");
  const status = hasHard ? "failed" : flags.length ? "flagged" : "passed";
  return { status, flags };
}
