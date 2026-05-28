# EFDB — Emission Factor Database
### Product Requirements & Architecture Plan

---

## 1. Overview

EFDB is an internal tool for a sustainability team to **ingest, catalogue, and retrieve greenhouse gas (GHG) emission factors** for use in GHG accounting workflows. The tool allows users to upload PDFs, Excel files, or paste source URLs from publicly available sources (IPCC, EPA, ecoinvent exports, government databases, etc.), uses an AI agent powered by Claude (Anthropic API) to extract and structure the data, routes it through a human review step, and stores it in a queryable database. A separate AI chat interface lets analysts ask natural-language questions to retrieve the most appropriate emission factor for a given activity, geography, and time period.

This is a **read/write internal tool** — not a public-facing product.

---

## 2. Goals

| Goal | Description |
|------|-------------|
| **Centralise EF data** | Single source of truth for all emission factors used by the team |
| **AI-first ingestion** | AI does the heavy lifting of extracting and cataloguing data from messy source documents |
| **Confident retrieval** | Users can filter and query EFs with enough context to trust which one to use |
| **Auditability** | Every record tracks provenance, version history, and who touched it |
| **Extensibility** | Schema has named extension fields; confidence scoring is configurable |

## 3. Non-Goals (v1)

- Public API or external access (architecture must support adding this in Phase 3)
- Offline support
- Automated GHG calculation (lookup/reference tool only)
- Integration with reporting tools (future phase)
- Manual data entry as a priority feature (deprioritised to Phase 3)
- Record locking / "used in report" tracking (removed — version history is sufficient)
- Saved filter presets
- Chat query logging

---

## 4. Users & Roles

| Role | Permissions |
|------|-------------|
| **Admin** | Upload documents, review/approve AI extractions, edit/delete records, manage users, configure confidence score weights |
| **Analyst** | Filter and browse the table, use the AI chat, export to CSV/Excel |

Authentication: standard username/password login (JWT-based). No SSO required for v1.

---

## 5. Data Schema

Each emission factor record contains the following fields:

### 5.1 Core Fields

| # | Field | Type | Notes |
|---|-------|------|-------|
| 1a | **Source Activity Name** | Text | Verbatim name from the source document (e.g., "diesel, burned in building machine") |
| 1b | **Canonical Activity Name** | Text | AI-generated standardised name (e.g., "Diesel — construction equipment combustion"). Reviewer can override at review step. Used for cross-source search. |
| 1c | **Activity Category** | Text | AI-assigned category hierarchy (e.g., "Fuel combustion > Liquid fuels > Diesel"). Supports structured browsing. |
| 2 | **Unit** | Text | Unit of the emission factor as stated in the source (e.g., kg CO2e / kWh, kg CO2e / litre). Stored verbatim — no normalisation. UI warns when comparing records with different units. |
| 3a | **EF — Total CO2e** | Decimal | Central value in the stated unit |
| 3b | **EF — CO2 component** | Decimal | CO2 contribution to total |
| 3c | **EF — CH4 component** | Decimal | CH4 contribution (as CO2e) |
| 3d | **EF — N2O component** | Decimal | N2O contribution (as CO2e) |
| 3e | **EF — PFC component** | Decimal | PFC contribution (as CO2e) |
| 3f | **EF — SF6 component** | Decimal | SF6 contribution (as CO2e) |
| 3g | **EF — NF3 component** | Decimal | NF3 contribution (as CO2e) |
| 4 | **Applicable GHG Scope(s)** | Multi-select enum | GHG Protocol scopes + Scope 3 categories (see §5.2). One EF can apply to multiple scopes. |
| 5a | **GHG Protocol Scope** | Multi-select | Scope 1 / 2 / 3 |
| 5b | **Life Cycle Stage (LCA)** | Multi-select | ISO 14044 stages: raw material extraction, manufacturing, transport & distribution, use phase, end-of-life, beyond system boundary |
| 6 | **Source Name** | Text | Name of the source document or database (e.g., "IPCC AR6 WG1 Annex II", "DEFRA 2024 EF Spreadsheet") |
| 6a | **Source Type** | Enum | Classification of the source (see §5.3) |
| 6b | **Source URL** | URL (optional) | Direct link to the source page or document. Marked with a paywall flag if needed. For file-uploaded sources, this may be blank. |
| 7 | **Validity Start Date** | Date | Start of the period this EF is valid for |
| 8 | **Validity End Date** | Date | End of validity period. Null = no stated expiry. |
| 9 | **Geography** | Hierarchical | Global / Country (ISO 3166-1 alpha-2) / Region or State (ISO 3166-2). "Global" is a valid entry. |
| 10 | **Confidence Score** | Integer (0–100) | Rule-based score (see §7). Recalculated on-demand when admin changes weights. |
| 11 | **GWP Version** | Enum | Which IPCC assessment report / GWP timeframe the EF values are based on: AR4 / AR5 / AR6 / GWP20 / GWP100 / Not stated |
| 12 | **Supplier / Company** | Structured (optional) | Only populated for supplier-specific EFs or EPD-sourced data. Fields: supplier name, country, sector, product/EPD reference. |
| 13 | **Comments — Applicability** | Long text | AI pre-fills from source footnotes/caveats; reviewer edits before committing. When this EF should or should not be used. |
| 14 | **Comments — Limitations** | Long text | AI pre-fills from source caveats; reviewer edits. Known limitations, exclusions, caveats. |
| 15 | **Custom Tags** | Array of strings | Free-form tags for internal categorisation (e.g., "priority", "transport", "scope3-cat4"). |
| 16 | **Additional Notes** | Long text | Catch-all free-text field for any critical information not captured in any other field. Left blank if nothing to add. |

