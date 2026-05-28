export interface EmissionFactor {
  id: string
  version_number: number
  is_current: boolean
  is_superseded: boolean
  superseded_by_id: string | null
  superseded_reason: string | null
  has_conflict: boolean
  migrated: boolean
  source_activity_name: string
  canonical_activity_name: string
  activity_category: string | null
  unit: string
  ef_total_co2e: number | null
  ef_co2: number | null
  ef_ch4: number | null
  ef_n2o: number | null
  ef_pfc: number | null
  ef_sf6: number | null
  ef_nf3: number | null
  applicable_scopes: string[] | null
  lca_stages: string[] | null
  source_name: string | null
  source_type: string | null
  source_url: string | null
  source_document_id: string | null
  extraction_session_id: string | null
  validity_start: string | null
  validity_end: string | null
  geography_global: boolean
  geography_country: string | null
  geography_region: string | null
  confidence_score: number | null
  confidence_breakdown: ConfidenceBreakdown | null
  gwp_version: string | null
  supplier_name: string | null
  supplier_country: string[] | null
  supplier_sector: string | null
  supplier_epd_reference: string | null
  comments_applicability: string | null
  comments_limitations: string | null
  custom_tags: string[] | null
  additional_notes: string | null
  created_by: string
  created_at: string
  last_edited_by: string | null
  last_edited_at: string | null
}

export interface ConfidenceBreakdown {
  source_type: number
  audited: number
  geography: number
  recency: number
  total: number
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
  country?: string
  region?: string
  scope?: string
  source_type?: string
  min_confidence?: number
  conflicts_only?: boolean
  gwp_version?: string
  tags?: string
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
  source_name: string | null
  source_type: string | null
  year: number | null
  validity_start: number | null
  validity_end: number | null
  geography_country: string | null
  geography_description: string | null
  gwp_version: string | null
  applicable_scopes: string[] | null
  lca_stages: string[] | null
  comments_applicability: string | null
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
  source_activity_name: ExtractionFieldResult
  canonical_activity_name: ExtractionFieldResult
  unit: ExtractionFieldResult
  ef_total_co2e: ExtractionFieldResult
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
