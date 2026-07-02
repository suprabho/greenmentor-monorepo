import { tool } from "ai";
import { z } from "zod";
import { draftDataRequest } from "@gm/agents";
import { PHASES, PHASE_ORDER, type PhaseKey } from "./orchestrator/pipeline";
import { isRunnable } from "./orchestrator/gates";
import { PHASE_ROWS } from "./demo/fixtures";
import { updateEngagement } from "./db/engagements";
import { getLatestArtifact, finalizePhaseArtifacts } from "./db/artifacts";
import { getPhaseStates, transitionPhase } from "./db/phases";
import {
  decidePhaseGate, countOpenFieldReviews,
  listOpenQuestions, resolveOpenQuestion, countOpenQuestions,
} from "./db/reviews";
import { summarizeArtifact } from "./demo/phaseInputs";

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

    answerScopeQuestion: tool({
      description:
        "Answer or waive ONE of the engagement's open kickoff scope questions on the user's behalf. Use whenever the user's message supplies the answer to a question listed under 'Open scope questions' in your context — pass the matching `question_id` and the `answer`, or `waived: true` if the user says it doesn't apply. Resolve one question per call; call again for each answer given. Never invent an answer the user didn't provide. These same questions are shown as a card in the chat, so answering here keeps both in sync.",
      inputSchema: z.object({
        question_id: z.string().describe("The id of the scope question being resolved, from the 'Open scope questions' list in your context."),
        answer: z.string().nullish().describe("The user's answer. Omit when waiving."),
        waived: z.boolean().nullish().describe("Set true to skip a question the user says is not applicable."),
      }),
      execute: async (input) => {
        if (input.waived !== true && !input.answer?.trim()) {
          return { ok: false, error: "Provide an answer or set waived: true." };
        }
        const open = await listOpenQuestions(ctx.orgId, ctx.engagementId);
        const match = open.find((q) => q.id === input.question_id);
        if (!match) return { ok: false, error: "Unknown question_id — use one from the Open scope questions list." };
        if (match.status !== "submitted") return { ok: false, error: "That question is already answered or waived." };
        await resolveOpenQuestion(ctx.orgId, input.question_id, {
          answer: input.answer ?? null,
          waived: input.waived === true,
          reviewedBy: ctx.userUuid,
        });
        const remaining = await countOpenQuestions(ctx.orgId, ctx.engagementId);
        return {
          ok: true,
          resolved: match.question,
          waived: input.waived === true,
          remaining_open: remaining,
          hint: remaining === 0 ? "All scope questions resolved — offer to Apply & re-run kickoff." : null,
        };
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