### 5.2 GHG Protocol Scope Taxonomy (multi-select)

```
Scope 1
Scope 2
Scope 3 — Category 1:  Purchased goods & services
Scope 3 — Category 2:  Capital goods
Scope 3 — Category 3:  Fuel & energy-related activities
Scope 3 — Category 4:  Upstream transportation & distribution
Scope 3 — Category 5:  Waste generated in operations
Scope 3 — Category 6:  Business travel
Scope 3 — Category 7:  Employee commuting
Scope 3 — Category 8:  Upstream leased assets
Scope 3 — Category 9:  Downstream transportation & distribution
Scope 3 — Category 10: Processing of sold products
Scope 3 — Category 11: Use of sold products
Scope 3 — Category 12: End-of-life treatment of sold products
Scope 3 — Category 13: Downstream leased assets
Scope 3 — Category 14: Franchises
Scope 3 — Category 15: Investments
```

### 5.3 Source Type Enum

```
Government / Regulatory body     (e.g., EPA, DEFRA, MoEFCC)
Intergovernmental body           (e.g., IPCC, IEA, UNEP)
GHG Protocol / Industry standard
Commercial LCA database export   (e.g., ecoinvent CSV export, SimaPro export)
Peer-reviewed publication
Industry association
Supplier-provided / EPD
Internal estimate
Other
```

> **Note:** Only publicly available, free data sources are in scope. Paywalled databases (ecoinvent subscription, SimaPro) are ingested via user-exported CSV/Excel files — the system does not hold a subscription or access credentials for any external database.

### 5.4 System-Managed Fields

| Field | Description |
|-------|-------------|
| `record_id` | Auto-generated UUID |
| `version` | Integer, increments on each edit |
| `is_current` | Boolean — only the latest version is `true`. Table view shows current versions only by default. |
| `is_superseded` | Boolean — admin has explicitly marked this record as superseded by another. Excluded from default table view; shown in AI chat with a warning badge. |
| `created_by` | User ID |
| `created_at` | Timestamp |
| `last_edited_by` | User ID |
| `last_edited_at` | Timestamp |
| `source_document_id` | FK to the uploaded source file (if file-uploaded) |
| `source_url` | URL of source (if URL-ingested) |
| `extraction_session_id` | FK to the ingestion session |
| `has_conflict` | Boolean — flagged when a similar record exists in the database |
| `migrated` | Boolean — true for records bulk-imported from pre-existing data |
| `vector_embedding` | Float array — stored via pgvector for semantic search on canonical activity name |

---

## 6. Feature Specifications

### 6.1 Data Ingestion — Three Pathways

#### A. PDF Upload (primary pathway — AI priority)

1. User uploads a PDF file via the ingestion UI.
2. **Cost estimate is shown** before processing begins: estimated token count and approximate API cost ('~$6 estimated for this document'). User confirms to proceed.
3. For documents of any length: the agent scans the entire document and **returns a list of identified tables/sections** containing emission factor data (table title, page numbers, column headers, brief description). User selects which to extract.
4. **Scanned PDFs (image-based):** Pages are detected as images and passed to Claude via vision (Claude Opus 4.6 natively reads images). No separate OCR library required. The system auto-detects whether a page is text-based or image-based and handles both.
5. Claude extracts all emission factor records from selected sections. For each extracted field:
   - The verbatim source text snippet that produced the value is stored
   - An extraction confidence level is assigned: `high / medium / low`
6. Claude also generates the **canonical activity name**, **activity category**, and **pre-fills** the applicability/limitations comments from any source footnotes or caveats near the table.
7. The system presents extracted records in a **paginated review panel** (50 records per page). The review session is **auto-saved server-side** — the user can close the browser and return to continue.
8. **Outlier flagging:** Any extracted numeric value that is zero, negative, or more than 3× the median of comparable records in the database is highlighted in orange with a note.
9. **Unit inconsistency:** If the unit differs from the most common unit for similar records, a warning is shown.
10. For each record, the reviewer can: approve, edit individual fields (with source snippet visible), or reject.
11. Rejected records are archived (not deleted) with a rejection reason in the `rejected_extractions` log.
12. Approved records are committed. A summary is shown: *X records added, Y rejected, Z flagged as conflicts.*
13. If new records conflict with existing ones, **all admins receive an in-app notification**.

