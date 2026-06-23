import { createAdminClient } from "@/lib/supabase/admin";
import type { PhaseKey } from "@/lib/orchestrator/pipeline";
import type { EsgAgentRun, Json } from "./types";

/** Open a run row (status 'running'). The phase status / current_run_id is set by the caller. */
export async function createRun(
  orgId: string,
  args: {
    engagementId: string;
    phaseKey: PhaseKey;
    family: string;
    agentKey: string;
    input: Json;
    model: string;
    promptVersion?: string | null;
    promptVariant?: string | null;
    requestedBy?: string | null;
  },
): Promise<EsgAgentRun> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("esg_agent_runs")
    .insert({
      org_id: orgId,
      engagement_id: args.engagementId,
      phase_key: args.phaseKey,
      family: args.family,
      agent_key: args.agentKey,
      input: args.input,
      status: "running",
      model: args.model,
      prompt_version: args.promptVersion ?? null,
      prompt_variant: args.promptVariant ?? "control",
      requested_by: args.requestedBy ?? null,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(`createRun: ${error?.message ?? "no row"}`);
  return data as EsgAgentRun;
}

export async function completeRun(
  orgId: string,
  runId: string,
  args: {
    output: Json;
    confidence?: number | null;
    inputTokens?: number | null;
    outputTokens?: number | null;
    model?: string;
  },
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("esg_agent_runs")
    .update({
      status: "succeeded",
      output: args.output,
      confidence: args.confidence ?? null,
      input_tokens: args.inputTokens ?? null,
      output_tokens: args.outputTokens ?? null,
      ...(args.model ? { model: args.model } : {}),
    })
    .eq("org_id", orgId)
    .eq("id", runId);
  if (error) throw new Error(`completeRun: ${error.message}`);
}

export async function failRun(orgId: string, runId: string, error: Json): Promise<void> {
  const admin = createAdminClient();
  const { error: e } = await admin
    .from("esg_agent_runs")
    .update({ status: "failed", error })
    .eq("org_id", orgId)
    .eq("id", runId);
  if (e) throw new Error(`failRun: ${e.message}`);
}
