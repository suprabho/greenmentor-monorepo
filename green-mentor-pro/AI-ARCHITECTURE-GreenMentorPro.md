# AI / Agent Architecture — Green Mentor Pro

| | |
|---|---|
| **Document** | AI & Agent Architecture |
| **Version** | 1.0 (draft for review) |
| **Date** | 2026-06-19 |
| **Owner** | Product / Eng (Supro) |
| **Status** | Draft |
| **Related** | `PRD-GreenMentorPro.md` (§5.5 AI Hub) · `BUILD-PLAN-GreenMentorPro.md` (P0.5/P0.6/P2.4) · `prototype/` · `REBUILD-ESTIMATE.md` |
| **External** | [`vercel/eve`](https://github.com/vercel/eve) (beta) · Vercel AI SDK (Generative UI) · Claude Agent SDK |

---

## 1. Summary

The AI Hub has **two different AI surfaces**, and the single biggest architectural decision
is to *not* build them the same way:

- **Conversational** — ESG Buddy, lesson **Ask AI**, mock interviews. Open-ended, streaming,
  cheap-per-turn, "hand off to the right agent" (PRD §5.5).
- **Agentic** — the five paid agent families. **Guided form → run → reviewable output, not
  open-ended chat** (PRD §5.5), credit-metered, async, exports to Longsite Lite.

Three technologies combine, each owning exactly one layer — and crucially, **we do not stack
two agent runtimes**:

| Layer | Technology | Owns |
|---|---|---|
| **Generative UI** (all surfaces) | **Vercel AI SDK** | streaming chat, tool-call → React component rendering |
| **Agent runtime** (the 5 families) | **eve _or_ Claude Agent SDK** — decided at P2 | the agentic loop, tools, subagents |
| **Lifecycle & money** (ours) | **Next.js + Supabase** | credit hold/charge, "price before run" gate, run history, save-to-Longsite |

`eve` and the Claude Agent SDK are *both* full agent runtimes — they compete for the same job.
We pick one (§6); the AI SDK and app layers are unaffected by that choice, which makes it a
reversible, low-stakes decision deferred to the P2 "Agent runtime" epic.

---

## 2. The two AI surfaces

This framing drives everything below.

| | **Conversational** | **Agentic** |
|---|---|---|
| Examples | ESG Buddy, Ask AI (lesson), Mock interview | Communication, Doc Extraction, Planning, Data Analyst, Reports Producer |
| Interaction | open chat, multi-turn | one guided brief, one run |
| Latency | streaming, sub-second first token | seconds–minutes, async, reviewable |
| Billing | free w/ daily cap (PRD §6) | per-run credits, **priced before run** |
| Output | text + inline widgets | an artifact (dataset, chart, DOCX/PDF) saved or exported |
| Tech | AI SDK + Claude (no runtime needed) | AI SDK (UI) + agent runtime + app lifecycle |

P0/P1 ship the **Conversational** surface with no agent runtime at all. The runtime only
becomes necessary for the **Agentic** families at P2.

---

## 3. What `vercel/eve` is

`eve` is Vercel's **filesystem-first agent framework** (beta). An agent is conventional
folders rather than hand-wired library calls:

```
agent/
├── agent.ts          # model + runtime  →  defineAgent({ model: "anthropic/claude-sonnet-4.6" })
├── instructions.md   # system prompt (always on)
├── tools/            # typed functions the model can call
├── skills/           # procedures loaded on demand
├── channels/         # HTTP / Slack / Discord entry points
└── schedules/        # cron jobs
```

A tool is one file:

```ts
// agent/tools/extract-utility-bill.ts
import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description: "Extract energy line-items from a utility-bill PDF.",
  inputSchema: z.object({ fileUrl: z.string().url() }),
  async execute({ fileUrl }) {
    // reuse the ls-ingestion Claude pipeline here
    return { rows: [/* … */] };
  },
});
```

It runs on the AI SDK under the hood, defaults to Claude, and adds subagents and
human-in-the-loop. **Beta caveat:** APIs may shift; treat anything load-bearing for revenue
with care until it stabilises.

---

## 4. Layered architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Next.js 15 app  (prototype/)                                  │
│                                                                │
│  ┌── Generative UI  (Vercel AI SDK) ─────────────────────────┐ │
│  │  useChat / streamUI  ·  tool-call → React component        │ │
│  │  hand-off card · editable table · chart · doc preview      │ │
│  └────────────────────────────────────────────────────────────┘ │
│                         │  tool calls / run requests             │
│  ┌── Agent runtime  (eve OR Claude Agent SDK) ───────────────┐ │
│  │  agent loop · tools/ · skills/ · subagents · HITL          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                         │  deterministic tools                    │
│  ┌── App / data layer  (Supabase, ours) ─────────────────────┐ │
│  │  credit ledger · run lifecycle · run history · Longsite     │ │
│  │  tools wrap: calcEmission() · efdb · ls-ingestion · exports │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

**4.1 Generative UI (Vercel AI SDK) — the front, every surface.**
"Gen UI" in practice = tool calls that **render React components inline** instead of text.
The render function is keyed on the tool name:

```tsx
// pseudo — AI SDK message rendering
message.toolInvocations.map((t) => {
  switch (t.toolName) {
    case "suggestAgent":   return <AgentHandoffCard family={t.result.family} />; // ESG Buddy hand-off
    case "extractDoc":     return <EditableExtractionTable rows={t.result.rows} />;
    case "analyzeEmissions": return <EmissionsChart data={t.result.series} />;
    case "produceReport":  return <DocPreview href={t.result.href} />;
    default:               return <TextBubble>{t.result}</TextBubble>;
  }
});
```

This is literally PRD §5.5's "hand off to the right agent": ESG Buddy emits a
`suggestAgent` tool call and the user sees a button into the run flow, not a sentence.

**4.2 Agent runtime — the brains of the five families.** eve OR Claude Agent SDK (§6).
Either way the unit of work is a **tool**.

**4.3 App / data layer (ours, Supabase).** The credit ledger, the price-before-run gate,
run history, and saving outputs to Longsite Lite are app code wrapped *around* the runtime —
not part of it. The deterministic ESG math stays out of the model: `calcEmission()`, the
`efdb` factor DB, the `ls-ingestion` extraction pipeline, and the legacy
`react-pdf`/`docx`/`xlsx` exporters all become **tools** the runtime calls.

---

## 5. Run lifecycle (app-owned state machine)

The prototype's `/ai-hub/agents` "How it works" strip — *Brief it → See the price → Review →
Keep it* — is a state machine **we** own. The runtime only executes the `running` step.

```
drafting ─▶ priced ─▶ credits_held ─▶ running ─▶ review ─┬─▶ accepted ─▶ saved_to_longsite
   ▲           │            │            │               └─▶ discarded ─▶ credits_refunded?
   └───────────┴────────────┴────────────┘  (cancel paths)
```

- `priced` — estimate shown before any model call (PRD: "Credits shown before anything runs").
- `credits_held` — ledger hold; charge on `accepted`, release/refund policy on failure.
- `review` — output is editable before it counts (PRD: "Edit the output before accepting").
- `accepted` — write to Longsite dataset and/or export DOCX/PDF/XLSX; commit the charge.

---

## 6. Runtime decision: eve vs Claude Agent SDK

Recommendation: **run a one-week spike during P2.4** on a single real family
(**Document Extraction**, because it reuses `ls-ingestion`) and decide from evidence. The
AI SDK gen-UI layer and the app lifecycle are identical either way, so this is reversible.

| Criterion | `vercel/eve` | Claude Agent SDK |
|---|---|---|
| Maturity | **Beta** — API churn risk | Production-ready |
| Authoring DX | Filesystem-first; each family = a folder, tools = files | Library calls; tools defined in code |
| Subagents / HITL | Built-in | Built-in |
| MCP / tool ecosystem | Via AI SDK | First-class |
| Hosting / deploy | Vercel-native; `channels/` exposes HTTP | Embed in our Next.js API routes / a service |
| Scheduling | `schedules/` (cron) built in | We add cron/queue |
| Fit with existing stack | Runs on AI SDK + Claude | Same Claude models as `efdb`/`ls-ingestion` |
| Credit-metering / permission gating | We wrap around it | Permission/tool-gating hooks help |
| Risk for revenue path | Higher (beta) | Lower |

Default lean if we must choose today: **Claude Agent SDK** for the revenue-bearing families
(lower risk, matches the Claude stack), with **eve** kept as an attractive authoring layer to
adopt later if its folder model proves nicer. But the spike decides.

---

## 7. Per-family mapping

Families from `prototype/lib/data.ts` (`agentFamilies`):

| Family | Runtime tools | Gen-UI component |
|---|---|---|
| **Communication** | `draftEmail`, `lookupSupplier`, library RAG | editable draft card + tone controls |
| **Document Extraction** | `extractDoc` (wraps `ls-ingestion`) | editable table → "Push to dataset" |
| **Planning** | `buildPlan`, `createCalendarTasks` (writes Feed calendar) | timeline / task-list widget |
| **Data Analyst & Visualizer** | `queryWorkspace`, `calcEmission()`, `makeChart` | live chart + insight cards |
| **Reports Producer** | report builder wrapping `react-pdf` / `docx` / `xlsx` | doc preview + Export button |

`calcEmission()` and `efdb` factors are **tools**, never model arithmetic — deterministic
math stays verifiable and cheap.

---

## 8. Roadmap fit

| Phase | AI scope | Tech |
|---|---|---|
| **P0** (BUILD-PLAN P0.5/P0.6) | Ask AI (capped) + ESG Buddy (capped, hand-off suggestions only — agents are stubs) | **AI SDK + Claude only**; *optional* one `eve` spike agent, zero revenue risk |
| **P1** | ESG Buddy depth, library RAG | same |
| **P2** (P2.4) | **Commit to runtime** + first two families (Document Extraction, Reports Producer) | + chosen agent runtime + credit hold/run-history |
| **P3** | Remaining families; Planning → calendar; recurring runs | + `schedules/` (eve) or cron |

---

## 9. Open questions & risks

1. **eve beta churn** — pin versions; isolate behind our tool interfaces so a runtime swap is contained.
2. **Agent unit economics** (PRD risk #4) — model Claude cost per run vs. credit price before public pricing.
3. **Gen-UI streaming + credit hold UX** — when exactly the hold is placed vs. first token, and refund-on-failure policy.
4. **Where agent code lives** — in-repo `tools/` folders vs. a separate agent service; affects deploy and the eve-vs-SDK choice.
5. **RAG source of truth** — ESG Buddy must cite the content library (PRD §5.5); index strategy (pgvector, per §7) shared with search.

---

> Sourcing note: `eve` details are from its public README/docs and reflect a beta project —
> APIs may change. All Green Mentor Pro specifics are grounded in `PRD-GreenMentorPro.md`,
> `BUILD-PLAN-GreenMentorPro.md`, and the `prototype/` code.
