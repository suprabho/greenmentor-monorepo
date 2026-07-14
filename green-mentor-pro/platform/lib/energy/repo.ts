// Server-side data access for the Energy module. All writes go through the
// service-role admin client (RLS-bypassing) scoped explicitly by org_id — the
// same pattern @gm/orchestrator repos and lib/tenancy.ts use. Reads for the
// authenticated shell use the RLS-bound server client (see the page components);
// this module is the mutation + masters/aggregation layer used by the routes.
//
// Emission factor + tCO2e are resolved and computed here at write time
// (resolveFactor → calc), so the stored row is self-contained for display and
// aggregation. Re-runs on update.

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { calcFuelEmission, calcElectricityEmission } from "./calc";
import { calcFugitive, METHOD_LABELS, type FugitiveInputs } from "./fugitive-calc";
import { resolveFactor } from "./factors";
import type {
  EnergyMasters,
  FuelEntry,
  ElectricityEntry,
  EnergySite,
  FugitiveEntry,
  FugitiveMasters,
} from "./types";
import type {
  FuelEntryInput,
  ElectricityEntryInput,
  SiteInput,
  FugitiveEntryInput,
} from "./schema";

function admin(): SupabaseClient {
  return createAdminClient();
}

// ── Membership / role (maker–checker gate) ──────────────────────────────────
export type MemberRole = "admin" | "manager" | "member" | null;

