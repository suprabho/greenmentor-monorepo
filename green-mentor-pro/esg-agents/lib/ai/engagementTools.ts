import { tool } from "ai";
import { z } from "zod";
import { draftDataRequest } from "./tools";
import { PHASES, PHASE_ORDER, type PhaseKey } from "@/lib/orchestrator/pipeline";
import { isRunnable } from "@/lib/orchestrator/gates";
import { PHASE_ROWS } from "@/lib/demo/fixtures";
import { updateEngagement } from "@/lib/db/engagements";
import { getLatestArtifact, finalizePhaseArtifacts } from "@/lib/db/artifacts";
import { getPhaseStates, transitionPhase } from "@/lib/db/phases";
import { decidePhaseGate, countOpenFieldReviews } from "@/lib/db/reviews";
import { summarizeArtifact } from "@/lib/demo/phaseInputs";

export interface ToolCtx {
  orgId: string;
  engagementId: string;
  userUuid: string;
}

const LABEL = Object.fromEntries(PHASE_ROWS.map((r) => [r.key, r.label])) as Record<PhaseKey, string>;
const AGENT = Object.fromEntries(PHASE_ORDER.map((k) => [k, PHASES[k].agentKey])) as Record<PhaseKey, string>;
const phaseEnum = z.enum(PHASE_ORDER as [string, ...string[]]);

/**
 * Tools bound to one engagement/session. Fast tools mutate the SAME Supabase state
 * the board uses (so a refresh keeps both surfaces in lockstep); the runPhase tool is
 * read-only (confirm-then-dispatch) — the actual run goes through the run route from a
 * chat card, because a phase run far exceeds the chat stream budget.
 */
export function buildEngagementTools(ctx: ToolCtx) {
  return {
    draftDataRequest,

    captureRequirements: tool({
      description:
        "Record or update the engagement's reporting requirements (client/entity name, sector, frameworks, reporting year, sites, material topics, brief). Call this whenever the user states or refines these.",
      inputSchema: z.object({
        client_name: z.string().nullish(),
        sector: z.string().nullish(),
        frameworks: z.array(z.string()).nullish().describe("e.g. ['BRSR','GRI']"),
        reporting_year: z.string().nullish().describe("e.g. 'FY2025-26'"),
        sites: z.array(z.string()).nullish(),
        material_topics: z.array(z.string()).nullish(),
        brief: z.string().nullish(),
      }),
      execute: async (input) => {
        const configPatch: Record<string, unknown> = {};
        if (input.sector != null) configPatch.sector = input.sector;
        if (input.sites != null) configPatch.sites = input.sites;
        if (input.material_topics != null) configPatch.material_topics = input.material_topics;
        if (input.brief != null) configPatch.brief = input.brief;
        if (input.frameworks != null) configPatch.frameworks = input.frameworks;
        const eng = await updateEngagement(ctx.orgId, ctx.engagementId, {
          clientName: input.client_name ?? undefined,
          financialYear: input.reporting_year ?? undefined,
          framework: input.frameworks ?? undefined,
          configPatch,
        });
        return { ok: true, client: eng.client_name, financial_year: eng.financial_year, frameworks: eng.framework };
      },
    }),

    showArtifact: tool({
      description: "Summarize the latest artifact a phase produced (e.g. materiality, calculation, report drafting).",
      inputSchema: z.object({ phase_key: phaseEnum }),
      execute: async (input) => {
        const phase = input.phase_key as PhaseKey;
        const a = await getLatestArtifact(ctx.orgId, ctx.engagementId, phase);
        if (!a) return { found: false, phase: LABEL[phase] };
        return { found: true, phase: LABEL[phase], status: a.status, summary: summarizeArtifact(phase, a.payload) };
      },
    }),

    approvePhase: tool({
      description: "Approve a phase's human gate so the next phase becomes runnable. Only when the user confirms the output looks right.",
      inputSchema: z.object({ phase_key: phaseEnum }),
      execute: async (input) => {
        const phase = input.phase_key as PhaseKey;
        if (phase === "data_collection") {
          const open = await countOpenFieldReviews(ctx.orgId, ctx.engagementId);
          if (open > 0) return { ok: false, error: `${open} data row(s) still need review on the board.` };
        }
        const moved = await transitionPhase(ctx.orgId, ctx.engagementId, phase, ["awaiting_human_review", "changes_requested"], "complete");
        if (!moved) return { ok: false, error: "Phase wasn't awaiting review (already actioned)." };
        await finalizePhaseArtifacts(ctx.orgId, ctx.engagementId, phase);
        await decidePhaseGate(ctx.orgId, ctx.engagementId, phase, "approved", { reviewedBy: ctx.userUuid });
        return { ok: true, approved: LABEL[phase] };
      },
    }),

    requestChanges: tool({
      description: "Send a phase back for changes (it becomes re-runnable). Provide the reason.",
      inputSchema: z.object({ phase_key: phaseEnum, feedback: z.string().nullish() }),
      execute: async (input) => {
        const phase = input.phase_key as PhaseKey;
        const moved = await transitionPhase(ctx.orgId, ctx.engagementId, phase, ["awaiting_human_review"], "changes_requested");
        if (!moved) return { ok: false, error: "Phase wasn't awaiting review." };
        await decidePhaseGate(ctx.orgId, ctx.engagementId, phase, "rejected", { reviewedBy: ctx.userUuid, feedback: input.feedback ?? null });
        return { ok: true, sent_back: LABEL[phase] };
      },
    }),

    runPhase: tool({
      description:
        "Offer to run a pipeline phase. This does NOT run it directly — it returns a confirmation card the user clicks to start the (long-running) agent. Use for the next runnable phase.",
      inputSchema: z.object({ phase_key: phaseEnum }),
      execute: async (input) => {
        const phase = input.phase_key as PhaseKey;
        const states = await getPhaseStates(ctx.orgId, ctx.engagementId);
        const runnable = isRunnable(phase, states);
        return {
          phase_key: phase,
          agent_key: AGENT[phase],
          label: LABEL[phase],
          runnable,
          reason: runnable ? null : "Its prior phase must be approved first.",
        };
      },
    }),
  };
}
