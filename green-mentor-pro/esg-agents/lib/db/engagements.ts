import { createAdminClient } from "@/lib/supabase/admin";
import { PHASES, PHASE_ORDER, type PhaseKey } from "@/lib/orchestrator/pipeline";
import type { EsgEngagement, EsgArtifact } from "./types";
import { listPhases } from "./phases";
import { getArtifactsForPhases } from "./artifacts";
import type { EsgPhase } from "./types";

export interface CreateEngagementArgs {
  clientName: string;
  financialYear: string;
  framework?: string[];
  config?: Record<string, unknown>;
  createdBy: string; // session.userUuid (created_by is NOT NULL; no auth.uid() under service role)
}

/** Create an engagement and seed its 8 phase rows from the pipeline definition. */
export async function createEngagement(orgId: string, args: CreateEngagementArgs): Promise<EsgEngagement> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("esg_engagements")
    .insert({
      org_id: orgId,
      client_name: args.clientName,
      financial_year: args.financialYear,
      framework: args.framework ?? ["BRSR"],
      status: "active",
      config: args.config ?? {},
      created_by: args.createdBy,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(`createEngagement: ${error?.message ?? "no row"}`);
  const engagement = data as EsgEngagement;

  const phaseRows = PHASE_ORDER.map((k) => ({
    org_id: orgId,
    engagement_id: engagement.id,
    phase_key: k,
    phase_no: PHASES[k].phaseNo,
    status: "not_started",
    agent_family: PHASES[k].agentKey,
  }));
  const { error: pErr } = await admin.from("esg_engagement_phases").insert(phaseRows);
  if (pErr) throw new Error(`createEngagement (phases): ${pErr.message}`);

  return engagement;
}

/** Patch an engagement's columns and/or merge into its config jsonb. */
export async function updateEngagement(
  orgId: string,
  engagementId: string,
  patch: {
    clientName?: string;
    financialYear?: string;
    framework?: string[];
    configPatch?: Record<string, unknown>;
  },
): Promise<EsgEngagement> {
  const admin = createAdminClient();
  const current = await getEngagement(orgId, engagementId);
  if (!current) throw new Error("updateEngagement: engagement not found");

  const update: Record<string, unknown> = {};
  if (patch.clientName) update.client_name = patch.clientName;
  if (patch.financialYear) update.financial_year = patch.financialYear;
  if (patch.framework?.length) update.framework = patch.framework;
  if (patch.configPatch) update.config = { ...(current.config ?? {}), ...patch.configPatch };

  const { data, error } = await admin
    .from("esg_engagements")
    .update(update)
    .eq("org_id", orgId)
    .eq("id", engagementId)
    .select("*")
    .single();
  if (error || !data) throw new Error(`updateEngagement: ${error?.message ?? "no row"}`);
  return data as EsgEngagement;
}

export async function listEngagements(orgId: string): Promise<EsgEngagement[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("esg_engagements")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listEngagements: ${error.message}`);
  return (data ?? []) as EsgEngagement[];
}

export async function getEngagement(orgId: string, engagementId: string): Promise<EsgEngagement | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("esg_engagements")
    .select("*")
    .eq("org_id", orgId)
    .eq("id", engagementId)
    .maybeSingle();
  if (error) throw new Error(`getEngagement: ${error.message}`);
  return (data as EsgEngagement) ?? null;
}

export interface EngagementSnapshot {
  engagement: EsgEngagement;
  phases: EsgPhase[];
  artifactByPhase: Partial<Record<PhaseKey, EsgArtifact>>;
}

/** One composite read for the board: engagement + phase states + latest artifacts. */
export async function getEngagementSnapshot(
  orgId: string,
  engagementId: string,
): Promise<EngagementSnapshot | null> {
  const engagement = await getEngagement(orgId, engagementId);
  if (!engagement) return null;
  const [phases, artifactByPhase] = await Promise.all([
    listPhases(orgId, engagementId),
    getArtifactsForPhases(orgId, engagementId, PHASE_ORDER),
  ]);
  return { engagement, phases, artifactByPhase };
}
