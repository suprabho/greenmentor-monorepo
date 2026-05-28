# EFDB API Reference

Base URL: `https://<your-host>` (replace with your deployed URL)

> **Path prefix note.** The routes below are the canonical backend paths.
> If your deployment puts the API behind a reverse proxy that mounts it at `/api`
> (matching the frontend's Vite dev proxy), prepend `/api` to every path.

> **Live docs.** A Swagger UI is auto-generated at `GET /docs`, and the raw OpenAPI
> JSON is at `GET /openapi.json`. Either is usually the fastest way to explore.

---

## Authentication

All endpoints except `/health`, `/auth/register`, `/auth/login`, and `/auth/token`
require a JWT Bearer token in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

Tokens come from `POST /auth/login`. They expire after a configurable window
(default driven by `JWT_EXPIRE_MINUTES` on the server).

Some endpoints additionally require the user's role to be `admin` (marked **🔒 admin** below).

### Auth flow (one-time, for a new user)

```bash
# 1. Register (admin can do this for them, or open if registration is enabled)
curl -X POST https://<host>/auth/register \
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

Roles: `admin` | `analyst`.

---

## Endpoint reference

### Health

| Method | Path      | Auth | Description           |
| ------ | --------- | ---- | --------------------- |
| GET    | `/health` | none | Returns `{status:ok}` |

### Auth — `/auth`

| Method | Path             | Auth   | Description                                                          |
| ------ | ---------------- | ------ | -------------------------------------------------------------------- |
| POST   | `/auth/register` | none   | Create a user. Body: `{email, full_name, password, role}`.           |
| POST   | `/auth/login`    | none   | JSON login. Body: `{email, password}`. Returns `{access_token,user}`.|
| POST   | `/auth/token`    | none   | OAuth2 form login (for Swagger UI). Form: `username`, `password`.    |
| GET    | `/auth/me`       | Bearer | Returns the current user.                                            |

### Emission factors — `/emission-factors`

#### Read

| Method | Path                                  | Auth   | Description                                                                                                                                                                                                                                              |
| ------ | ------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/emission-factors`                   | Bearer | List/filter current (non-superseded) EFs. Query: `q`, `year`, `country` (ISO-2), `region`, `scope`, `source_type`, `min_confidence` (0–100), `conflicts_only` (bool), `gwp_version`, `tags` (comma-sep), `sort_by`, `sort_dir`, `page`, `page_size` (≤200). |
| GET    | `/emission-factors/search/semantic`   | Bearer | pgvector semantic search on canonical name. Query: `q` (required, ≥2 chars), `year`, `country`, `min_confidence`, `limit` (≤100).                                                                                                                       |
| GET    | `/emission-factors/{id}`              | Bearer | Get a single EF by UUID.                                                                                                                                                                                                                                |
| GET    | `/emission-factors/{id}/versions`     | Bearer | Edit history (snapshots), newest first.                                                                                                                                                                                                                  |
| GET    | `/emission-factors/{id}/conflicts`    | Bearer | EFs that conflict with this one (same activity/geography/period, different value).                                                                                                                                                                       |
| GET    | `/emission-factors/{id}/audit-log`    | Bearer | Audit log entries for this EF, newest first.                                                                                                                                                                                                             |
| GET    | `/emission-factors/export/csv`        | Bearer | Stream a CSV of filtered EFs. Same filter query params as the list endpoint. Returns `text/csv`.                                                                                                                                                         |

#### Write **🔒 admin**

| Method | Path                                                  | Description                                                              |
| ------ | ----------------------------------------------------- | ------------------------------------------------------------------------ |
| PATCH  | `/emission-factors/{id}`                              | Partial update. Body: any subset of EF fields + `edit_summary`. Records a version snapshot, recalculates confidence, regenerates the embedding if `canonical_activity_name` changed. |
| POST   | `/emission-factors/{id}/resolve-conflict`             | Clear the `has_conflict` flag. Body: `{resolution_note}`.                |
| POST   | `/emission-factors/{id}/supersede`                    | Mark EF superseded. Body: `{reason}`.                                    |
| POST   | `/emission-factors/{id}/restore-version/{version_number}` | Restore an older snapshot as the current state.                       |

> There is **no direct `POST /emission-factors`** — new EFs enter the database
> only via the ingestion pipeline (see below).

### Ingestion — `/ingestion` **🔒 admin (all endpoints)**

A four-step extract-review-commit flow.

| Method | Path                                              | Description                                                                                                  |
| ------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| POST   | `/ingestion/upload/scan`                          | Upload a PDF/Excel/CSV (`multipart/form-data`, field `file`). Returns a `ScanResult` with the session id, detected sections, cost estimate, and auto-detected document metadata. |
| POST   | `/ingestion/url/scan`                             | Scan a public URL (`application/x-www-form-urlencoded`, field `url`). Returns the same `ScanResult` shape.    |
| POST   | `/ingestion/sessions/{session_id}/extract`        | Confirm which sections to extract. Body: `{section_indices:[…], confirmed_metadata:{…}}`. Runs extraction in the background. |
| GET    | `/ingestion/sessions/{session_id}`                | Poll session status (`extracting` → `in_review` → `completed` / `failed`).                                  |
| GET    | `/ingestion/sessions/{session_id}/records`        | Paginated extracted records for review. Query: `page`, `page_size`.                                          |
| POST   | `/ingestion/sessions/{session_id}/review/bulk`    | Bulk approve/reject. Body: `{action: "approve_all" \| "reject_all", indices: number[] \| null}`.             |
| POST   | `/ingestion/sessions/{session_id}/review/{record_index}` | Approve/reject one record (with optional edits). Body: `{action: "approve" \| "reject" \| "pending", edited_data?:{…}, rejection_reason?:string}`. |
| POST   | `/ingestion/sessions/{session_id}/commit`         | Commit approved records to the EF table. Returns `{approved, rejected, conflicts_flagged, records_committed:[uuid…]}`. |

### Chat — `/chat`

| Method | Path     | Auth   | Description                                                                                                                                                              |
| ------ | -------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| POST   | `/chat/` | Bearer | Streaming Server-Sent Events. Body: `{messages:[{role,content},…], min_confidence?:number}`. Response is `text/event-stream`; each event is `data: {"content":"…"}\n\n`, terminated by `data: [DONE]`. |

---

## Common request examples

### List EFs (UK electricity, 2023, scope 2, ≥70 confidence)

```bash
curl "https://<host>/emission-factors?country=GB&year=2023&scope=scope_2&min_confidence=70&page_size=25" \
  -H "Authorization: Bearer $TOKEN"
```

### Semantic search

```bash
curl "https://<host>/emission-factors/search/semantic?q=diesel%20road%20freight&country=IN&limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

### Export filtered set as CSV

```bash
curl "https://<host>/emission-factors/export/csv?source_type=government&min_confidence=80" \
  -H "Authorization: Bearer $TOKEN" \
  -o emission_factors.csv
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
    "min_confidence": 60
  }'
