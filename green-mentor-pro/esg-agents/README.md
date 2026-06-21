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
| `supabase/migrations/` | schema: orgs, engagements, phases, agent_runs, artifacts, validations, review_queue, assumptions. |
| `scripts/` | `run-agent`, `validate-packages`, `build-registry`, `seed-engagement`, `advance-phase` (via `tsx`). |

## Agent package format

Each `agents/<key>/` folder:

- **`skill.md`** — YAML frontmatter (`name`, `model`, `phase`, `family`, `tools`, `emit_tool`, `hitl_gate`, `version`, …) + a markdown body that **is** the system prompt.
- **`io.schema.json`** — `$defs.input` + `$defs.output` JSON Schemas. Every object is `additionalProperties:false` (strict tool-use). Extracted/derived values use the canonical `{ value, source_snippet, extraction_confidence, extraction_note }` shape.
- **`tools.json`** — Anthropic tool defs the agent may call mid-run (e.g. `search_emission_factors`).
- **`templates/`** — message / report-section / form-schema templates the agent fills.

## Local quickstart (scaffold)

```bash
cp .env.example .env.local          # add ANTHROPIC_API_KEY + Supabase keys
pnpm install                        # or npm install
pnpm packages:validate              # lint every agent package
pnpm agent:run data-collection config/samples/portal_upload_manifest.sample.json
```

> This is the scaffold from the approved plan. The lib runtime + agent packages are
> in place; the Next.js review console UI, the EFDB tool wiring, and the DB access
> layer are stubbed for the milestones (M1–M5) in the plan.
