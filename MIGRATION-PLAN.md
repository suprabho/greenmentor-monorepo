# GreenMentor Rebuild — Phased Migration Plan

> Execution plan for rebuilding the legacy `greenmentor-in-*` platform (see [ARCHITECTURE.md](./ARCHITECTURE.md)) on the modern stack, using a strangler-fig approach and reusing the emission-factor assets already built in `consulting/efdb` and `consulting/ls-ingestion`. Effort numbers tie back to [REBUILD-ESTIMATE.md](./REBUILD-ESTIMATE.md). Last updated: 2026-06-02.

---

## 1. Strategy: strangler-fig, not big-bang

Don't rewrite all three legacy services at once. Stand up a new app shell next to the live system, move one capability at a time behind it, and keep the legacy backend serving everything not yet migrated. Each phase ships independently and is verifiable against the legacy app.

```
            ┌──────────────── new Next.js + Supabase app ────────────────┐
  users ──▶ │  (grows each phase)                                        │
            │   auth ──▶ Supabase Auth        emissions ──▶ EF service    │
            └───────┬───────────────────────────────────┬────────────────┘
                    │ not-yet-migrated calls             │
                    ▼                                     ▼
            legacy greenmentor-in-be  (shrinks each phase)   efdb (reused)
```

**Reuse engine:** the new app's emission layer is built on the **already-production `efdb` service** (FastAPI + pgvector + Claude) and the `ls-ingestion` extraction/calculation code — not rebuilt from scratch.

---

## 2. Target architecture (modern stack)

| Concern | Legacy | New |
|---|---|---|
| Frontend | CRA + Redux | Next.js App Router + TS + Tailwind + shadcn + TanStack Query + Zustand |
| Auth / users (`-um`) | Express service + JWT + AuthStore | **Supabase Auth** (MFA built-in) + RLS |
| Domain API (`-be`) | Express + Sequelize | Supabase RPC / Edge Functions (+ FastAPI where heavy logic is needed) |
| Emission factors | OpenAI + bespoke masters | **`efdb` (reused as-is)** — FastAPI + pgvector + Claude |
| DB | Cloud SQL | Supabase Postgres (+ pgvector) |
| Storage | GCS/S3 | Supabase Storage |
| Reports | react-pdf/docx/xlsx | same libs |
| Hosting | Cloud Run × 2 regions | Vercel (web) + Fly.io (efdb) + Supabase |

---

## 3. Emission-factor reuse map (from `efdb` + `ls-ingestion`)

This is the leverage. Most of the hard EF/calc layer already exists.

| Component | Source | Reuse | Action |
|---|---|---|---|
| **EF database schema** (65 cols: value, units, GHG/GWP, geo, scope, source, temporal, methodology, DQ, pgvector embedding) | `efdb/backend/app/models/emission_factor.py` | **100%** | Copy model + Alembic migrations wholesale |
| **EF versions / audit log** | `efdb` `emission_factor_versions`, `AuditLog` | **100%** | Copy |
| **EF search + filter API** (year, country, scope, source, DQ, tags, trigram) | `efdb` routers/services | **100%** | Copy routers |
| **Semantic EF search** (pgvector `<=>`) | `efdb/.../embeddings.py` | **95%** | Swap dev hash → real embedding API |
| **Ingestion pipeline** (scan → confirm meta → extract → review → commit) | `efdb` ingestion routers + `ls-ingestion/src/lib/ingestion.js` | **100%** | Reuse 4-step flow |
| **Claude extraction** (vision → structured JSON + confidence) | `efdb/.../extraction/pdf_agent.py`, `ls-ingestion/src/lib/claude.js` | **90%** | Retrain prompts for corporate ESG docs, not just utility bills |
| **Conflict detection** (trigram + GHG species + geo + temporal overlap) | `efdb/.../conflict_detection.py` | **100%** | Copy |
| **Data-quality / confidence scoring** (pedigree 1–5 → 0–100) | `efdb/.../confidence_score.py` | **100%** | Copy |
| **Emission calc** (`calcEmission`: qty × EF ÷ 1000, net-of-solar for S2) | `ls-ingestion/src/lib/emission.js` | **100% for S1/S2** | Reuse; extend for S3 categories + unit conversion |
| **EF lookup query builder** (activity → EF params, cached, DQ-sorted) | `ls-ingestion/src/lib/efdb.js` | **30%** | Generalize hardcoded `EFDB_QUERIES` (7 fuels) → dynamic taxonomy |
| **Post-extraction validation** (hard-reject + flag rules) | `ls-ingestion/src/lib/validation.js` | **60%** | Keep framework, replace utility-bill rules/enums |
| **Bill → row mapping** | `ls-ingestion/src/lib/sheets.js` | **40%** | Pattern reusable; redesign target schema |
| **ls-ingestion Supabase schema** (`fuel_bills`, `electricity_bills`) | `ls-ingestion/supabase/sheets_tables.sql` | **0%** | Redesign for the new emissions model |