#### B. URL Ingestion (alongside file upload)

1. User pastes a URL to a publicly accessible source page or document (e.g., a government web page, a downloadable PDF link).
2. The system fetches the content. If the URL resolves to a PDF, it follows pathway A. If it resolves to an HTML page, Claude extracts EF data from the page structure.
3. The source URL is stored and linked to every record it produced.
4. Same review flow as pathway A.

#### C. Excel / CSV Upload (secondary pathway — AI priority)

1. User uploads any Excel or CSV file (no fixed template required).
2. **Cost estimate shown** before processing.
3. For multi-sheet Excel files: agent lists sheets and previews the first 10 rows of each. User selects sheets to process.
4. Claude inspects the file, proposes a **column → schema field mapping**, and displays it for the user to confirm or correct before extraction begins.
5. Unmapped columns (columns Claude cannot confidently map to a schema field): Claude first attempts to route each to the best-fit field. Columns that don't fit any field are consolidated into the **Additional Notes** field of the extracted record, with the original column name and value noted.
6. Same review flow as pathway A (paginated, auto-saved, outlier flagging).

#### D. Manual Entry (deprioritised — Phase 3)

1. A form with all schema fields, with dropdowns/pickers for structured fields.
2. Commits directly to the database — no review step needed (user is the author).
3. Supplier info section appears only when Source Type = "Supplier-provided / EPD".

---

### 6.2 Table View & Filtering

The main screen is a **dense data table** with a collapsible side panel for record details.

**Default view:** Current versions only (`is_current = true`, `is_superseded = false`).

#### Filter controls (always visible, top of page):

| Filter | Behaviour |
|--------|-----------|
| **Activity Name** | **Semantic search** using vector embeddings (pgvector). Searching "petrol" finds records tagged "gasoline", "motor spirit", etc. Searches canonical activity name. |
| **Year** | Single year input; returns all records where `validity_start ≤ year ≤ validity_end` |
| **Geography** | Hierarchical dropdown: Global → Country → Region/State |
| **GHG Scope** | Multi-select from full scope taxonomy |
| **Source Type** | Multi-select from source type enum |
| **Confidence Score** | Range slider (e.g., ≥ 70%) |
| **Has Conflict** | Toggle to show only flagged records |
| **GWP Version** | Filter by AR4 / AR5 / AR6 / GWP20 / GWP100 |
| **Tags** | Filter by custom tags |

**Phase 2 additional filters:** LCA stage, include superseded records toggle.

#### Table columns (default view):

Canonical Activity Name | Unit | Total CO2e | Scope | Geography | GWP | Source | Validity | Confidence | ⚠ conflict

Columns are resizable and sortable. Column visibility is user-configurable.

#### Side panel (on row click):

- All fields in a clean two-column layout
- GHG components as a mini table (CO2 / CH4 / N2O / PFC / SF6 / NF3 / Total)
- Unit displayed prominently; warning shown if it differs from related records
- Confidence score as a progress bar with a **breakdown tooltip on hover** (shows points per criterion)
- "Conflicting records" section: lists each conflict with its confidence score and reasoning
- "Version history" timeline: v1 → v2 → v3 with timestamps and editor names. Any version viewable in full; previous versions restorable by admins.
- "Source document" link / URL to original source
- Audit log entries for this record

#### Export:

Filtered results → Excel (.xlsx) or CSV. Includes all visible fields + confidence score, version, source, created/edited by.

---

### 6.3 AI Chat — Emission Factor Recommendation

A chat panel (slide-in from the right, does not replace the table view) for natural-language EF queries.

**Confidence floor:**
- Admin sets an **org-wide minimum confidence floor** (e.g., 60%). The chat never recommends records below this floor.
- Users can **raise** the floor per query ("only show me factors above 80%") but cannot lower it below the admin-set minimum.

**Session behaviour:** Context retained within a session. User can refine queries conversationally ("change that to India", "what about Scope 1 instead"). Session clears on panel close. No persistent chat history.

**Response format for a matched query:**
1. **Top recommendation** — the single best-matched EF with full citation
2. **Top 3 candidates** — ranked list with confidence scores and key differentiators
3. **Reasoning** — why each was selected: source type weight, geography specificity match, year proximity, GWP version alignment, confidence score breakdown

**Response format when no match exists:**
- State clearly that no matching EF was found for the given criteria
- Return the **closest available match** with a clear disclaimer noting what differs (geography, year, scope)
- Suggest **where to find a better match** (e.g., "A more specific factor may exist in the MoEFCC 2024 EF document — it hasn't been uploaded to this database yet")

**Superseded records:** Shown in chat results only with a visible "Superseded" badge and a note explaining why.

