# GreenMentor Rebuild — Stack Comparison & Effort Estimate

> Comparison of the legacy `greenmentor-in-*` platform (see [ARCHITECTURE.md](./ARCHITECTURE.md)) against the user's modern stack, with a phased rebuild estimate. See [MIGRATION-PLAN.md](./MIGRATION-PLAN.md) for the execution plan and the emission-factor reuse map. Last updated: 2026-06-02.

---

## 1. Stack comparison

| Dimension | Legacy `greenmentor-in-*` | Your stack (green-mentor-plus / efdb / ls-ingestion) | Effect on rebuild |
|---|---|---|---|
| Language | JavaScript, no types | TypeScript everywhere | Safer; upfront cost to type ~165 tables of domain |
| Frontend | CRA (`react-scripts`) | Next.js App Router / Vite + React | Comparable; Next adds SSR + API routes free |
| State | Redux Toolkit + 19 thunk slices | Zustand + TanStack Query | **Big simplification** — Query removes data-fetching/caching boilerplate |
| UI | hand-rolled + Tailwind | Radix/shadcn + Tailwind + Framer | Faster, consistent forms (this app is *all* forms) |
| Auth | Custom `-um` service: JWT, 2FA, AuthStore, refresh | Supabase Auth (or FastAPI + jose) | **Entire service deleted** |
| Backend | 2× Express + Sequelize, hexagonal (route→ctrl→use-case→entity→DAO) | Supabase (RLS + RPC/Edge Fns) **or** FastAPI + SQLAlchemy | 4-layer boilerplate collapses to typed RPC/server actions |
| RBAC / tenancy | JWT `member.access` matrix + middleware | Postgres **RLS** + org claim | Enforced at DB, far less app code |
| DB | self-managed Cloud SQL, 183 migrations | Supabase Postgres + pgvector | Same engine, managed; pgvector enables semantic EF match |
| AI | OpenAI `gpt-4o-mini` | **Anthropic Claude** (already wired in efdb/ls) | Swap provider; pattern already proven |
| Storage | GCS + S3 adapter | Supabase Storage | Drop the custom adapter |
| Infra | Docker + Cloud Build + Cloud Run × 2 GCP projects | Fly.io / Vercel + Supabase | Much less DevOps |
| Reports | react-pdf / docx / xlsx (client-side) | same libs available | Reusable as-is |

**Net:** your stack deletes an entire service (`-um`), most DAO/use-case boilerplate, the auth/storage/infra plumbing, and a chunk of the Redux layer — roughly **40–50% less code** for the same behavior.

---

## 2. What stays hard regardless of stack

A modern stack removes *plumbing*, not *domain*. These dominate the timeline:

1. **Emission-calculation engine** — Scope 1/2/3 across 8+ categories: quantity → unit conversion → emission factor (by year/source) → GWP split into CO₂/CH₄/N₂O.
2. **BRSR report structure** — 9 principles + Section A/B, hundreds of disclosure questions with tables, then PDF/DOCX/XLSX rendering in the official format.
3. **~25 social/governance data types** — each its own form + validation + storage.
4. **Emission-factor & master reference data** — units, LCA activities, GWP, geo, currencies.
5. **Maker-checker approval workflow** across every module.
6. **Data migration** from the existing Postgres (live client data).

> **Major offset:** items 1 and 4 are *substantially pre-built* in your `efdb` + `ls-ingestion` projects — a production EF database (65-column schema, semantic search, Claude ingestion pipeline, conflict detection, DQ scoring) and a working `calcEmission()`. See [MIGRATION-PLAN.md](./MIGRATION-PLAN.md). This is the single biggest reason the rebuild is cheaper than the original.

---

## 3. Effort estimate

Assumes **one experienced full-stack dev on your stack, leaning hard on Claude Code**, building to *behavior parity*. Person-weeks.

| Workstream | Wks | Notes |
|---|---:|---|
| Foundation: Next.js + Supabase + design system + CI | 1.0 | |
| Auth + multi-tenancy + RBAC (RLS) + 2FA | 1.5 | Supabase Auth replaces `-um` |
| Core schema (~50–60 meaningful tables) + seed masters | 2.5 | |
| Energy: fuel (S1) + electricity (S2) + fugitive | 2.0 | **calc engine ~60% reusable from ls-ingestion** |
| Scope 3 (8 categories) | 3.0 | EF lookup partly reusable; per-category forms remain |
| Water + Waste | 1.5 | |
| Social & Governance (~25 types) | 2.5 | irreducible — many forms |
| BRSR reporting engine (disclosures, AI draft, PDF/DOCX/XLSX) | 3.5 | irreducible — highest hidden cost |
| Analytics / dashboards | 1.5 | |
| Bulk CSV upload + export + evidence storage | 1.0 | upload/extract flow reusable from ls-ingestion |
| Admin: user/member mgmt, settings, onboarding, white-label | 1.5 | |
| Data migration from legacy Postgres | 1.5 | |
| QA / parity testing / hardening | 2.5 | |
| **Total** | **~24.5 wks ≈ 6 months solo** | (was ~26.5 before EF reuse credit) |

### Scenarios

| Scenario | Scope | Solo (Claude-assisted) | Team of 2–3 |
|---|---|---|---|
| **Thin MVP** | Auth + multi-tenant, Energy S1/S2, 2–3 Scope-3 cats, basic BRSR + dashboards, approvals | **9–11 weeks** | ~6 weeks |
| **Full parity** | everything above | **22–30 weeks (~5.5–7 mo)** | **~11–15 weeks (~3–3.5 mo)** |
| **Parity + improvements** | + TS types, RLS hardening, test coverage, pgvector EF semantic matching | ~28–38 weeks | ~15–19 weeks |

**Reference:** the original — 3 services, ~165 models, 183 migrations, multi-client, built by a team over the git history — is roughly **12–18+ person-months** of original work. The rebuild is materially faster because (a) the domain is now fully understood, (b) the stack eliminates auth/infra/DAO boilerplate, (c) AI accelerates the form/CRUD/calc layers, and (d) the EF layer already exists.

### Biggest estimate risks (could push *up*)
- **Emission-factor data licensing** — if EF/LCA datasets must be re-sourced rather than copied, add weeks. (Mitigated: `efdb` already holds a curated EF store.)
- **BRSR output fidelity** — auditors care about exact report formatting; parity QA here is deceptively long.
- **Live data migration** with zero loss for existing paying clients.
- **Scope-3 calc nuances** — per-category methodology differences hide effort.