**Gap to close for Scope 3:** the EF *table* already has Scope-3 rows, but the extraction/validation/lookup flow is currently built around fuels + electricity. Extend the extraction schema, validation rules, and lookup builder to handle supplier GHG data, material quantities, and Scope-3 activity categories.

---

## 4. Phases

Each phase is shippable and verifiable against the legacy app. Effort is solo + Claude-assisted (see [REBUILD-ESTIMATE.md](./REBUILD-ESTIMATE.md)).

### Phase 0 — Foundation (1 wk)
- Next.js + TS + Tailwind + shadcn scaffold; Supabase project; CI; design tokens from `green-mentor-plus`.
- Stand up `efdb` in the shared Supabase Postgres (it already runs on Supabase).
- **Exit:** app shell deploys; efdb reachable from the new app.

### Phase 1 — Auth, tenancy, RBAC (1.5 wk)
- Supabase Auth + MFA replaces `-um`. Model `organization` / `member` / role; encode the legacy `member.access` matrix as **RLS policies** + a `permissions` claim.
- White-label config table; onboarding-steps gate.
- **Exit:** a user logs in, lands in their org, sees only permitted modules. `-um` is now bypassable.

### Phase 2 — Core schema + masters (2.5 wk)
- Port the ~50–60 meaningful tables (collapse the 165). Establish the per-category `input / data / audit` pattern.
- Seed master/reference data (units, currencies, geo, LCA, GWP). Wire EF lookups to `efdb`.
- **Exit:** schema migrations + seeds reproducible; EF search works from the app.

### Phase 3 — Energy (Scope 1 + 2) (2 wk) ← first real strangle
- Fuel, electricity, fugitive emissions: forms → validation → `efdb` lookup → `calcEmission()` → store → approval.
- Reuse `claude.js` upload-and-extract for bill ingestion; reuse `emission.js` calc.
- **Exit:** Energy fully on the new app; route Energy traffic away from `-be`. Verify totals match legacy.

### Phase 4 — Scope 3 (3 wk)
- Categories 1,2,3,4,5,6,7,9. Generalize the EF lookup builder + extraction schema for supplier/material/travel data.
- **Exit:** Scope 3 on the new app; `-be` Scope 3 retired.

### Phase 5 — Water + Waste (1.5 wk)
- **Exit:** environmental modules migrated.

### Phase 6 — Social & Governance (2.5 wk)
- ~25 data types as typed forms + RLS. Mostly mechanical, high volume.
- **Exit:** Social/Governance migrated.

### Phase 7 — BRSR reporting engine (3.5 wk) ← highest-risk
- Disclosure model (9 principles + Section A/B), combined-data aggregation, Claude-drafted qualitative answers, PDF/DOCX/XLSX export in official format.
- **Exit:** generate a full BRSR report; diff against a legacy-generated report for fidelity.

### Phase 8 — Analytics + admin polish (3 wk)
- Dashboards (chart.js/echarts equiv), member/role admin, settings, bulk export.
- **Exit:** feature parity reached; `-be` and `-um` serve nothing.

### Phase 9 — Data migration + cutover (1.5–2 wk)
- ETL legacy Postgres → new schema per migrated module (ideally incrementally from Phase 3 on). Reconcile emission totals. Cut DNS; decommission Cloud Run + `-um`/`-be`.
- **Exit:** legacy stack retired.

### Cross-cutting (runs throughout, ~2.5 wk QA)
- Approval workflow, evidence storage, CSV export, parity test harness comparing new vs legacy outputs per module.

---

## 5. Sequencing rationale
- **Auth first** — nothing else is testable without it, and it deletes a whole service early.
- **Energy before Scope 3** — smallest emissions surface, exercises the full reuse stack (extract → EF lookup → calc → approve) end-to-end as a template for every later module.
- **BRSR late** — it consumes data from all other modules; building it before they exist means rework.
- **Migrate data per-module, not at the end** — so each phase cutover is a small, reversible strangle rather than one risky big-bang.

---

## 6. Quick wins to front-load
1. Drop `efdb` into the shared Supabase project on day one — the EF API is ready to serve.
2. Lift `emission.js` `calcEmission()` into the new app as the canonical Scope 1/2 calculator.
3. Reuse the `ls-ingestion` Claude bill-extraction flow for Energy evidence upload in Phase 3.
4. Generate Supabase RLS policies directly from the legacy `routePermissions.js` matrix.
