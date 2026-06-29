# Unified Green Mentor Pro — Convergence Plan

## Context

GreenMentor has three real-but-separate codebases plus an external viz/feed monorepo, and a written PRD. The goal is to converge them into **one unified consumer/prosumer ESG platform** that executes `green-mentor-pro/PRD-GreenMentorPro.md`, with the Feed modeled on **footshorts** and rendering through **vismay**. This plan delivers (1) a thin **convergence vertical slice** that proves every seam, then builds out (2) the **target scope = the green boxes in the "Green Mentor 3" FigJam board** — an AI-Hub-centric milestone.

### Sources being fused

| Source | Today | Role in unified app |
|---|---|---|
| `green-mentor-pro/prototype` (3100) | Static Next 15 shell, design tokens, 5-section click-through | **UI shell + IA** (copy in) |
| `green-mentor-pro/esg-agents` (3300) | Real 8-phase BRSR engine: Supabase, Claude strict tool-use, portable agent packages, EFDB | **AI Hub brain** — its agents ARE the agent families |
| `academy/green-mentor-plus` | Onboarding: Next 15 + Zustand + Razorpay | **Auth/onboarding funnel** (port in) |
| `green-mentor-pro/community-engine` (3200) | Maker tools on shared Supabase + Google OAuth | **Auth + Supabase pattern** (copy) |
| `github.com/suprabho/vismay` → `apps/footshorts` | InShorts-style swipe-card AI football-news app (RSS→Gemini→Supabase→swipe feed + follow graph) | **Feed blueprint** (reimplement for ESG) |
| `…vismay` → `packages/viz-engine`, `packages/ai-gateway`, `verticals/*` | Viz engine (registry + slot dispatchers + echarts/deck.gl/rive), AI-gateway wrapper, VizModule verticals | **Rendering + feed-AI seams** (git submodule) |

## Locked decisions (Supro, 2026-06-26)

1. **Home & topology:** unified app lives in the **GreenMentor monorepo**; **vismay added as a git submodule** + pnpm workspace; `transpilePackages` the engine.
2. **esg-agents:** reuse the agent **runtime** to power the AI Hub families **now**; full 8-phase pipeline stays a separate linked surface later.
3. **Vismay:** live — wire **real** render calls.
4. **Feed:** footshorts pattern (swipe AI-summary cards + follow graph + ingestion worker).
5. **Build order:** ship the **vertical slice** first, then build the full **green-box target scope** ("P3").

## Target scope — the green boxes ("Green Mentor 3")

The spine: **the esg-agents agent packages become the AI Hub families.** Mapping:

| Green AI-Hub family | Backed by esg-agents agent(s) |
|---|---|
| ESG Buddy Chatbot | `lib/ai/gateway.ts` (ESG Buddy system + tools) |
| Communication Agents | `agents/comms-outreach` |
| Document Extraction Agents | `agents/data-collection` (Playwright/EFDB extraction) |
| Planning Agents | `agents/kickoff-scoping`, `agents/materiality`, `agents/data-requirement-planner` |
| Data Analyst & Visualizer Agents | `agents/calculation-metrics`, `agents/data-validation` **+ `@vismay/viz-engine` for charts** |
| Documents & Reports Producer Agents | `agents/report-drafting`, `agents/finalization-publishing` |

Also green: **Feed** = Open Global ESG Feed (like/dislike/comment) · Calendar · Upcoming Webinars. **Academy** = Courses · Webinars. Out of scope for this milestone (white in board): Leaderboards, Content Library, Fundamental learning loop, all Jobs, Longsite Lite, Green Learning Profile — built behind "coming soon" later.

## Architecture & integration

- **App:** new Next **16** (App Router, forced by `@vismay/viz-engine` peer-dep) + TS strict + Tailwind v4 + Phosphor at `green-mentor-pro/platform/` (name TBD). Copy prototype's `app/globals.css` tokens + `components/shell.tsx` + `components/ui.tsx` as the shell.
- **Monorepo wiring (the critical setup):**
  - `git submodule add https://github.com/suprabho/vismay green-mentor-pro/vendor/vismay`.
  - Create a pnpm workspace at the GreenMentor repo root (none exists today): include `green-mentor-pro/platform`, `green-mentor-pro/esg-agents`, a new shared `@gm/agents` package, a new `green-mentor-pro/greenmentor-viz` vertical, and the submodule's `vendor/vismay/packages/*` (so `@vismay/viz-engine` + `@vismay/ai-gateway` resolve via `workspace:*`).
  - `next.config.ts`: `transpilePackages: ['@vismay/viz-engine','@vismay/ai-gateway','@vismay/greenmentor-viz']`.
  - **Risk to de-risk in the slice:** vismay is itself a pnpm/turbo workspace with internal `workspace:*` deps — pull only the packages we need (viz-engine, ai-gateway), not all verticals, and validate nested resolution + heavy deps (deck.gl/mapbox/echarts/rive) install cleanly. Fallback = vendor those two packages if submodule resolution fights us.
