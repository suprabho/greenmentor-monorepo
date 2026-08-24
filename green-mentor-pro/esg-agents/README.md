# GreenMentor ESG-Agents

An AI-agent workforce that automates the 8-phase ESG / BRSR reporting engagement,
with a **human gate after every phase** (the AI drafts; a consultant verifies). Built
as a Next.js 15 + Supabase app, reusing the community-engine strict-tool-use pattern,
the EFDB extraction conventions, and the ls-ingestion enum-constrained vision flow.

> Full design + build plan: `~/.claude/plans/demand-signal-from-the-glimmering-porcupine.md`

## How it works

```
config/engagement.template.json
        │  seed
        ▼
8-phase state machine (lib/orchestrator/pipeline.ts)
  kickoff → materiality → data_requirements → data_collection
          → data_validation → calculation → report_drafting → publication
        │  each phase loads ONE agent package and runs it
        ▼
agents/<phase>/  ← skill.md (system prompt) + io.schema.json + tools.json + templates/
        │  loadAgent() → runAgent(): Anthropic strict tool-use, Ajv-validated output
        ▼
draft artifact (JSONB, per-field confidence + provenance)
        │  low-confidence / outliers → review_queue (review_required=true)
        ▼
HUMAN GATE (maker-checker) → approve → cascade to next phase
```

## Layout

| Path | What |
|---|---|
| `agents/` | **Source of truth** — one portable package per agent (10 total). `registry.json` indexes them. |
| `agents/_shared/` | House style, HITL contract, the canonical per-field provenance schema, framework enums. |
| `lib/agents/` | `loadAgent.ts` (package → typed `LoadedAgent`), `runAgent.ts` (strict tool-use binding), `toolHandlers.ts`, `types.ts`. |
| `lib/orchestrator/` | `pipeline.ts` (phase DAG), `gates.ts` (HITL gate logic), `quality.ts` (confidence + outliers). |
| `lib/channels/` | `portal` + `upload` adapters (v1); `whatsapp`/`email` stubs (future extension point). |
| `lib/anthropic/` | client singleton + model registry (`claude-opus-4-8` / `-sonnet-4-6` / `-haiku-4-5`). |
| `config/` | `engagement.template.json`, `framework-mapping.json`, sample artifacts. |
| `supabase/migrations/` | schema: orgs, engagements, phases, agent_runs, artifacts, validations, review_queue, assumptions, agent package edits. |
| `scripts/` | `run-agent`, `validate-packages`, `build-registry`, `pull-packages`, `seed-engagement`, `advance-phase` (via `tsx`). |

## Agent package format

Each `agents/<key>/` folder:

- **`skill.md`** — YAML frontmatter (`name`, `model`, `phase`, `family`, `tools`, `emit_tool`, `hitl_gate`, `version`, …) + a markdown body that **is** the system prompt.
- **`io.schema.json`** — `$defs.input` + `$defs.output` JSON Schemas. Every object is `additionalProperties:false` (strict tool-use). Extracted/derived values use the canonical `{ value, source_snippet, extraction_confidence, extraction_note }` shape.
- **`tools.json`** — Anthropic tool defs the agent may call mid-run (e.g. `search_emission_factors`).
- **`templates/`** — message / report-section / form-schema templates the agent fills.

### Where an edit lives

The folders above are the base layer, bundled into the deployment. Edits saved from
the Agent Studio go to `esg_agent_package_files` in Supabase and are laid over them at
read time — because the deployed filesystem is read-only (`/var/task` on Vercel), and
because an edit has to reach the running app without a redeploy.

That means the database, not the repo, is the live truth for anything edited through
the UI. Two consequences worth internalising:

- A file served from the store is marked **◆** in the Studio, and **Revert to package**
  drops the stored row so it falls back to the repo.
- `pnpm packages:pull` writes stored edits back into `agents/` so you can review and
  commit them. Run it before you assume `git log` tells you what the agents are doing.

If the table is missing or Supabase is unreachable, reads fall back to the bundled
files and log a warning — a store outage must not take the pipeline down. Saves fail
loudly rather than silently not happening.

## Local quickstart (scaffold)

```bash
cp .env.example .env.local          # add ANTHROPIC_API_KEY + Supabase keys
pnpm install                        # or npm install
pnpm packages:validate              # lint every agent package
pnpm agent:run data-collection config/samples/portal_upload_manifest.sample.json
```

**Database** — apply `supabase/migrations/*.sql` in order via the Supabase SQL Editor
(the shared project; there is no migration CLI here). `supabase/apply-all.sql` is the
same set concatenated for a single paste. Until `0003_esg_agent_packages.sql` is
applied, the Agent Studio renders and runs fine but saving returns
`Could not find the table 'public.esg_agent_package_files'`.

> This is the scaffold from the approved plan. The lib runtime + agent packages are
> in place; the Next.js review console UI, the EFDB tool wiring, and the DB access
> layer are stubbed for the milestones (M1–M5) in the plan.
