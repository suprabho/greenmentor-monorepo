// ─────────────────────────────────────────────────────────────────────────────
// EFDB EMISSION-FACTOR INGESTION CLIENT
// Drives the EFDB extraction pipeline (scan → confirm → extract → review →
// commit) through the same /efdb proxy used by the factor lookup. All ingestion
// endpoints require an admin JWT — pass the efdbToken obtained from the Settings
// login. Mirrors efdb/frontend/src/lib/api.ts (ingestionApi), adapted for the
// /efdb base path and an explicit token arg instead of localStorage.
// ─────────────────────────────────────────────────────────────────────────────
const BASE = "/efdb";

function authHeader(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function jsonRequest(token, path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeader(token),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

async function formRequest(token, path, form) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: authHeader(token), // no Content-Type — browser sets multipart boundary
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export const ingestionApi = {
  // Step 1 — upload a PDF/Excel/CSV and scan for EF tables
  uploadAndScan: (token, file) => {
    const form = new FormData();
    form.append("file", file);
    return formRequest(token, "/ingestion/upload/scan", form);
  },

  // Step 1 (alt) — fetch a URL and scan it
  urlScan: (token, url) => {
    const form = new FormData();
    form.append("url", url);
    return formRequest(token, "/ingestion/url/scan", form);
  },

  // Step 2 — confirm sections + document metadata, kick off extraction job
  startExtraction: (token, sessionId, sectionIndices, confirmedMetadata) =>
    jsonRequest(token, `/ingestion/sessions/${sessionId}/extract`, {
      method: "POST",
      body: JSON.stringify({ section_indices: sectionIndices, confirmed_metadata: confirmedMetadata ?? null }),
    }),

  // Step 3 — poll session status (extracting → in_review → completed/failed)
  getSession: (token, sessionId) =>
    jsonRequest(token, `/ingestion/sessions/${sessionId}`),

  // Step 3 — paginated extracted records for review
  getRecords: (token, sessionId, page = 1, pageSize = 50) =>
    jsonRequest(token, `/ingestion/sessions/${sessionId}/records?page=${page}&page_size=${pageSize}`),

  // Step 3 — approve/reject/pending a single record (optionally with edits)
  reviewRecord: (token, sessionId, index, action, editedData, rejectionReason) =>
    jsonRequest(token, `/ingestion/sessions/${sessionId}/review/${index}`, {
      method: "POST",
      body: JSON.stringify({ action, edited_data: editedData, rejection_reason: rejectionReason }),
    }),

  // Step 3 — approve_all / reject_all (optionally a range of indices)
  bulkReview: (token, sessionId, action, indices, rejectionReason) =>
    jsonRequest(token, `/ingestion/sessions/${sessionId}/review/bulk`, {
      method: "POST",
      body: JSON.stringify({ action, indices, rejection_reason: rejectionReason }),
    }),

  // Step 4 — commit approved records into EFDB
  commit: (token, sessionId) =>
    jsonRequest(token, `/ingestion/sessions/${sessionId}/commit`, { method: "POST" }),
};

// Empty document-metadata shape (source-schema field names) used by the
// confirm-metadata step. Matches DocumentMetadata in the EFDB ingestion schema.
export function emptyMetadata() {
  return {
    source_organization: null,
    source_database: null,
    publication_title: null,
    publication_year: null,
    reference_year: null,
    valid_from: null,
    valid_to: null,
    country_iso: null,
    geography_type: null,
    geography_description: null,
    gwp_basis: null,
    ghg_scope: null,
    system_boundary: null,
    data_origin: null,
    calculation_method: null,
    notes: null,
    guidance_notes: null,
    clarifying_questions: null,
  };
}

// Read a source-schema field that may be either a bare value or an
// ExtractionFieldResult ({ value, source_snippet, ... }) wrapper.
export function fieldValue(entry) {
  if (entry && typeof entry === "object" && "value" in entry) return entry.value;
  return entry;
}
