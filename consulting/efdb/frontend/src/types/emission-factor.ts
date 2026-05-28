export interface EmissionFactor {
  // System
  id: string
  version_number: number
  has_conflict: boolean
  source_document_id: string | null
  extraction_session_id: string | null
  created_by_user_id: string | null
  last_edited_by_user_id: string | null
  last_edited_at: string | null
  created_at: string
  updated_at: string
  // Identity
  ef_id: string | null
  activity_name: string
  activity_description: string | null
  activity_code: string | null
  emission_category: string
  sub_category: string | null
  ghg_scope: string
  scope3_category: string | null
  activity_level: string | null
  // EF Value
  ef_value: number
  ghg_species: string
  expressed_as_co2e: boolean
  gwp_basis: string | null
  gwp_value_used: number | null
  ef_type: string
  // Units
  numerator_unit: string
  denominator_unit: string
  denominator_basis: string | null
  unit_notes: string | null
  // Geography
  geography_type: string
  country_iso: string | null
  region_name: string | null
  grid_zone_id: string | null
  location_basis: string | null
  // Technology
  fuel_material_type: string | null
  technology_descriptor: string | null
  vehicle_type: string | null
  end_use_sector: string | null
  combustion_type: string | null
  carbon_content_fraction: number | null
  // Temporal
  reference_year: number
  valid_from: string | null
  valid_to: string | null
  ef_version: string | null
  update_frequency: string | null
  // Source
  source_organization: string
  source_database: string | null
  publication_title: string | null
  publication_year: number | null
  source_url: string | null
  original_ef_value: number | null
  original_unit: string | null
  data_origin: string
  // Methodology
  calculation_method: string
  system_boundary: string
  includes_biogenic_co2: boolean | null
  includes_land_use_change: boolean | null
  allocation_method: string | null
  upstream_included: boolean | null
  // DQ
  uncertainty_pct: number | null
  uncertainty_method: string | null
  dq_score_overall: number | null
  dq_geographic_rep: number | null
  dq_temporal_rep: number | null
  dq_tech_rep: number | null
  third_party_verified: boolean | null
  // Operational
  status: string
  superseded_by_ef_id: string | null
  superseded_reason: string | null
  framework_tags: string[] | null
  sector_tags: string[] | null
  is_default_ef: boolean | null
  created_by: string | null
  notes: string | null
}

export interface EFListResponse {
  items: EmissionFactor[]
  total: number
  page: number
  page_size: number
}

export interface EFFilters {
  q?: string
  year?: number
  country?: string          // ISO3
  region?: string
  scope?: string            // "1" | "2" | "3"
  species?: string          // "CO2e" | "CO2" | "CH4" | ...
  category?: string         // emission_category
  source_organization?: string
  max_dq_score?: number     // 1=best, 5=worst
  conflicts_only?: boolean
  gwp_basis?: string
  framework_tags?: string
  sector_tags?: string
  include_superseded?: boolean
  sort_by?: string
  sort_dir?: 'asc' | 'desc'
  page?: number
  page_size?: number
}

export interface AuditLogEntry {
  id: string
  action: string
  actor_id: string | null
  emission_factor_id: string | null
  details: Record<string, unknown> | null
  created_at: string
}

export interface VersionEntry {
  id: string
  version_number: number
  snapshot: Record<string, unknown>
  edited_by: string
  edited_at: string
  edit_summary: string | null
}

// Ingestion types
export interface DocumentSection {
  index: number
  title: string
  page_range: string
  column_headers: string[]
  description: string
  row_count_estimate: number
}

export interface DocumentMetadata {
  source_organization: string | null
  source_database: string | null
  publication_title: string | null
  publication_year: number | null
  reference_year: number | null
  valid_from: string | null
  valid_to: string | null
  country_iso: string | null            // ISO3
  geography_type: string | null
  geography_description: string | null
  gwp_basis: string | null
  ghg_scope: string | null
  system_boundary: string | null
  data_origin: string | null
  calculation_method: string | null
  notes: string | null
  guidance_notes: string | null
  clarifying_questions: string[] | null
}

export interface ScanResult {
  session_id: string
  document_id: string
  sections_found: DocumentSection[]
  estimated_tokens: number
  estimated_cost_usd: number
  page_count: number
  has_scanned_pages: boolean
  document_metadata: DocumentMetadata | null
}

export interface ExtractionFieldResult {
  value: unknown
  source_snippet: string | null
  extraction_confidence: 'high' | 'medium' | 'low'
  extraction_note: string | null
}

export interface ExtractedRecord {
  index: number
  activity_name: ExtractionFieldResult
  ef_value: ExtractionFieldResult
  ghg_species: ExtractionFieldResult
  numerator_unit: ExtractionFieldResult
  denominator_unit: ExtractionFieldResult
  has_outlier_values: boolean
  has_unit_mismatch: boolean
  outlier_notes: string[]
  [key: string]: unknown
}

export interface SessionStatus {
  id: string
  status: string
  total_extracted: number
  total_approved: number
  total_rejected: number
  error_message: string | null
  created_at: string
  updated_at: string
}

export interface ReviewSummary {
  approved: number
  rejected: number
  conflicts_flagged: number
  records_committed: string[]
}

export interface User {
  id: string
  email: string
  full_name: string
  role: 'admin' | 'analyst'
  is_active: boolean
  created_at: string
}
