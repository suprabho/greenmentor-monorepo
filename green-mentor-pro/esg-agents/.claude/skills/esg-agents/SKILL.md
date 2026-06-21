---
name: esg-agents
description: >-
  Work with the GreenMentor ESG-Agents system — the AI-agent workforce that automates
  the 8-phase ESG/BRSR reporting engagement. Trigger when the user asks to "add an
  agent", "edit an agent prompt/skill", "change a phase", "wire a tool", "add a
  collection channel", "run an agent", or otherwise work inside green-mentor-pro/esg-agents.
  Each agent is a portable package (skill.md + io.schema.json + tools.json + templates/).
---

# ESG-Agents — skill

Automates the traditional 8-phase ESG/BRSR consulting engagement with one AI agent
per phase, under a human-in-the-loop gate. Everything an agent is lives in its
package folder; the runtime loads and binds it to an Anthropic strict tool-use call.

## Where things live

All paths under `green-mentor-pro/esg-agents/` (run commands from there).

| Thing | Path |
|---|---|
| Agent packages (source of truth) | `agents/<key>/{skill.md, io.schema.json, tools.json, templates/}` |
| Registry index | `agents/registry.json` (regenerate via `scripts/build-registry.ts`) |
| Loader (package → runtime object) | `lib/agents/loadAgent.ts` |
| Runtime binding (strict tool-use) | `lib/agents/runAgent.ts` |
| Phase state machine | `lib/orchestrator/pipeline.ts` |
| HITL gate logic | `lib/orchestrator/gates.ts` |
| Channels (portal/upload + stubs) | `lib/channels/` |
| Schema migration | `supabase/migrations/0001_esg_agents.sql` |
| Engagement + framework config | `config/engagement.template.json`, `config/framework-mapping.json` |

## To add or edit an agent

1. Create/modify `agents/<key>/skill.md`. Frontmatter is the source of truth:
   `name`, `description` (with trigger phrases), `model` (one of `claude-opus-4-8` /
   `claude-sonnet-4-6` / `claude-haiku-4-5`), `phase`, `family`, `tools[]` (must be a
   subset of `tools.json`), `emit_tool`, `hitl_gate`, `version`. The markdown body IS
   the system prompt.
2. Define `io.schema.json` with `$defs.input` and `$defs.output`. Every object must
   set `additionalProperties:false`. Use the canonical provenance shape
   (`agents/_shared/schema/per-field-result.json`) for extracted/derived values.
3. List callable tools in `tools.json` (Anthropic tool defs). The forced final tool
   is `emit_tool`; the runtime defines it inline from `io.schema.json#/$defs/output`.
4. Run `pnpm packages:validate` to lint the package, then
   `pnpm registry:build` to refresh `registry.json`.

## To run an agent

```bash
pnpm agent:run <agentKey> <input.json>
# e.g. pnpm agent:run data-collection config/samples/portal_upload_manifest.sample.json
```

## Conventions (do not break)

- The markdown body of `skill.md` is the system prompt — never hardcode prompts in TS.
- Per-field provenance + min-of-per-field confidence; low/outlier items route to the
  human review queue. No phase advances while a review item is unresolved.
- WhatsApp/email channels are v1 stubs — leave them disabled; implement `ingest()` and
  flip `enabled` to add them later, no core changes needed.
