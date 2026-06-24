import { PHASES, PHASE_ORDER, type PhaseKey } from "./pipeline";
import { isRunnable } from "./gates";
import { assemblePhaseInput } from "./assembleInput";
import { loadAgent } from "@/lib/agents/loadAgent";
import { runAgent } from "@/lib/agents/runAgent";
import { getEngagement } from "@/lib/db/engagements";
import { getPhaseStates, setPhaseStatus, transitionPhase, cascadeStaleDownstream } from "@/lib/db/phases";
import { getArtifactsForPhases, supersedeAndInsert } from "@/lib/db/artifacts";
import { createRun, completeRun, failRun } from "@/lib/db/runs";
import { openPhaseGate, fanoutFieldReviews } from "@/lib/db/reviews";
import { insertValidations } from "@/lib/db/validations";
import { PHASE_PRIMARY_ARTIFACT, type Json } from "@/lib/db/types";

export class PhaseNotRunnableError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "PhaseNotRunnableError";
  }
}

export interface RunPhaseResult {
  runId: string;
  artifactId: string;
  phaseKey: PhaseKey;
  status: "awaiting_human_review";
  confidence: number | null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Best-effort numeric confidence for the run (min of per-row confidence for datasets). */
function deriveConfidence(phaseKey: PhaseKey, output: any): number | null {
  const SCORE: Record<string, number> = { high: 0.9, medium: 0.6, low: 0.3 };
  if (phaseKey === "data_collection" && Array.isArray(output?.dataset_rows)) {
    const scores = output.dataset_rows
      .map((r: any) => SCORE[r.overall_confidence as string])
      .filter((n: number) => Number.isFinite(n));
    return scores.length ? Math.min(...scores) : null;
  }
  if (typeof output?.data_quality_score === "number") return Math.max(0, Math.min(1, output.data_quality_score / 100));
  if (typeof output?.confidence === "number") return output.confidence;
  return null;
}

/**
 * Run one phase end-to-end and persist everything: guard runnability + double-runs,
 * assemble input from prior artifacts, call the agent, store the artifact + validations
 * + open the human gate, and leave the phase awaiting_human_review. Throws
 * PhaseNotRunnableError (→ 409) when deps aren't complete or a run is already in flight.
 */
export async function runPhase(
  orgId: string,
  engagementId: string,
  phaseKey: PhaseKey,
  userUuid: string | null,
): Promise<RunPhaseResult> {
  const engagement = await getEngagement(orgId, engagementId);
  if (!engagement) throw new PhaseNotRunnableError("engagement not found");

  const states = await getPhaseStates(orgId, engagementId);
  if (!isRunnable(phaseKey, states)) {
    throw new PhaseNotRunnableError(
      `Phase "${phaseKey}" is not runnable — its dependencies must be approved and it must be idle.`,
    );
  }

  // Double-run / concurrency guard: only one transition from idle → agent_running wins.
  // `failed` is included so an errored phase can be retried.
  const grabbed = await transitionPhase(orgId, engagementId, phaseKey, ["not_started", "changes_requested", "failed"], "agent_running");
  if (!grabbed) throw new PhaseNotRunnableError(`Phase "${phaseKey}" is already running.`);

  const def = PHASES[phaseKey];
  const agent = loadAgent(def.agentKey);

  // Assemble input from prior artifacts (one read of all phases' latest artifacts).
  const upstream = await getArtifactsForPhases(orgId, engagementId, PHASE_ORDER);
  const { input, sourceArtifactIds } = assemblePhaseInput(phaseKey, engagement, upstream);

  const run = await createRun(orgId, {
    engagementId, phaseKey,
    family: agent.family,
    agentKey: agent.name,
    input: input as Json,
    model: agent.model,
    promptVersion: agent.version,
    promptVariant: agent.promptVariant,
    requestedBy: userUuid,
  });
  await setPhaseStatus(orgId, engagementId, phaseKey, "agent_running", { currentRunId: run.id });

  try {
    const result = await runAgent<unknown, any>(agent, input, {
      orgId, engagementId, financialYear: engagement.financial_year,
    });
    const output = result.output;
    const confidence = deriveConfidence(phaseKey, output);

    const artifact = await supersedeAndInsert(orgId, {
      engagementId, phaseKey,
      artifactType: PHASE_PRIMARY_ARTIFACT[phaseKey],
      payload: output as Json,
      confidence,
      provenance: { run_id: run.id, source_artifact_ids: sourceArtifactIds } as Json,
      createdByRun: run.id,
    });

    // Phase-specific side effects.
    if (phaseKey === "data_validation") {
      await insertValidations(orgId, { engagementId, artifactId: artifact.id, validationOutput: output });
    }
    if (phaseKey === "data_collection") {
      await fanoutFieldReviews(orgId, { engagementId, runId: run.id, datasetOutput: output, requestedBy: userUuid });
    }
    // Open the human gate (one phase_summary row per phase).
    await openPhaseGate(orgId, {
      engagementId, phaseKey, runId: run.id, subjectId: artifact.id,
      item: `${def.phaseNo}. ${def.agentKey} output`,
      confidence, requestedBy: userUuid,
    });

    await completeRun(orgId, run.id, {
      output: output as Json,
      confidence,
      inputTokens: result.raw.usage?.input_tokens ?? null,
      outputTokens: result.raw.usage?.output_tokens ?? null,
      model: result.meta.model,
    });
    await setPhaseStatus(orgId, engagementId, phaseKey, "awaiting_human_review");
    // Re-running invalidates any stale downstream phases (no-op on a first run).
    await cascadeStaleDownstream(orgId, engagementId, phaseKey).catch(() => {});

    return { runId: run.id, artifactId: artifact.id, phaseKey, status: "awaiting_human_review", confidence };
  } catch (e) {
    const raw = e instanceof Error ? e.message : "agent run failed";
    await failRun(orgId, run.id, { message: raw } as Json).catch(() => {});
    await setPhaseStatus(orgId, engagementId, phaseKey, "failed").catch(() => {});
    // Surface a clean, actionable message for transient Anthropic server errors
    // (overloaded 529, 5xx api_error, rate limits) instead of raw JSON.
    const transient = /overloaded|529|\b5\d\d\b|api_error|internal server error|\b429\b|rate[ _-]?limit/i.test(raw);
    throw new Error(
      transient
        ? "The AI service (Anthropic) is temporarily unavailable. The phase was marked failed — retry in a moment."
        : raw,
    );
  }
}