- **Auth:** Supabase Auth (email + Google) via community-engine's `@supabase/ssr` + `middleware.ts` pattern on the shared project (`haokazwcljdummkvufcg`); anonymous read on Feed; drop legacy `-um`.
- **Onboarding:** port green-mentor-plus wizard (welcome→audience→goals→plan→checkout→handoff), Zustand + Razorpay, into post-signup.
- **AI seams (two, by job):**
  - **Feed summarization / entity tagging** → `@vismay/ai-gateway` (Gemini Flash), like footshorts.
  - **AI Hub agents + ESG Buddy** → esg-agents Anthropic runtime (Claude strict tool-use). Extract `lib/agents` (+ `lib/anthropic`, tool handlers) + curated agent packages into a shared **`@gm/agents`** workspace package consumed by BOTH esg-agents (full pipeline) and the platform (per-run AI Hub) — single source of truth, no divergence.
- **Data model:** per-user multi-tenancy (RLS by `user_id`) per PRD §8. Target-scope tables: `profiles`; feed `articles` + `entities` + `follows` + `reactions` + `comments` (footshorts-shaped); `calendar_events` + `rsvps` + `webinars`; `courses` (+ webinars catalog); `agent_runs` (reuse esg-agents' shape). Credits/workspaces deferred.

## AI Hub (centerpiece)

Each family = guided input form → credit hold (stub now) → `runAgent` over the mapped esg-agents package(s) → reviewable/editable output → save/download. `scripts/run-agent.ts` already proves agents run standalone (outside the phase pipeline) — that's the per-run seam. ESG Buddy = chat reusing the existing gateway system prompt + tools, with hand-off suggestions to the right family. Data Analyst & Visualizer renders results through `@vismay/viz-engine` modules.

## Feed (footshorts pattern, reimplemented for ESG)

- **Ingestion worker** (Node/TS, GitHub Actions cron) mirroring `apps/footshorts/worker`: ESG/regulatory RSS (BRSR/CSRD/SEC/sustainability press) → `@vismay/ai-gateway` Gemini Flash → 60-word summary + entity extraction (frameworks/topics/regions/companies) → Supabase. Live-scores analog = **Calendar** regulatory deadlines + Upcoming Webinars refresh.
- **Feed UI** adapted from `apps/footshorts/web/app`: swipeable AI-summary cards, filter chips, **follow graph** (follow frameworks/topics/regions/companies), entity/story pages. Anonymous read; react/comment/RSVP = account.
- **Viz in cards** via the new `@vismay/greenmentor-viz` vertical (echarts trends, deck.gl regional maps) through engine slots.

## Academy (green subset only)

Courses catalog + Webinars (RSVP → Calendar). Defer the Fundamental learning loop, quizzes, Ask AI, profile per the green scope. Content remains Vizmaya-sourced (Academy PRD owns the model).

## Build order

**Increment 1 — convergence vertical slice (de-risks every seam):**
1. Monorepo: pnpm workspace at root, add vismay submodule, wire viz-engine + ai-gateway, scaffold Next 16 `platform` app with prototype shell — prove one `@vismay/viz-engine` module renders.
2. Auth + onboarding: Supabase auth (community-engine pattern) + ported green-mentor-plus wizard.
3. AI Hub slice: extract `@gm/agents`; wire **Document Extraction** + **Documents & Reports Producer** end-to-end (form → run → reviewable output); ESG Buddy chat.
4. Feed slice: ESG ingestion worker (RSS → ai-gateway → Supabase) + swipe feed + follow graph + one viz card.
5. Stubs: Academy (Courses/Webinars), Calendar, Profile navigable.

**Increment 2 — complete the green target scope:**
- AI Hub: remaining families (Communication, Planning, Data Analyst & Visualizer) + ESG Buddy tiers.
- Feed: Calendar (deadlines + ESG tasks) + Upcoming Webinars live, reactions/comments at scale.
- Academy: Courses + Webinars live (enroll/RSVP), wired to Calendar.

## Critical files

- Shell/design: `green-mentor-pro/prototype/{app/globals.css, components/shell.tsx, components/ui.tsx}` → copy into `platform`.
- Agent runtime: `green-mentor-pro/esg-agents/lib/agents/{loadAgent,runAgent,toolHandlers}.ts`, `lib/anthropic/*`, `agents/*`, `scripts/run-agent.ts` → extract to `@gm/agents`.
- Auth: `green-mentor-pro/community-engine/{middleware.ts, lib/supabase/*, app/auth/*, app/login}` → pattern for `platform`.
- Onboarding: `academy/green-mentor-plus/app/onboarding/*`, `lib/store/onboarding.ts` → port.
- Feed blueprint: `vendor/vismay/apps/footshorts/{worker/src, web/app, shared/src, supabase}` → reimplement for ESG.
- Vismay seams: `vendor/vismay/packages/{viz-engine,ai-gateway}` (consume), `vendor/vismay/verticals/footshorts-viz` (model `greenmentor-viz` on it).

## Verification (end-to-end)

- `pnpm install` resolves the submodule's `@vismay/*` via workspace; `platform` builds on Next 16; one viz-engine module renders on screen.
- Supabase auth (Google + email) round-trips; onboarding completes and persists.
- Worker run ingests real ESG RSS → a 60-word card with entities lands in Supabase → feed renders + follow graph filters it.
- AI Hub: Document Extraction run (upload → `runAgent` → structured table) and Reports Producer run (→ DOCX/PDF) both produce reviewable output.
- Data Analyst & Visualizer output renders through a `@vismay/viz-engine` chart module.