**Tool available to Claude:**
```python
search_emission_factors(
    activity_query: str,       # semantic search on canonical name
    geography: str,            # ISO code or "Global"
    year: int,                 # filter by validity range
    scope: list[str],          # GHG protocol scope/categories
    gwp_version: str,          # optional: AR5, AR6, etc.
    min_confidence: int        # admin floor, user may raise
) -> list[EmissionFactorRecord]
```

---

### 6.4 Conflict Detection

When a new record is committed, the system checks for potential conflicts: records with the same or similar canonical activity name (semantic similarity), overlapping validity period, and same or broader geography.

- Both records are flagged with `has_conflict = true`
- Both are retained — neither is hidden or deleted
- **All admins receive an in-app notification** when a conflict is introduced
- The side panel shows a "Conflicting Records" section with confidence scores and source details for each
- Admins can resolve a conflict by marking one record as **superseded** (setting `is_superseded = true`). The superseded record remains in version history but is hidden from default table view and shown in AI chat with a warning.

---

## 7. Confidence Score System

The confidence score (0–100%) is calculated deterministically using a weighted rule system. Weights are configurable by admins via a configuration UI.

### Default Scoring Criteria

| Criterion | Max Points | Logic |
|-----------|-----------|-------|
| **Source type** | 35 | Govt/intergovernmental = 35, Peer-reviewed = 28, Commercial LCA DB = 22, Industry association = 16, Supplier/EPD = 12, Internal estimate = 5 |
| **Peer-reviewed / independently audited** | 20 | +20 if independently verified/audited; +10 if published (not audited); +0 otherwise |
| **Geography specificity** | 25 | Country + region = 25, Country only = 20, Regional bloc = 12, Global average = 5 |
| **Data recency** | 20 | Current year = 20; subtract 2 pts per year of age of the EF, floored at 0 |

**Total: 100 points**

### Optional Additional Criteria (admin may enable)

| Criterion | Rationale |
|-----------|-----------|
| **Completeness** | Records with all 7 GHG component values score higher than those with only Total CO2e |
| **Uncertainty range present** | A ±% or min/max range in the source indicates more rigorous methodology |
| **Consistency with similar records** | EF value within ±15% of the median of comparable records gets a small bonus |
| **Source document age vs. EF measurement date** | A 2024 publication citing a 2010 measurement scores lower than a 2024 measurement |
| **GWP version alignment** | Records using the latest IPCC AR (currently AR6) score slightly higher |

### Weight Configuration & Recalculation

- Admin can change criterion weights via the **admin panel** (Phase 2).
- Before saving, a **before/after preview** is shown: a sample of 20 records with old score → new score displayed.
- After confirming, admin triggers a **bulk recalculation**. The system shows "X records will be affected" before running. The event is logged in the audit trail.
- Going forward, scores are recalculated on edit.

---

## 8. Version History & Audit Log

### Record Versioning

- Every edit to a record creates a new version. The old version is preserved in `record_versions`.
- `is_current = true` marks the active version. Table view only shows current versions.
- The side panel shows a version timeline: v1 → v2 → v3 with timestamps and editor names.
- Any version can be viewed in full; previous versions can be restored by admins.

### Audit Log

| Event | Logged Fields |
|-------|---------------|
| Record created | user, timestamp, ingestion pathway (upload/URL/manual), extraction session ID |
| Record edited | user, timestamp, field name, old value, new value |
| Record deleted / archived | user, timestamp, reason |
| Record approved (review step) | reviewer, timestamp, extraction session ID |
| Record rejected (review step) | reviewer, timestamp, rejection reason |
| Record marked superseded | user, timestamp, reason, linked conflicting record ID |
| Conflict flagged | system, timestamp |
| Confidence score bulk recalculated | admin, timestamp, old avg score, new avg score, records affected count |
| Review session resumed | user, timestamp, session ID |

---

## 9. AI Architecture

### 9.1 Models & API

All AI features use the **Anthropic Claude API**.

| Feature | Model | Rationale |
|---------|-------|-----------|
| PDF extraction (text-based) | Claude Opus 4.6 | High accuracy for multi-page table parsing and field mapping |
| PDF extraction (scanned/image-based) | Claude Opus 4.6 (vision) | Native multimodal — reads image pages without a separate OCR layer |
| URL page extraction | Claude Opus 4.6 | Unstructured HTML requires strong reasoning |
| Excel column mapping | Claude Sonnet 4.6 | Faster and sufficient for structured file mapping |
| AI chat (recommendation) | Claude Sonnet 4.6 | Balance of reasoning quality and response speed |
| Canonical name + category generation | Claude Sonnet 4.6 | Runs at extraction time alongside schema mapping |

### 9.2 PDF Extraction Agent — Full Flow