export async function getMemberRole(orgId: string, userId: string): Promise<MemberRole> {
  const { data } = await admin()
    .from("esg_org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.role as MemberRole) ?? null;
}

export function isChecker(role: MemberRole): boolean {
  return role === "admin" || role === "manager";
}

// ── Masters ─────────────────────────────────────────────────────────────────
export async function getMasters(): Promise<EnergyMasters> {
  const db = admin();
  const [fuelTypes, useTypes, units, currencies, electricitySources, transactionTypes, electricityBoards] =
    await Promise.all([
      db.from("energy_fuel_types").select("id, name, source_type").order("sort"),
      db.from("energy_use_types").select("id, name").order("sort"),
      db.from("energy_units").select("id, name, kind").order("sort"),
      db.from("energy_currencies").select("id, code, name").order("sort"),
      db.from("energy_electricity_sources").select("id, name, source_type").order("sort"),
      db.from("energy_transaction_types").select("id, name").order("sort"),
      db.from("energy_electricity_boards").select("id, name").order("sort"),
    ]);
  return {
    fuelTypes: (fuelTypes.data ?? []) as EnergyMasters["fuelTypes"],
    useTypes: (useTypes.data ?? []) as EnergyMasters["useTypes"],
    units: (units.data ?? []) as EnergyMasters["units"],
    currencies: (currencies.data ?? []) as EnergyMasters["currencies"],
    electricitySources: (electricitySources.data ?? []) as EnergyMasters["electricitySources"],
    transactionTypes: (transactionTypes.data ?? []) as EnergyMasters["transactionTypes"],
    electricityBoards: (electricityBoards.data ?? []) as EnergyMasters["electricityBoards"],
  };
}

// ── Sites (facility hierarchy) ────────────────────────────────────────────────
export async function listSites(orgId: string): Promise<EnergySite[]> {
  const { data } = await admin()
    .from("energy_sites")
    .select("id, business_unit, location")
    .eq("org_id", orgId)
    .order("business_unit");
  return (data ?? []) as EnergySite[];
}

export async function createSite(orgId: string, userId: string, input: SiteInput): Promise<EnergySite> {
  const { data, error } = await admin()
    .from("energy_sites")
    .upsert(
      { org_id: orgId, user_id: userId, business_unit: input.business_unit, location: input.location },
      { onConflict: "org_id,business_unit,location" },
    )
    .select("id, business_unit, location")
    .single();
  if (error) throw new Error(error.message);
  return data as EnergySite;
}

// ── Helper: pluck a master name by id ─────────────────────────────────────────
async function nameById(table: string, id: string | null | undefined, col = "name") {
  if (!id) return null;
  const { data } = await admin().from(table).select(col).eq("id", id).maybeSingle();
  return (data as Record<string, string> | null)?.[col] ?? null;
}

// ── Fuel entries ──────────────────────────────────────────────────────────────
const FUEL_COLS =
  "id, site_id, bill_date, fuel_type_id, fuel_type_name, use_type_id, use_type_name, source_type, quantity, unit_id, unit_name, amount_paid, currency_id, currency_code, heat_content, carbon_content, manual_ef, emission_factor, ef_source, ef_provenance, tco2e, calc_formula, scope, evidence_paths, status, comment, created_at";

export async function listFuelEntries(orgId: string): Promise<FuelEntry[]> {
  const { data } = await admin()
    .from("energy_fuel_entries")
    .select(FUEL_COLS)
    .eq("org_id", orgId)
    .order("bill_date", { ascending: false });
  return (data ?? []) as unknown as FuelEntry[];
}

/** Build the denormalized + computed fields common to create/update. */
async function buildFuelRow(input: FuelEntryInput) {
  const db = admin();
  const [fuelType, useTypeName, unitName, currency] = await Promise.all([
    db.from("energy_fuel_types").select("name, source_type").eq("id", input.fuel_type_id).maybeSingle(),
    nameById("energy_use_types", input.use_type_id),
    nameById("energy_units", input.unit_id),
    input.currency_id
      ? db.from("energy_currencies").select("code").eq("id", input.currency_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const fuelTypeName = (fuelType.data?.name as string) ?? null;
  const sourceType = (fuelType.data?.source_type as string) ?? null;

  const factor = await resolveFactor({
    query: fuelTypeName ?? "fuel",
    scope: 1,
    manualEf: input.manual_ef ?? null,
  });
  const calc = factor.ef != null ? calcFuelEmission(input.quantity, factor.ef, unitName ?? "") : null;

  return {
    site_id: input.site_id ?? null,
    bill_date: input.bill_date,
    fuel_type_id: input.fuel_type_id,
    fuel_type_name: fuelTypeName,
    use_type_id: input.use_type_id ?? null,
    use_type_name: useTypeName,
    source_type: sourceType,
    quantity: input.quantity,
    unit_id: input.unit_id ?? null,
    unit_name: unitName,
    amount_paid: input.amount_paid ?? null,
    currency_id: input.currency_id ?? null,
    currency_code: (currency.data as { code?: string } | null)?.code ?? null,
    heat_content: input.heat_content ?? null,
    carbon_content: input.carbon_content ?? null,
    manual_ef: input.manual_ef ?? null,
    emission_factor: factor.ef,
    ef_source: factor.source,
    ef_provenance: factor.provenance,
    tco2e: calc?.tco2e ?? null,
    calc_formula: calc?.formula ?? null,
    scope: 1,
    evidence_paths: input.evidence_paths,
  };
}

export async function createFuelEntry(orgId: string, userId: string, input: FuelEntryInput): Promise<FuelEntry> {
  const row = await buildFuelRow(input);
  const { data, error } = await admin()
    .from("energy_fuel_entries")
    .insert({ ...row, org_id: orgId, user_id: userId, status: "Submitted" })
    .select(FUEL_COLS)
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as FuelEntry;
}

export async function updateFuelEntry(orgId: string, id: string, input: FuelEntryInput): Promise<FuelEntry> {
  const row = await buildFuelRow(input);
  // Editing resets an entry to Submitted (re-review), mirroring legacy behavior.
  const { data, error } = await admin()
    .from("energy_fuel_entries")
    .update({ ...row, status: "Submitted", comment: null, reviewed_by: null, reviewed_at: null })
    .eq("org_id", orgId)
    .eq("id", id)
    .select(FUEL_COLS)
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as FuelEntry;
}

// ── Electricity entries ─────────────────────────────────────────────────────
const ELEC_COLS =
  "id, site_id, bill_date, bill_start, bill_end, electricity_source_id, electricity_source_name, source_type, transaction_type, electricity_board, unit_used, unit_id, unit_name, solar_export_kwh, amount_paid, currency_id, currency_code, manual_ef, emission_factor, ef_source, ef_provenance, tco2e, calc_formula, scope, evidence_paths, status, comment, created_at";

export async function listElectricityEntries(orgId: string): Promise<ElectricityEntry[]> {
  const { data } = await admin()
    .from("energy_electricity_entries")
    .select(ELEC_COLS)
    .eq("org_id", orgId)
    .order("bill_date", { ascending: false });
  return (data ?? []) as unknown as ElectricityEntry[];
}

async function buildElectricityRow(input: ElectricityEntryInput) {
  const db = admin();
  const [source, unitName, currency] = await Promise.all([
    db.from("energy_electricity_sources").select("name, source_type").eq("id", input.electricity_source_id).maybeSingle(),
    nameById("energy_units", input.unit_id),
    input.currency_id
      ? db.from("energy_currencies").select("code").eq("id", input.currency_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const sourceName = (source.data?.name as string) ?? null;
  const sourceType = (source.data?.source_type as string) ?? null;

  // Renewable sources have a zero grid factor; skip lookup and record 0.
  const isRenewable = sourceType === "Renewable";
  const factor = isRenewable && input.manual_ef == null
    ? { ef: 0, source: "none" as const, provenance: null }
    : await resolveFactor({ query: sourceName ?? "grid electricity", scope: 2, manualEf: input.manual_ef ?? null });
  const calc = factor.ef != null
    ? calcElectricityEmission(input.unit_used, factor.ef, input.solar_export_kwh ?? null)
    : null;

  return {
    site_id: input.site_id ?? null,
    bill_date: input.bill_date,
    bill_start: input.bill_start ?? null,
    bill_end: input.bill_end ?? null,
    electricity_source_id: input.electricity_source_id,
    electricity_source_name: sourceName,
    source_type: sourceType,
    transaction_type: input.transaction_type ?? null,
    electricity_board: input.electricity_board ?? null,
    unit_used: input.unit_used,
    unit_id: input.unit_id ?? null,
    unit_name: unitName ?? "kWh",
    solar_export_kwh: input.solar_export_kwh ?? null,
    amount_paid: input.amount_paid ?? null,
    currency_id: input.currency_id ?? null,
    currency_code: (currency.data as { code?: string } | null)?.code ?? null,
    manual_ef: input.manual_ef ?? null,
    emission_factor: factor.ef,
    ef_source: factor.source,
    ef_provenance: factor.provenance,
    tco2e: calc?.tco2e ?? null,
    calc_formula: calc?.formula ?? null,
    scope: 2,
    evidence_paths: input.evidence_paths,
  };
}

export async function createElectricityEntry(
  orgId: string,
  userId: string,
  input: ElectricityEntryInput,
): Promise<ElectricityEntry> {
  const row = await buildElectricityRow(input);
  const { data, error } = await admin()
    .from("energy_electricity_entries")
    .insert({ ...row, org_id: orgId, user_id: userId, status: "Submitted" })
    .select(ELEC_COLS)
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as ElectricityEntry;
}

export async function updateElectricityEntry(
  orgId: string,
  id: string,
  input: ElectricityEntryInput,
): Promise<ElectricityEntry> {
  const row = await buildElectricityRow(input);
  const { data, error } = await admin()
    .from("energy_electricity_entries")
    .update({ ...row, status: "Submitted", comment: null, reviewed_by: null, reviewed_at: null })
    .eq("org_id", orgId)
    .eq("id", id)
    .select(ELEC_COLS)
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as ElectricityEntry;
}

// ── Fugitive entries (Scope 1) ───────────────────────────────────────────────
const FUGITIVE_COLS =
  "id, site_id, method, method_label, reporting_year, gas, database_source, gwp, equipment_type, unit_name, inputs, released_kg, tco2e, calc_formula, scope, evidence_paths, status, comment, created_at";

const FUGITIVE_INPUT_KEYS: (keyof FugitiveInputs)[] = [
  "amount_refrigerant_charged", "refrigerant_capacity", "quantity_purchased",
  "inventory_start", "inventory_end", "purchased", "disposed",
  "service_refrigerant_purchases", "retiring_equipment_capacity", "recovered_refrigerant",
  "new_equipment_capacity", "new_equipment_refrigerant_purchases",
  "suppressant_capacity", "number_of_units", "emission_factor",
];

export async function getFugitiveMasters(): Promise<FugitiveMasters> {
  const db = admin();
  const [gwp, equipment, units] = await Promise.all([
    db.from("energy_gas_gwp").select("gas, source, gwp").order("sort").order("source"),
    db.from("energy_equipment_types").select("id, name, category, leak_rate, min_capacity, max_capacity").order("sort"),
    db.from("energy_units").select("id, name").order("sort"),
  ]);
  const byGas = new Map<string, { gas: string; sources: { source: string; gwp: number }[] }>();
  for (const r of (gwp.data ?? []) as { gas: string; source: string; gwp: number }[]) {
    if (!byGas.has(r.gas)) byGas.set(r.gas, { gas: r.gas, sources: [] });
    byGas.get(r.gas)!.sources.push({ source: r.source, gwp: r.gwp });
  }
  const equ = (equipment.data ?? []) as { id: string; name: string; category: string; leak_rate: number | null; min_capacity: number | null; max_capacity: number | null }[];
  return {
    gases: [...byGas.values()],
    refrigerationEquipment: equ.filter((e) => e.category === "refrigeration"),
    fireEquipment: equ.filter((e) => e.category === "fire_suppression").map((e) => ({ id: e.id, name: e.name, leak_rate: e.leak_rate })),
    units: (units.data ?? []) as FugitiveMasters["units"],
  };
}

export async function listFugitiveEntries(orgId: string): Promise<FugitiveEntry[]> {
  const { data } = await admin()
    .from("energy_fugitive_entries")
    .select(FUGITIVE_COLS)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as FugitiveEntry[];
}

async function buildFugitiveRow(input: FugitiveEntryInput) {
  const db = admin();
  const [gwpRow, equipmentRow, unitName] = await Promise.all([
    input.gas && input.database_source
      ? db.from("energy_gas_gwp").select("gwp").eq("gas", input.gas).eq("source", input.database_source).maybeSingle()
      : Promise.resolve({ data: null }),
    input.equipment_type
      ? db.from("energy_equipment_types").select("leak_rate").eq("name", input.equipment_type).maybeSingle()
      : Promise.resolve({ data: null }),
    nameById("energy_units", input.unit_id),
  ]);
  const gwp = (gwpRow.data as { gwp?: number } | null)?.gwp ?? null;
  const leakRate = (equipmentRow.data as { leak_rate?: number } | null)?.leak_rate ?? null;

  const inputs: FugitiveInputs = {};
  for (const k of FUGITIVE_INPUT_KEYS) {
    const v = (input as Record<string, unknown>)[k];
    if (v != null) inputs[k] = v as number;
  }
  // Fire suppression: default the annual emission factor to the equipment's rate
  // when the user didn't supply one.
  if (input.method === 5 && inputs.emission_factor == null && leakRate != null) {
    inputs.emission_factor = leakRate;
  }

  const calc = calcFugitive(input.method, inputs, gwp, leakRate);

  return {
    site_id: input.site_id ?? null,
    method: input.method,
    method_label: METHOD_LABELS[input.method] ?? null,
    reporting_year: input.reporting_year ?? null,
    gas: input.gas ?? null,
    database_source: input.database_source ?? null,
    gwp,
    equipment_type: input.equipment_type ?? null,
    unit_name: unitName,
    inputs: inputs as Record<string, number>,
    released_kg: calc.released_kg,
    tco2e: calc.tco2e,
    calc_formula: calc.formula,
    scope: 1,
    evidence_paths: input.evidence_paths,
  };
}

export async function createFugitiveEntry(orgId: string, userId: string, input: FugitiveEntryInput): Promise<FugitiveEntry> {
  const row = await buildFugitiveRow(input);
  const { data, error } = await admin()
    .from("energy_fugitive_entries")
    .insert({ ...row, org_id: orgId, user_id: userId, status: "Submitted" })
    .select(FUGITIVE_COLS)
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as FugitiveEntry;
}

export async function updateFugitiveEntry(orgId: string, id: string, input: FugitiveEntryInput): Promise<FugitiveEntry> {
  const row = await buildFugitiveRow(input);
  const { data, error } = await admin()
    .from("energy_fugitive_entries")
    .update({ ...row, status: "Submitted", comment: null, reviewed_by: null, reviewed_at: null })
    .eq("org_id", orgId)
    .eq("id", id)
    .select(FUGITIVE_COLS)
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as FugitiveEntry;
}

// ── Shared delete / approve / reject (table name passed in) ──────────────────
type EnergyTable = "energy_fuel_entries" | "energy_electricity_entries" | "energy_fugitive_entries";

export async function deleteEntry(table: EnergyTable, orgId: string, id: string): Promise<void> {
  const { error } = await admin().from(table).delete().eq("org_id", orgId).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setEntryReview(
  table: EnergyTable,
  orgId: string,
  id: string,
  reviewerId: string,
  decision: "Accepted" | "Rejected",
  feedback?: string,
): Promise<void> {
  const { error } = await admin()
    .from(table)
    .update({
      status: decision,
      comment: decision === "Rejected" ? feedback ?? null : null,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("org_id", orgId)
    .eq("id", id);
  if (error) throw new Error(error.message);
}
