// Shared types for the Energy (Scope 1 + 2) module. Row shapes mirror the
// columns in supabase/migrations/0013_energy.sql.

export type EntryStatus = "Draft" | "Submitted" | "Accepted" | "Rejected";
export type EfSource = "manual" | "efdb" | "none";
export type SourceType = "Renewable" | "Non-Renewable";

export interface EnergySite {
  id: string;
  business_unit: string;
  location: string;
}

export interface FuelEntry {
  id: string;
  site_id: string | null;
  bill_date: string;
  fuel_type_id: string | null;
  fuel_type_name: string | null;
  use_type_id: string | null;
  use_type_name: string | null;
  source_type: SourceType | null;
  quantity: number;
  unit_id: string | null;
  unit_name: string | null;
  amount_paid: number | null;
  currency_id: string | null;
  currency_code: string | null;
  heat_content: number | null;
  carbon_content: number | null;
  manual_ef: number | null;
  emission_factor: number | null;
  ef_source: EfSource;
  ef_provenance: EfProvenance | null;
  tco2e: number | null;
  calc_formula: string | null;
  scope: number;
  evidence_paths: string[];
  status: EntryStatus;
  comment: string | null;
  created_at: string;
}

export interface ElectricityEntry {
  id: string;
  site_id: string | null;
  bill_date: string;
  bill_start: string | null;
  bill_end: string | null;
  electricity_source_id: string | null;
  electricity_source_name: string | null;
  source_type: SourceType | null;
  transaction_type: string | null;
  electricity_board: string | null;
  unit_used: number | null;
  unit_id: string | null;
  unit_name: string | null;
  solar_export_kwh: number | null;
  amount_paid: number | null;
  currency_id: string | null;
  currency_code: string | null;
  manual_ef: number | null;
  emission_factor: number | null;
  ef_source: EfSource;
  ef_provenance: EfProvenance | null;
  tco2e: number | null;
  calc_formula: string | null;
  scope: number;
  evidence_paths: string[];
  status: EntryStatus;
  comment: string | null;
  created_at: string;
}

/** A single EFDB emission-factor candidate we resolved a row against. */
export interface EfProvenance {
  ef_id: string | null;
  activity: string | null;
  ef_value: number | null;
  numerator_unit: string | null;
  denominator_unit: string | null;
  ghg_scope: string | null;
  country: string | null;
  reference_year: number | null;
  source_organization: string | null;
  dq_score: number | null;
}

/** The seeded master/reference sets served to the forms. */
export interface EnergyMasters {
  fuelTypes: { id: string; name: string; source_type: SourceType }[];
  useTypes: { id: string; name: string }[];
  units: { id: string; name: string; kind: "fuel" | "electricity" | "both" }[];
  currencies: { id: string; code: string; name: string }[];
  electricitySources: { id: string; name: string; source_type: SourceType }[];
  transactionTypes: { id: string; name: string }[];
  electricityBoards: { id: string; name: string }[];
}