```
PDF upload / URL
  → Detect page types: text vs. image (scanned)
  → For text pages: extract with PyMuPDF (preserves table layout)
  → For image pages: pass as images to Claude Opus 4.6 (vision)
  → Pass full document representation to Claude
  → Prompt: "Identify all tables containing emission factor data.
             Return: table title, page range, column headers, 1-sentence description."
  → Present table list to user → user selects sections
  → Cost estimate shown → user confirms
  → For selected tables:
      → Extract all rows
      → For each row, map fields to EFDB schema
      → Generate canonical activity name + category
      → Pre-fill applicability/limitations comments from source footnotes
      → For each field: store source text snippet + extraction confidence (high/med/low)
      → Flag outliers (zero, negative, >3x median of comparable records)
      → Flag unit inconsistencies
  → Return structured JSON to review UI
  → Review session persisted server-side (auto-save)
```

**System prompt principles:**
- Extract verbatim values — no rounding, no interpolation
- If a field cannot be determined from the source, mark as `null` with an `extraction_note`
- Every numeric value must cite the source text that produced it — no value without provenance
- If a value appears anomalous (unusually high/low for this gas type), add an `extraction_note` explaining why it may be correct

### 9.3 AI Accuracy Protections

These design choices directly address the four known AI extraction failure modes:

| Failure Mode | Protection |
|---|---|
| **Wrong number extracted** | Source text snippet shown next to every numeric value in the review panel. Reviewer sees exactly what Claude read. |
| **Wrong unit extracted** | Unit is prominently displayed in the review panel; highlighted in orange if it differs from the most common unit for similar activity records. |
| **Missing records** | After extraction, the summary shows: "X tables found in document, Y tables selected, Z records extracted from selected tables." Low extraction confidence rows are sorted to the top of the review queue. |
| **Hallucinated values** | Extraction confidence per field (high/med/low) is shown. Any field marked `low` or where no source snippet can be found is flagged prominently. Admin must explicitly confirm low-confidence fields. |

### 9.4 Excel Extraction Agent

```
Excel upload
  → Parse sheet names + preview first 10 rows per sheet
  → User selects sheets to process
  → Cost estimate shown → user confirms
  → Claude proposes: column → schema field mapping
  → User confirms or corrects the mapping
  → Extract all rows using confirmed mapping
  → Rows with missing required fields (Total CO2e, Unit, Activity Name) are flagged
  → Unmapped columns: Claude routes to best-fit field OR consolidates into Additional Notes
  → Same review flow (paginated, auto-saved, outlier flagging)
```

### 9.5 AI Chat Agent

```
User message (session context retained)
  → Claude parses intent: activity, geography, year, GWP version, scope, other constraints
  → Claude calls: search_emission_factors(..., min_confidence=admin_floor)
  → Database returns up to 10 candidates (semantic similarity + confidence ranked)
  → Claude filters out records below confidence floor
  → If results exist:
      → Rank top 3
      → Format: top recommendation card + ranked list + reasoning
      → Superseded records shown with badge + warning note
  → If no results:
      → State clearly no match found
      → Return closest match with diff explanation
      → Suggest known authoritative source that may have a better factor
  → Cited records are linkable → opens full record in table view
```

### 9.6 Semantic Search (pgvector)

At extraction time, Claude generates the canonical activity name. The system generates a **vector embedding** of the canonical name using a text embedding model and stores it in PostgreSQL via the `pgvector` extension.

Activity name search in the table and in the AI chat tool uses **cosine similarity** on these embeddings rather than keyword matching. This means:
- "petrol" matches "gasoline", "motor spirit", "unleaded fuel"
- "diesel freight" matches "road transport diesel", "HSD combustion — transport"
- Exact keyword search is also available as a fallback via the standard full-text index

---

## 10. Technical Stack

### Backend
- **Language:** Python 3.11+
- **Framework:** FastAPI
- **Database:** PostgreSQL 16 with `pgvector` extension (semantic search) and `pg_trgm` (fuzzy text fallback)
- **ORM:** SQLAlchemy 2.0 with Alembic migrations
- **File storage:** Local filesystem v1; swap to S3-compatible object storage if cloud deployed
- **PDF parsing:** PyMuPDF (fitz) for text-based PDF page extraction + layout preservation
- **Excel parsing:** openpyxl / pandas for sheet inspection before passing to Claude
- **AI:** Anthropic Python SDK (`anthropic`)
- **Async jobs:** FastAPI `BackgroundTasks` for extraction jobs in v1 (simple, no additional infrastructure). Upgrade to Celery + Redis if concurrent extraction jobs become a bottleneck.
- **Auth:** JWT tokens with bcrypt password hashing

### Frontend
- **Framework:** React 18 + TypeScript
- **UI library:** shadcn/ui (Tailwind-based, data-dense components)
- **Table:** TanStack Table v8 (virtualised, filterable, sortable, resizable columns)
- **State management:** TanStack Query (server state) + Zustand (UI state)
- **Build tool:** Vite
- **PDF viewer:** PDF.js (inline PDF preview in review panel, Phase 2)

