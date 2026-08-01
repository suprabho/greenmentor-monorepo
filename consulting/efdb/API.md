# EFDB API Reference

EFDB (Emission Factor Database) is a FastAPI service that stores GHG emission
factors and provides AI-powered ingestion, search, and retrieval on top of them.
Backend code: `consulting/efdb/backend`.

Base URL: `https://<your-host>` (replace with your deployed URL)

> **Path prefix note.** The routes below are the canonical backend paths.
> If your deployment puts the API behind a reverse proxy that mounts it at `/api`
> (matching the frontend's Vite dev proxy), prepend `/api` to every path.

> **Live docs.** A Swagger UI is auto-generated at `GET /docs`, and the raw OpenAPI
> JSON is at `GET /openapi.json`. Either is usually the fastest way to explore.

---

## Authentication

All endpoints require a JWT Bearer token in the `Authorization` header, except:

- `GET /health`
- `POST /auth/login`, `POST /auth/token`, `POST /auth/oauth`
- `GET /emission-factors/public`
- `GET /emission-factors/stats/coverage`

```
Authorization: Bearer <access_token>
```

Tokens come from `POST /auth/login` (or `/auth/oauth` for Google sign-in via
Supabase). They expire after `JWT_EXPIRE_MINUTES` (default **1440** = 24 h).

Roles: `admin` | `analyst`. Endpoints marked **🔒 admin** below return `403`
for analysts. Accounts on the `greenmentor.co` domain are always created (or
promoted) as admins — including auto-provisioning on first Google sign-in.

### Auth flow (one-time, for a new user)

```bash
# 1. Register (admin-only; see the admin bootstrap script for the first admin)
curl -X POST https://<host>/auth/register \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "full_name": "Alice",
    "password": "s3cret",
    "role": "analyst"
  }'

# 2. Log in → grab access_token
curl -X POST https://<host>/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"s3cret"}'
# → { "access_token": "eyJ...", "token_type": "bearer", "user": {...} }

# 3. Use the token
curl https://<host>/auth/me \
  -H "Authorization: Bearer eyJ..."
```

---

## Endpoint reference

### Health

| Method | Path      | Auth | Description                                |
| ------ | --------- | ---- | ------------------------------------------ |
| GET    | `/health` | none | Returns `{"status":"ok","service":"EFDB API"}` |

### Auth — `/auth`

| Method | Path             | Auth                | Description                                                                                                                            |
| ------ | ---------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/auth/register` | Bearer **🔒 admin** | Create a user. Body: `{email, full_name, password, role}`. Returns `201` + the user. `greenmentor.co` emails are forced to `admin`.     |
| POST   | `/auth/login`    | none                | JSON login. Body: `{email, password}`. Returns `{access_token, token_type, user}`.                                                      |
| POST   | `/auth/oauth`    | none                | Exchange a Supabase Auth access token (e.g. Google sign-in) for an EFDB JWT. Body: `{supabase_access_token}`. Only pre-provisioned accounts may sign in, except `greenmentor.co` staff who are auto-provisioned as admins. `503` if OAuth is not configured. |
| POST   | `/auth/token`    | none                | OAuth2 form login (used by the Swagger UI). Form fields: `username`, `password`.                                                        |
| GET    | `/auth/me`       | Bearer              | Returns the current user.                                                                                                               |

### Emission factors — `/emission-factors`

#### Read

| Method | Path                                | Auth   | Description                                                                                     |
| ------ | ----------------------------------- | ------ | ----------------------------------------------------------------------------------------------- |
| GET    | `/emission-factors`                 | Bearer | List/filter EFs. Query params below. Returns `{items, total, page, page_size}`.                  |
| GET    | `/emission-factors/search/semantic` | Bearer | pgvector semantic search on `activity_name`. Query: `q` (required, ≥2 chars), `year`, `country`, `max_dq_score` (1–5), `limit` (≤100). |
| GET    | `/emission-factors/public`          | none   | Unauthenticated read-only listing with a reduced filter surface: `q`, `country`, `scope`, `species`, `sort_by`, `sort_dir`, `page`, `page_size` (≤200). |
| GET    | `/emission-factors/stats/coverage`  | none   | Aggregate coverage stats for the dashboard: totals, per-source-database breakdown, EPD validity + top manufacturers + sectors, and counts by country / scope / reference year. |
| GET    | `/emission-factors/{id}`            | Bearer | Get a single EF by UUID.                                                                        |
| GET    | `/emission-factors/{id}/versions`   | Bearer | Edit history (snapshots), newest first.                                                         |
| GET    | `/emission-factors/{id}/conflicts`  | Bearer | EFs that conflict with this one (same activity/geography/period, different value).              |
| GET    | `/emission-factors/{id}/audit-log`  | Bearer | Audit log entries for this EF, newest first.                                                    |
| GET    | `/emission-factors/export/csv`      | Bearer | Stream a CSV (all source-schema columns) of filtered EFs. Filters: `q`, `year`, `country`, `region`, `scope`, `species`, `category`, `source_organization`, `max_dq_score`. Returns `text/csv`. |

Query params for the list endpoint (`GET /emission-factors`):

| Param                 | Type   | Notes                                                                                       |
| --------------------- | ------ | ------------------------------------------------------------------------------------------- |
| `q`                   | string | Substring match on `activity_name`                                                          |
| `year`                | int    | Matches `reference_year`, or any EF whose `valid_from`/`valid_to` window covers the year    |
| `country`             | string | ISO 3166-1 **alpha-3** (alpha-2 accepted for back-compat); `global` EFs always match       |
| `region`              | string | Substring match on `region_name`                                                            |
| `scope`               | string | GHG scope — `1`, `2`, or `3` (`"Scope 1"`, `"scope1"` etc. also accepted)                  |
| `species`             | string | GHG species: `CO2`, `CO2e`, `CH4`, `N2O`, …                                                 |
| `category`            | string | `emission_category` (case-insensitive exact)                                                |
| `source_organization` | string | Substring match                                                                             |
| `max_dq_score`        | int    | Pedigree data-quality score ceiling, 1 (best) – 5 (worst)                                   |
| `conflicts_only`      | bool   | Only EFs flagged `has_conflict`                                                             |
| `gwp_basis`           | string | e.g. `AR5`, `AR6` (case-insensitive)                                                        |
| `framework_tags`      | string | Comma-separated; every tag must be present                                                  |
| `sector_tags`         | string | Comma-separated; every tag must be present                                                  |
| `include_superseded`  | bool   | Default `false` (only `status = active`)                                                    |
| `sort_by`             | string | `activity_name`, `reference_year`, `created_at` (default), `valid_from`, `source_organization`, `dq_score_overall` |
| `sort_dir`            | string | `asc` \| `desc` (default)                                                                   |
| `page` / `page_size`  | int    | `page_size` ≤ 200 (default 50)                                                              |

#### Write **🔒 admin**

| Method | Path                                                      | Description                                                                                                                                          |
| ------ | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| PATCH  | `/emission-factors/{id}`                                  | Partial update. Body: any subset of EF fields + `edit_summary`. Records a version snapshot, bumps `version_number`, regenerates the embedding if `activity_name` changed, writes an audit entry. |
| POST   | `/emission-factors/{id}/resolve-conflict`                 | Clear the `has_conflict` flag. Body: `{resolution_note}`.                                                                                            |
| POST   | `/emission-factors/{id}/supersede`                        | Mark EF superseded. Body: `{reason, superseded_by_ef_id?}`.                                                                                          |
| POST   | `/emission-factors/{id}/restore-version/{version_number}` | Restore an older snapshot as the current state (snapshots the current state first; sets `status` back to `active`).                                  |

> There is **no direct `POST /emission-factors`** — new EFs enter the database
> only via the ingestion pipeline (below).

### Ingestion — `/ingestion`

All ingestion endpoints are **🔒 admin**, except `POST /ingestion/parse`
(any authenticated user).

#### Document parsing (no extraction)

| Method | Path               | Auth   | Description                                                                                                                                     |
| ------ | ------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| POST   | `/ingestion/parse` | Bearer | Normalize an uploaded document to markdown via the unified liteparse/markitdown layer — no DB writes, no EF extraction. `multipart/form-data`, field `file`. Returns `{markdown, page_count, parser, used_ocr, source_format}`. Reused by external services (e.g. ESG-Agents) that need a document as markdown for their own LLM extraction. Spreadsheets return `415` (the Excel ingestion path owns them). |

#### Extract-review-commit flow

A four-step flow: scan → extract → review → commit.

| Method | Path                                                     | Description                                                                                                                                                        |
| ------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/ingestion/upload/scan`                                 | Upload a document (`multipart/form-data`: `file`, optional `document_type` = `generic` (default) \| `epd`). Supported: PDF, Excel/CSV, Word, PowerPoint, OpenDocument, RTF, HTML, images. Max size `MAX_UPLOAD_SIZE_MB` (default 100). Returns a `ScanResult`: `{session_id, document_id, sections_found, estimated_tokens, estimated_cost_usd, page_count, has_scanned_pages, document_metadata, document_type}`. `epd` uses EN 15804 / ISO 14025-aware prompts. |
| POST   | `/ingestion/url/scan`                                    | Scan a public URL. Form fields (`application/x-www-form-urlencoded`): `url`, optional `document_type`. Same `ScanResult` shape.                                      |
| POST   | `/ingestion/sessions/{session_id}/extract`               | Confirm which sections to extract. Body: `{section_indices: [int], confirmed_metadata?: {…}}` (`confirmed_metadata` is the — possibly corrected — `document_metadata` from the scan). Runs extraction in the background; returns `{session_id, status: "extracting"}`. |
| GET    | `/ingestion/sessions/{session_id}`                       | Poll session status: `{id, status, total_extracted, total_approved, total_rejected, error_message, created_at, updated_at}`.                                          |
| GET    | `/ingestion/sessions/{session_id}/records`               | Paginated extracted records for review. Query: `page`, `page_size` (default 50). Returns `{records, total, page, page_size}`. Each record field is either a scalar or an `{value, source_snippet, extraction_confidence, extraction_note, source_page, source_bbox}` object. |
| POST   | `/ingestion/sessions/{session_id}/review/bulk`           | Bulk approve/reject. Body: `{action: "approve_all" \| "reject_all", indices?: [int]}` (`indices` omitted = all records).                                             |
| POST   | `/ingestion/sessions/{session_id}/review/{record_index}` | Review one record. Body: `{action: "approve" \| "reject" \| "pending", edited_data?: {…}, rejection_reason?: string}`. `edited_data` is merged into the record on approve. |
| POST   | `/ingestion/sessions/{session_id}/commit`                | Commit approved records to the EF table (embeddings + conflict detection + audit), archive rejected ones. Returns `{approved, rejected, conflicts_flagged, records_committed: [uuid]}`. |

### EnvironDec — `/ingestion/environdec` **🔒 admin (all endpoints)**

Selective, deterministic (no-LLM) ingestion from the International EPD System
Data Hub: search live, pull only the EPDs you pick into a normal review
session. Only datasets with a machine-readable A1–A3 GWP + declared unit are
ingestible; PDF-only or already-ingested EPDs are reported and skipped.

#### Search & ingest

| Method | Path                           | Description                                                                                                                                        |
| ------ | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/ingestion/environdec/search` | Search the Data Hub. Body: `{query?, owner?, registration_number?, geo?, classific?, page_size? (≤100), start_index?}`. Returns `{total, start_index, page_size, hits}`; each hit carries `already_in_efdb` (dedup against existing EPD references) and a `raw` dict to echo back on ingest. |
| POST   | `/ingestion/environdec/ingest` | Ingest selected EPDs into a review session. Body: `{hits?: [raw-hit dicts], uuids?: [string], auto_commit?: bool}` — prefer echoing back `raw` hits from search; bare `uuids` are a best-effort fallback. `auto_commit: true` approves and commits everything immediately. Returns `{session_id, ingested, skipped, committed, commit_summary, results}` with a per-item `status`: `ingestible` \| `no_dataset` \| `no_gwp` \| `error` \| `already_in_efdb`. |

#### Watches

Saved searches that are re-run (via the run endpoint or a scheduled cron
script) to catch new EPDs. `mode: "queue"` parks new finds in a review queue;
`mode: "auto"` ingests them straight into a review session.

| Method | Path                                          | Description                                                                                                       |
| ------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| GET    | `/ingestion/environdec/watches`               | List watches (with `seen_count`, `pending_count`, `last_checked_at`).                                              |
| POST   | `/ingestion/environdec/watches`               | Create. Body: `{name, query?, owner?, registration_number?, geo?, classific?, mode?}` — at least one search criterion required. |
| PATCH  | `/ingestion/environdec/watches/{watch_id}`    | Update any subset of the create fields plus `enabled`.                                                             |
| DELETE | `/ingestion/environdec/watches/{watch_id}`    | Delete the watch and its queue items.                                                                              |
| POST   | `/ingestion/environdec/watches/{watch_id}/run`| Run now. Returns `{watch_id, new_found, queued, auto_ingested, session_id}`.                                       |

#### Queue

| Method | Path                                 | Description                                                                                                          |
| ------ | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| GET    | `/ingestion/environdec/queue`        | List queue items. Query: `watch_id?`, `status` (default `pending`).                                                   |
| POST   | `/ingestion/environdec/queue/ingest` | Ingest selected queued EPDs. Body: `{item_ids: [uuid], auto_commit?: bool}`. Same response shape as `/environdec/ingest`; ingested items are marked `ingested`, non-ingestible ones `dismissed`. |

### Chat — `/chat`

| Method | Path     | Auth   | Description                                                                                                                                                                   |
| ------ | -------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| POST   | `/chat/` | Bearer | Streaming Server-Sent Events. Body: `{messages: [{role, content}, …], min_confidence?: int}`. `min_confidence` can only *raise* the server's floor (`CHAT_CONFIDENCE_FLOOR`, default 60), never lower it. Response is `text/event-stream`; each event is `data: {"content":"…"}\n\n`, terminated by `data: [DONE]`. |

---

## Common request examples

### List EFs (UK electricity, 2023, scope 2, good data quality)

```bash
curl "https://<host>/emission-factors?country=GBR&year=2023&scope=2&max_dq_score=2&page_size=25" \
  -H "Authorization: Bearer $TOKEN"
```

### Semantic search

```bash
curl "https://<host>/emission-factors/search/semantic?q=diesel%20road%20freight&country=IND&limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

### Public lookup (no auth)

```bash
curl "https://<host>/emission-factors/public?q=cement&country=IND&scope=3"
```

### Export filtered set as CSV

```bash
curl "https://<host>/emission-factors/export/csv?source_organization=DESNZ&max_dq_score=3" \
  -H "Authorization: Bearer $TOKEN" \
  -o emission_factors.csv
```

### Parse a document to markdown (no extraction)

```bash
curl -X POST "https://<host>/ingestion/parse" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@supplier_epd.pdf"
# → { "markdown": "…", "page_count": 12, "parser": "liteparse", "used_ocr": false, "source_format": ".pdf" }
```

### AI chat (streaming)

```bash
curl -N -X POST "https://<host>/chat/" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messages":[
      {"role":"user","content":"What EF should I use for diesel road freight in India in 2023?"}
    ],
    "min_confidence": 70
  }'
```

### Upload + extract (admin)

```bash
# 1. Scan
curl -X POST "https://<host>/ingestion/upload/scan" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@uk_ghg_2023.pdf" \
  -F "document_type=generic"
# → ScanResult with session_id, sections_found, and auto-detected document_metadata

# 2. Confirm sections (e.g. sections 0 and 2) + corrected metadata
curl -X POST "https://<host>/ingestion/sessions/<session_id>/extract" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"section_indices":[0,2], "confirmed_metadata":{"source_organization":"DESNZ","gwp_basis":"AR5","reference_year":2023}}'

# 3. Poll until status == "in_review", then fetch + review records
curl "https://<host>/ingestion/sessions/<session_id>" \
  -H "Authorization: Bearer $TOKEN"
curl -X POST "https://<host>/ingestion/sessions/<session_id>/review/bulk" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"approve_all"}'

# 4. Commit
curl -X POST "https://<host>/ingestion/sessions/<session_id>/commit" \
  -H "Authorization: Bearer $TOKEN"
```

### EnvironDec: search → ingest (admin)

```bash
# 1. Search the EPD Data Hub
curl -X POST "https://<host>/ingestion/environdec/search" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"ready-mix concrete","geo":"IN","page_size":25}'

# 2. Ingest the hits you want (echo back their `raw` dicts)
curl -X POST "https://<host>/ingestion/environdec/ingest" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"hits":[{...raw hit 1...},{...raw hit 2...}], "auto_commit": false}'
# → session_id → review + commit via the normal /ingestion/sessions flow
```

---

## Reference: enum values

- **role**: `admin` | `analyst`
- **ghg_scope** (`scope` filter): `1` | `2` | `3`
- **dq scores** (`dq_score_overall`, `dq_geographic_rep`, `dq_temporal_rep`, `dq_tech_rep`): pedigree 1 (best) – 5 (worst)
- **gwp_basis**: `AR4` | `AR5` | `AR6` | `GWP20` | `GWP100` | `Not stated`
- **country_iso**: ISO 3166-1 alpha-3 (e.g. `GBR`, `IND`, `USA`)
- **geography_type**: `global` | `national` | `regional` | `sub-national` | `grid-zone`
- **EF status**: `active` | `superseded`
- **document_type**: `generic` | `epd`
- **session status**: `extracting` → `awaiting_review` (scan done) → `extracting` (extraction running) → `in_review` → `completed` / `failed`
- **review actions**: single `approve` | `reject` | `pending`; bulk `approve_all` | `reject_all`
- **watch mode**: `queue` | `auto`
- **queue item status**: `pending` | `ingested` | `dismissed`
- **EnvironDec ingest item status**: `ingestible` | `no_dataset` | `no_gwp` | `error` | `already_in_efdb`

---

## Errors

Errors come back as JSON with a `detail` field and a standard HTTP status:

```json
{ "detail": "Invalid credentials" }
```

Common cases: `401` (missing/expired token), `403` (admin-only endpoint, or a
disabled/unprovisioned OAuth account), `404` (unknown EF / session / watch),
`413` (upload exceeds `MAX_UPLOAD_SIZE_MB`), `415` (unsupported file type),
`422` (validation error — body shows a list of field errors), `502` (AI
provider error — billing, rate limit, or overload upstream; the provider's
message is included), `503` (OAuth login not configured).

---

## Configuration touchpoints

Server behaviour that shapes the API surface (see `backend/app/config.py`):

| Env var                             | Default                                       | Effect                                                   |
| ----------------------------------- | --------------------------------------------- | -------------------------------------------------------- |
| `JWT_EXPIRE_MINUTES`                | `1440`                                        | Token lifetime                                           |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY`| empty                                         | Empty disables `POST /auth/oauth` (returns `503`)        |
| `CHAT_CONFIDENCE_FLOOR`             | `60`                                          | Minimum confidence floor for `/chat`                     |
| `MAX_UPLOAD_SIZE_MB`                | `100`                                         | Upload limit for `/ingestion/parse` and `/ingestion/upload/scan` |
| `CORS_ORIGINS`                      | `http://localhost:5173,http://localhost:3000` | Comma-separated CORS allow-list                          |