```

### Upload + extract (admin)

```bash
# 1. Scan
curl -X POST "https://<host>/ingestion/upload/scan" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@uk_ghg_2023.pdf"
# → ScanResult with session_id and sections_found

# 2. Confirm sections (e.g. sections 0 and 2)
curl -X POST "https://<host>/ingestion/sessions/<session_id>/extract" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"section_indices":[0,2], "confirmed_metadata":{"source_name":"UK GHG 2023","gwp_version":"ar5"}}'

# 3. Poll until status == "in_review", then fetch + review records
curl "https://<host>/ingestion/sessions/<session_id>" \
  -H "Authorization: Bearer $TOKEN"

# 4. Commit
curl -X POST "https://<host>/ingestion/sessions/<session_id>/commit" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Reference: enum values

- **scope** (`applicable_scopes` array): `scope_1`, `scope_2`, `scope_3`
- **source_type**: `government`, `intergovernmental`, `ghg_protocol`, `commercial_lca`, `peer_reviewed`, `industry_association`, `supplier_epd`, `internal_estimate`, `other`
- **gwp_version**: `ar4`, `ar5`, `ar6`, `gwp20`, `gwp100`, `not_stated`
- **country**: ISO 3166-1 alpha-2 (e.g. `GB`, `IN`, `US`)
- **role**: `admin`, `analyst`
- **session status**: `extracting`, `awaiting_review`, `in_review`, `completed`, `failed`

---

## Errors

Errors come back as JSON with a `detail` field and a standard HTTP status:

```json
{ "detail": "Invalid credentials" }
```

Common cases: `401` (missing/expired token), `403` (admin-only endpoint), `404`
(unknown EF / session), `413` (upload too large), `415` (unsupported file type),
`422` (validation error — body shows a list of field errors).

---

## CORS

The server's CORS allow-list is configured in `backend/app/main.py`. By default
it permits `http://localhost:5173` and `http://localhost:3000` only. If a
third-party frontend on a different origin will call this API, add its origin
to `allow_origins` (or set `allow_origin_regex`) and redeploy.