### Infrastructure
- **Containerisation:** Docker + Docker Compose (single command to run the full stack)
- **Deployment:** TBD — Docker Compose supports local, intranet, or cloud (Railway / Render / AWS ECS) with minimal changes. Architecture prepared for a read-only API endpoint in Phase 3.

---

## 11. UI/UX Specification

### 11.1 Main Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  EFDB                               [Upload]  [AI Chat]  [User ▾]│
├──────────────────────────────────────────────────────────────────┤
│  🔍 [Semantic activity search...]  [Year] [Geography ▾] [More ▾] │
│     [Scope ▾] [GWP ▾] [Confidence ≥ ___] [⚠ Conflicts only]     │
├──────────────────────────────────────────────────────────────────┤
│  Canonical Name      | Unit  | CO2e  | Scope | Geo | Conf | ⚠   │
│  ─────────────────────────────────────────────────────────────── │
│  Diesel — road transp| kg/L  | 2.68  | S3C4  | IN  | 87%  |     │
│  Natural gas — stat  | kg/m³ | 2.02  | S1    | GL  | 74%  | ⚠   │
│  Grid electricity    | kg/kWh| 0.71  | S2    | IN  | 91%  |     │
│  ...                                                             │
│                                                [Export ▾]        │
└──────────────────────────────────────────────────────────────────┘
```

### 11.2 Side Panel (record detail)

Opens on row click. Non-blocking — table remains visible.

```
┌─────────────────────────────────┐
│  Diesel — road transport  [Edit]│
│  Source name: kg CO2e / litre   │
│  ─────────────────────────────  │
│  GHG Components                 │
│  CO2    CH4    N2O    Total      │
│  2.61   0.05   0.02   2.68      │
│  ─────────────────────────────  │
│  Scope: S3 Cat 4                │
│  LCA:   Use phase               │
│  Geo:   India (IN)              │
│  Valid: 2020 – 2025             │
│  GWP:   AR6 / GWP100            │
│  ─────────────────────────────  │
│  Confidence: [████████░] 87%    │
│  Source type:   35/35           │
│  Audited:       10/20           │
│  Geography:     20/25           │
│  Recency:       22/20 → 20      │
│  ─────────────────────────────  │
│  Tags: [transport] [india]      │
│  ─────────────────────────────  │
│  Applicability: ...             │
│  Limitations:   ...             │
│  Additional notes: ...          │
│  ─────────────────────────────  │
│  Source: DEFRA 2024 [↗ link]   │
│  ─────────────────────────────  │
│  ⚠ Conflicting records (1)     │
│    > [View conflict]            │
│  ─────────────────────────────  │
│  Version: v2 of 2              │
│    v1 Jan 2025 · A. Sharma      │
│    v2 Mar 2026 · P. Mehta       │
│  ─────────────────────────────  │
│  Audit log [expand]             │
└─────────────────────────────────┘
```

### 11.3 Upload & Review Flow

```
[Upload PDF / Paste URL / Upload Excel]
  ↓
[Document analysed → table/section list displayed]
  ↓  User selects sections to extract
[Cost estimate: ~$X for this extraction — Confirm?]
  ↓  User confirms
[Extraction in progress — streaming status bar]
  "Scanning tables... Extracting records... Generating canonical names..."
  ↓
[Review panel — paginated (50 records/page)]
  Header: "127 records extracted — Page 1 of 3"
  Each row shows:
    Canonical name | Unit | CO2e | ... | Conf | ⚠ | [ Approve ] [ Edit ] [ Reject ]
  Clicking a row expands it:
    Field-by-field view with [source snippet] next to each value
    Low-confidence fields highlighted; outlier values in orange
    Applicability / Limitations pre-filled by AI (editable)
  Bottom: [Approve Page] [Reject Page] [Approve All Remaining]
  ↓
[Commit approved records]
  ↓
