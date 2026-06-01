# GreenMentor Platform — Architecture

> Reference documentation for the three pulled product repos: **`greenmentor-in-um`** (user-management), **`greenmentor-in-fe`** (frontend), and **`greenmentor-in-be`** (backend). These live on the `Greenmentor` GitHub org and are cloned (gitignored) into this monorepo. Last mapped: 2026-06-02.

---

## 1. What the product is

An **ESG / BRSR sustainability-reporting SaaS** for Indian enterprises. Companies enter Environmental, Social & Governance data (GHG emissions, water, waste, workforce, governance), the data passes through a **maker-checker approval workflow**, and the platform produces **BRSR reports** (India's mandatory *Business Responsibility & Sustainability Reporting* format) plus analytics dashboards.

The system is **multi-tenant** (isolated per `organization_id`) and **white-labeled per client** — git branches `client/danone`, `client/enerji`, `client/jazeera`, `client/tejas` are per-client variants.

---

## 2. Topology — three services, two backends

The frontend talks to **two** backends: a dedicated auth/user service and the main data service. Both backends share one Postgres database.

```
                         ┌──────────────────────────────────┐
                         │       greenmentor-in-fe           │
                         │   "greenmentor-front"             │
                         │   CRA + Redux Toolkit + axios     │
                         │   Cloud Run (nginx), :8080        │
                         └───────┬───────────────────┬───────┘
              auth / users / 2FA │                   │ all ESG domain data
                                 ▼                   ▼
              ┌──────────────────────────┐  ┌──────────────────────────────┐
              │     greenmentor-in-um     │  │      greenmentor-in-be        │
              │     "user-management"     │  │      "greenmentor-backend"    │
              │  login, JWT issue/refresh │  │  energy / water / waste /     │
              │  2FA (TOTP), members,     │  │  scope3 / social / BRSR       │
              │  roles, password reset    │  │  ~165 models, approvals,      │
              │  Express + Sequelize :3000│  │  CSV export, evidence uploads │
              └──────────────┬───────────┘  └───────────────┬──────────────┘
                             │      shared Postgres          │
                             └───────────────┬───────────────┘
                                             ▼
                          ┌─────────────────────────────────┐
                          │  PostgreSQL (Cloud SQL)           │
                          │  multi-tenant via organization_id │
                          │  AuthStore = shared session table │
                          └─────────────────────────────────┘

   External: Google Cloud Storage (evidence files) · OpenAI (BRSR draft text) · SendGrid (email)
```

**Why two backends matter:** `-um` is the only service that *issues* tokens (signed with `AUTH_KEY`, persisted to the `AuthStore` table). `-be` *trusts and re-validates* the same token against `AuthStore`, so logout/refresh in `-um` revokes access in `-be`. The frontend is configured with two base URLs: `REACT_APP_USER_API` (→ `-um`) and `REACT_APP_API_URL` (→ `-be`).

---

## 3. Frontend (`greenmentor-in-fe`)

**Stack:** Create React App (`react-scripts` 5, JavaScript — no TypeScript), Redux Toolkit + `redux-thunk`, `react-router-dom` v6, axios, Tailwind, `chart.js` + `echarts`, `@react-pdf/renderer` / `docx` / `xlsx` (exports), `jwt-decode`, `react-toastify`.

### Structure
| Path | Role |
|------|------|
| `src/features/*` | ~19 Redux slices by domain (auth, energy/{fuel,electricity,fugitive}, scope3/{cat1-9}, water, social, supplier). Each slice has a colocated `*Thunk.js`. |
| `src/pages/*` | Page containers — load data on mount, dispatch thunks. |
| `src/components/*` | Presentational components + `common/` (layout, guards). |
| `src/routes/routeConfig.js` | Central route table: **public** / **private** (auth-gated) / **protected** (auth + permission-gated). |
| `src/customHooks/useApi.js` | **The real axios layer.** Per request: pulls fresh token from localStorage, decodes it, auto-refreshes if <60s to expiry, attaches `Bearer`, and on 401 clears auth + redirects to `/login`. Uses `withCredentials: true`. |
| `src/app/permissionService.js`, `routePermissions.js` | RBAC: maps each route to a required `{module, submodule, type}` and checks the JWT's `member.access` matrix. |
| `src/runtime.js` | Reads `window.__ENV__` (injected at container start) → API URLs + `CLIENT_NAME`. Enables build-once / deploy-many. |

> ⚠️ `src/services/api.js` exists but bakes a **stale** token at init — always use `useApi()`.

### Client auth & permissions
- JWT stored in `localStorage` (`accessToken` / `refreshToken`).
- Token payload carries `user`, `organization`, and `member.access` — a permission matrix:
  `{ data_entry, visualization, reporting, management, auditing, admin }`, each `{ is_enabled, modules[], submodules[] }`.
- `ProtectRoutes.js` + `permissionService.hasAccess()` enforce per-route access.
- `MainLayout` gates the whole app behind a **mandatory onboarding-steps** check until org setup is complete.

---

## 4. User-management service (`greenmentor-in-um`)

**Stack:** Express + Sequelize, `jsonwebtoken`, `bcryptjs`, `speakeasy` (TOTP 2FA), `@sendgrid/mail` (email), `express-rate-limit`, `ajv` (request-schema validation), `handlebars` (email templates). Hexagonal layering (route → controller → use-case → entity → data-access). Shares the Postgres DB with `-be`.

### Endpoints (`/api/v1`)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/user/login` | bcrypt verify → optional 2FA → issue access (2h) + refresh (15d) JWT, persist to `AuthStore` |
| POST | `/user/logout` | revoke token in `AuthStore` |
| POST | `/user/refresh-token` | rotate access/refresh tokens |
| POST | `/user/create` | create user |
| POST | `/member/create` | add member to org |
| POST | `/member/update-permissions` | edit the RBAC access matrix |
| POST | `/user/change-password`, `/user/request-password-reset`, `/user/reset-password` | password lifecycle |
| POST | `/user/2fa/setup`, `/user/2fa/verify`, `/user/2fa/disable` | TOTP 2FA lifecycle |

**JWT payload:** `{ user, organization (incl. fiscal_year), member: { role_type, access } }`.

---

## 5. Backend (`greenmentor-in-be`)

**Stack:** Express + Sequelize (Postgres via `pg`), `jsonwebtoken`, `multer` (memory uploads), `@google-cloud/storage` + `aws-sdk` (file storage), `openai`, `puppeteer` (present but PDF is done client-side), Jest.

### Clean / hexagonal architecture (consistently applied)
```
route → middleware → makeExpressCallback (framework adapter)
      → controller → use-case (business logic)
      → entity (validation, frozen getters)
      → data-access query (Sequelize ORM + raw SQL hybrid) → model
```

### Middleware
- **`validateAuth`** — verifies JWT (`AUTH_KEY`), confirms it exists in `AuthStore`, injects `req.context.organizationId`, `financialYearType`, `req.member`. *(Sets a `global.financialYear` — a concurrency hazard.)*
- **`validateLoginSteps`** — onboarding gate.
- **`validateCheckerRole`** — only `super admin` / `admin` / `manager` may approve/reject.

### Domain modules
Each module exposes the same shape — **CRUD + evidence upload + approve/reject + CSV export**:
- **Energy:** `fuel` (Scope 1 combustion), `electricity` (Scope 2), `fugitiveEmission` (refrigerants / fire suppressants).
- **Scope 3:** categories **1, 2, 3, 4, 5, 6, 7, 9** (purchased goods, capital goods, fuel-&-energy, upstream transport, waste, business travel, commuting, downstream transport).
- **Water** (withdrawal + discharge), **Social** (~25 BRSR social/governance tables), **General/BRSR** (company profile, reporting framework, corporate identity, disclosure responses).

### Cross-cutting services
- Uploads: `multer` (memory) → **GCS** (`GCPConfig.js` mimics the S3 API), AWS S3 fallback.
- **OpenAI** (`aiResponseGenerator.js`, `gpt-4o-mini`) auto-drafts BRSR disclosure text.
- Field-level **AES-256** encryption; generic CSV-export factory.
- Tests: thin — only `fuel` has unit + integration coverage.

---

## 6. Data model

Everything is tenant-scoped under **`organization`**. `user → member → organization`, with `member.permissions` (JSONB) driving access. `site_master → site_combination_master` is referenced by nearly every emissions table.

### The repeating 4-table pattern (per emission category)
- `*_input_master` — the entry, `*_input_audit` — change log
- `*_data` — calculated rows: `quantity → emission_factor → total_co2e_kg` split into `co2 / ch4 / n2o`
- `*_emission_master` — reference emission factors

All rows carry `organization_id`, `site_combination_id`, `financial_year` / `financial_quarter` (fiscal year is per-org: APR–MAR or JAN–DEC), and a `status` driving the workflow.

### Central tables
| Table | Role |
|-------|------|
| `organization` | tenant root |
| `user` / `member` / `role` | identity + RBAC (`permissions` JSONB) |
| `AuthStore` | shared session/token table across `-um` and `-be` |
| `site_master` / `site_combination_master` | facility hierarchy referenced everywhere |
| `approval_request` | polymorphic maker-checker (`request_status`: submitted → approved/rejected, `feedback`) |
| `brsr_response` | BRSR answers (`disclosure_code` / `question_id` → `answer` / `comment` / `note`, status default `Pending`) |
| `social_*` (~25 tables) | demographics, training, turnover, safety incidents, board diversity, CSR, complaints, … |
| master data | `currency_master`, `country/state/city_master`, `unit_master`, `lca_activity_master`, `source_type_master`, `gas_gwp_master`, emission masters |

~165 Sequelize models, ~183 migrations total.

---

## 7. End-to-end auth flow

1. FE `LoginForm` → `loginUser` thunk → `POST {USER_API}/user/login` (**um**).
2. **um** `login-user.js`: bcrypt-verify → if `is_2fa_enabled`, return `require2FA` then verify TOTP `otp` → build JWT `{user, organization, member.access}` → sign **access (2h)** + **refresh (15d)** → persist to `AuthStore` → return both.
3. FE stores tokens in localStorage, decodes for user/permissions, sets `isAuthenticated`.
4. Every FE request via `useApi`: refreshes proactively if <60s to expiry (`POST /user/refresh-token`), attaches `Bearer`.
5. **be** `validateAuth` verifies the same JWT with `AUTH_KEY`, confirms it's in `AuthStore` (logout/refresh revokes old tokens), injects org context.
6. Any 401 → FE clears tokens, redirects to `/login`.

---

## 8. Infrastructure & deployment

- Both backends + the frontend containerize to Google **Cloud Run**.
  - **FE:** multi-stage Docker (`node` build → `nginx:alpine`); `env.sh` writes `window.__ENV__` at container startup → build-once / deploy-many.
  - **BE / UM:** single-stage `node:18`.
- **CI/CD:** Google **Cloud Build** (`cloudbuild.yaml` + `cloudbuilds/cloudbuild.us.yaml`) → **Artifact Registry** → Cloud Run, across **two GCP projects/regions**: `greenmentor-prod-in` (asia-south1, primary) and `greenmentor-prod-us` (us-central1).
- **Storage:** GCS buckets (evidence); PostgreSQL (Cloud SQL) shared by both backends.
- **Per-client differentiation is runtime, not build-time:** same image switched via `CLIENT_NAME` + API-URL env vars and `organization_id` data isolation.
- **Secrets via env:** `AUTH_KEY`, `REFRESH_KEY`, `PG*`, `GCP_CREDENTIALS`, `OPENAI_API_KEY`, `SENDGRID_API_KEY`, `ALLOWED_ORIGINS`.

---

## 9. Known gotchas / risks

- `src/services/api.js` (FE) bakes a stale token — use `useApi()`.
- `be` `auth.js` sets a mutable `global.financialYear` (concurrency hazard).
- **CORS** is a recurring pain — `CORS_FIX_GUIDE.md` documents that custom domains (e.g. `greenmentor.live`) must be added to `ALLOWED_ORIGINS` on **both** `-um` and `-be`, with `credentials: true`.
- Test coverage is minimal (fuel only).
- One electricity route is mislabeled `/purchased-fuel` (copy-paste).
- No TypeScript anywhere in FE/BE/UM; no shared API-contract types between FE and the two backends.
```