[Summary: 121 records added · 3 rejected · 8 flagged as conflicts]
[Conflict notification sent to all admins]
```

### 11.4 AI Chat Panel

```
┌─────────────────────────────────────┐
│  AI Chat                       [✕] │
│  ─────────────────────────────────  │
│  You: What EF for diesel road      │
│  freight in India for 2023?        │
│  ─────────────────────────────────  │
│  ✦ Recommendation                  │
│  ┌──────────────────────────────┐  │
│  │ Diesel — road transport       │  │
│  │ 2.68 kg CO2e / litre          │  │
│  │ DEFRA 2024 · India · Conf 87% │  │
│  │ Scope 3 Cat 4 · AR6 / GWP100 │  │
│  │               [View in table] │  │
│  └──────────────────────────────┘  │
│                                     │
│  ▼ All candidates (3)              │
│    1. DEFRA 2024 — 2.68   87% ✓    │
│    2. IPCC AR6  — 2.70    74%      │
│    3. MoEFCC 23 — 2.65    71%      │
│                                     │
│  ▼ Reasoning                       │
│    DEFRA prioritised: India-specific│
│    (geo match +20) + govt source   │
│    (+35). IPCC is global avg only. │
│  ─────────────────────────────────  │
│  [Ask a follow-up...]          [→] │
└─────────────────────────────────────┘
```

---

## 12. Build Phases

### Phase 1 — AI Ingestion + Core Database (Priority)

**Goal:** AI agent reads PDFs (text + scanned), URLs, and Excel files; extracts EFs with full accuracy protections; goes through paginated human review; commits to the database. Analysts filter, browse, and export.

**Scope:**
- [ ] PostgreSQL schema with pgvector extension (all 16 fields + system fields + versioning)
- [ ] FastAPI backend: CRUD endpoints, file upload, URL fetch, JWT auth
- [ ] Anthropic API integration: PDF extraction agent (text + vision), URL extraction, Excel mapping agent, canonical name generation
- [ ] Upload/URL UI: file picker, table/section selector, cost estimate confirmation, streaming progress
- [ ] Review panel: paginated (50/page), per-field source snippets, inline editing, outlier flagging, unit mismatch warnings, auto-save review session
- [ ] Main table view: semantic search (pgvector), year filter (range-based), geography filter, scope filter, confidence filter
- [ ] Side panel: full record detail, GHG components mini-table, confidence score breakdown tooltip, version history timeline, audit log
- [ ] Conflict detection and flagging; in-app admin notifications
- [ ] Confidence score calculation (rule-based, default weights)
- [ ] Role system (admin / analyst)
- [ ] Full version history + audit log
- [ ] Excel/CSV export of filtered results
- [ ] Rejected extractions archive

### Phase 2 — AI Chat + Admin Configuration

**Goal:** AI chat is live. Admins can configure confidence weights. Advanced filters and source document viewer added.

**Scope:**
- [ ] AI chat panel with session memory and confidence floor (admin + user override)
- [ ] Claude tool-calling integration (search_emission_factors)
- [ ] "No match" handling: closest match + source suggestion
- [ ] Superseded badge in chat results
- [ ] Confidence score weight configuration UI with before/after preview + bulk recalculation
- [ ] Advanced filters: LCA stage, GWP version, tags, include-superseded toggle
- [ ] Inline source document viewer (PDF.js in review panel)
- [ ] Bulk operations: approve page / reject page / approve all in review step
- [ ] Conflict resolution UI (supersede a record with reason)
- [ ] Admin API cost tracking dashboard (cumulative spend by month)

### Phase 3 — Polish, Extensions & Future-Proofing

**Scope:**
- [ ] Manual entry form
- [ ] Supplier/EPD record management (structured linked entity)
- [ ] Dashboard landing page (source coverage, geography distribution, confidence histogram, conflict queue)
- [ ] Read-only API endpoint for downstream GHG calculation tool integration
- [ ] Cloud deployment setup
- [ ] Data migration tooling (enhanced for edge cases)
- [ ] Persistent chat history per user (optional)
- [ ] Optional additional confidence criteria (completeness, uncertainty range, consistency, GWP alignment)

---

## 13. Initial Data Migration

Significant existing EF data needs to be imported on day one.

**Migration process:**
1. **Audit existing data** — identify all source files (spreadsheets, CSVs), what fields are populated, and what the data quality is.
2. **Map to EFDB schema** — identify clean mappings and columns with no direct equivalent.
3. **Bulk import via Excel upload pathway** — use the AI mapping agent to ingest existing spreadsheets.
4. **Handle unmapped columns** — Claude routes ambiguous columns to best-fit schema fields; residual data is consolidated into Additional Notes for manual review.
5. **Paginated review** — review imported records in the standard review panel. This may require several sessions.
6. **Set confidence scores** — scores are auto-calculated based on available source metadata. Admin reviews and adjusts where source type or audit status is unclear.
7. **Tag as migrated** — all imported records have `migrated = true` for traceability.
8. **Post-migration cleanup** — once the database is populated, review conflict flags introduced by the migration batch.

---

## 14. Resolved Questions

| # | Question | Decision |
|---|----------|----------|
| 1 | Placeholder fields A, B, C | A = GWP Version (named field, §5.1 field 11); B = Custom Tags (field 15); C = Additional Notes / catch-all (field 16) |
| 2 | Deployment target | TBD — Docker Compose covers both local and cloud. Architecture ready for Phase 3 API. |
| 3 | Confidence score weights | Default values set in §7. Admin configures via UI (Phase 2). |
| 4 | Rejected records | Archived with reason in `rejected_extractions` log. Not permanently deleted. |
| 5 | Large PDF UX | Streaming progress bar while user waits (no email needed). Review session auto-saved if user needs to step away. |
| 6 | "Global" as geography | Valid — many IPCC and GHG Protocol factors are geography-agnostic. |
| 7 | Downstream integration | Will happen — but not in scope now. Architecture must support a read-only API endpoint (Phase 3). |
| 8 | Activity name synonyms | AI generates canonical name + category at extraction time. Reviewer can override. Semantic search (pgvector) handles synonym matching at query time. |
| 9 | Unit normalisation | Not normalised. Units stored as-is. UI warns when comparing records with different units. |
| 10 | Scanned PDFs | Claude Opus 4.6 (vision) handles image-based pages natively. No separate OCR library needed. |
| 11 | Score recalculation on weight change | On-demand with admin confirmation. Shows impact preview before running. Logged in audit trail. |
| 12 | Bulk review for large files | Paginated (50 records/page). Page-level approve/reject buttons. Review session auto-saved. |
| 13 | Source as URL | URL field alongside file upload. System fetches and extracts. URL stored and linked to records. |
| 14 | Async notification | Streaming progress bar (no email). Review session persists if user closes browser. |
| 15 | Superseded records in chat | Shown with a "Superseded" warning badge and contextual note. |
| 16 | Conflict notification | All admins notified in-app when a new upload introduces conflicts. |
| 17 | Migration unmapped columns | AI routes to best-fit field; overflow consolidated into Additional Notes. |
| 18 | Data access | All analysts see all records. No project- or client-level segmentation needed. |
| 19 | Paywalled sources | Not in scope — only publicly available free sources. Exported CSV/Excel from paid tools can be uploaded. |
| 20 | Semantic search | pgvector for canonical activity name. Enables synonym matching across source-specific terminology. |
| 21 | Table default view | Current versions only (`is_current = true`, `is_superseded = false`). Phase 2 adds a toggle. |
| 22 | AI chat: no match | Return closest match with difference note + suggest authoritative source to check. |
| 23 | Comments fields | AI pre-fills from source footnotes; reviewer edits in the review step. |
| 24 | Outlier value flagging | Flag zero, negative, or >3× median values with orange highlight in review panel. |
| 25 | API cost visibility | Cost estimate shown before extraction begins. Admin cost dashboard in Phase 2. |
| 26 | Confidence floor in chat | Admin sets org-wide floor. Users can raise per query, not lower below admin floor. |
| 27 | GWP version | Structured enum field (AR4/AR5/AR6/GWP20/GWP100/Not stated). Used in search and confidence scoring. |
| 28 | Review session recovery | Auto-saved server-side. User can close browser and resume from where they left off. |
| 29 | Record locking | Removed from scope. Version history provides sufficient protection. |
| 30 | Saved filter presets | Not needed. |
| 31 | Chat query logging | Not needed. |
| 32 | Weight config preview | Before/after preview on sample of 20 records shown before admin confirms bulk recalculation. |

---

## 15. Key Design Decisions & Rationale

| Decision | Rationale |
|----------|-----------|
| **Human review before commit** | EFs feed into official GHG reports. A human gate protects data integrity. Paginated review + auto-save makes it practical even for large files. |
| **Rule-based confidence score** | Deterministic and auditable. The team can defend a score in a client meeting: "87% because it's a government source, country-specific, and AR6-based." |
| **Canonical name + semantic search** | Different sources use different terminology for the same activity. Canonical names + vector search make the database searchable across sources without manual synonym curation. |
| **Units stored as-is (no normalisation)** | Normalisation adds complexity and risk of errors. Instead, units are prominently displayed and warnings are shown when comparing different units. Analyst makes the judgment call. |
| **Claude vision for scanned PDFs** | Avoids a separate OCR dependency (pytesseract, etc.). Claude Opus 4.6 natively reads image pages with high accuracy. |
| **Source text snippet for every numeric value** | The single most important accuracy protection. Every extracted value can be traced back to the exact text Claude read. Makes hallucination immediately visible in review. |
| **pgvector over external vector DB** | pgvector runs inside the existing PostgreSQL instance — no additional infrastructure (no Pinecone, Weaviate, etc.). Sufficient for this scale. |
| **FastAPI BackgroundTasks over Celery** | Keeps infrastructure simple for v1. Upgrade path to Celery + Redis is straightforward if concurrent jobs become a bottleneck. |
| **Flag conflicts, don't block** | A multi-source EF database will legitimately have multiple EFs for the same activity. Blocking duplicates would prevent building a rich, comparable dataset. Flagging + confidence ranking is the right trade-off. |
| **Full version history** | EF values change over time (IPCC revisions, grid updates). History lets the team trace exactly which EF value was used in which year's report — critical for GHG accounting integrity. |
| **Architecture ready for read-only API** | Downstream integration with a GHG calculation tool is likely. FastAPI makes adding a versioned read-only API endpoint in Phase 3 straightforward. |

---

*Document version: 2.0 — April 2026*
*Based on two rounds of requirements interviews with ESG analyst team.*
