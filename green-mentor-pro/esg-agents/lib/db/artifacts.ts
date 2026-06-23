import { createAdminClient } from "@/lib/supabase/admin";
import type { PhaseKey, ArtifactType } from "@/lib/orchestrator/pipeline";
import type { EsgArtifact, Json } from "./types";

const NON_SUPERSEDED = ["draft", "final"];

/** Latest non-superseded artifact for a phase (newest version). */
export async function getLatestArtifact(
  orgId: string,
  engagementId: string,
  phaseKey: PhaseKey,
): Promise<EsgArtifact | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("esg_artifacts")
    .select("*")
    .eq("org_id", orgId)
    .eq("engagement_id", engagementId)
    .eq("phase_key", phaseKey)
    .in("status", NON_SUPERSEDED)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getLatestArtifact: ${error.message}`);
  return (data as EsgArtifact) ?? null;
}

/** Latest non-superseded artifact for each of several phases, keyed by phase_key. */
export async function getArtifactsForPhases(
  orgId: string,
  engagementId: string,
  phaseKeys: PhaseKey[],
): Promise<Partial<Record<PhaseKey, EsgArtifact>>> {
  if (phaseKeys.length === 0) return {};
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("esg_artifacts")
    .select("*")
    .eq("org_id", orgId)
    .eq("engagement_id", engagementId)
    .in("phase_key", phaseKeys)
    .in("status", NON_SUPERSEDED)
    .order("version", { ascending: false });
  if (error) throw new Error(`getArtifactsForPhases: ${error.message}`);
  const out: Partial<Record<PhaseKey, EsgArtifact>> = {};
  for (const row of (data ?? []) as EsgArtifact[]) {
    // rows are version-desc, so the first seen per phase is the latest
    if (!out[row.phase_key]) out[row.phase_key] = row;
  }
  return out;
}

/**
 * Insert a new artifact, superseding any existing draft for the same
 * (engagement, phase, artifact_type) and bumping the version. Re-running a phase
 * keeps history (old rows → 'superseded') and always leaves exactly one draft.
 */
export async function supersedeAndInsert(
  orgId: string,
  args: {
    engagementId: string;
    phaseKey: PhaseKey;
    artifactType: ArtifactType;
    payload: Json;
    confidence?: number | null;
    provenance?: Json;
    createdByRun?: string | null;
  },
): Promise<EsgArtifact> {
  const admin = createAdminClient();

  const { data: prev } = await admin
    .from("esg_artifacts")
    .select("version")
    .eq("org_id", orgId)
    .eq("engagement_id", args.engagementId)
    .eq("phase_key", args.phaseKey)
    .eq("artifact_type", args.artifactType)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = ((prev?.version as number) ?? 0) + 1;

  if (prev) {
    await admin
      .from("esg_artifacts")
      .update({ status: "superseded" })
      .eq("org_id", orgId)
      .eq("engagement_id", args.engagementId)
      .eq("phase_key", args.phaseKey)
      .eq("artifact_type", args.artifactType)
      .eq("status", "draft");
  }

  const { data, error } = await admin
    .from("esg_artifacts")
    .insert({
      org_id: orgId,
      engagement_id: args.engagementId,
      phase_key: args.phaseKey,
      artifact_type: args.artifactType,
      payload: args.payload,
      confidence: args.confidence ?? null,
      provenance: args.provenance ?? null,
      status: "draft",
      version: nextVersion,
      created_by_run: args.createdByRun ?? null,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(`supersedeAndInsert: ${error?.message ?? "no row"}`);
  return data as EsgArtifact;
}

/** Mark an artifact final (on phase approval). */
export async function finalizeArtifact(orgId: string, artifactId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("esg_artifacts")
    .update({ status: "final" })
    .eq("org_id", orgId)
    .eq("id", artifactId);
  if (error) throw new Error(`finalizeArtifact: ${error.message}`);
}

/** Mark every draft artifact for a phase final (phase may emit >1 artifact row). */
export async function finalizePhaseArtifacts(
  orgId: string,
  engagementId: string,
  phaseKey: PhaseKey,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("esg_artifacts")
    .update({ status: "final" })
    .eq("org_id", orgId)
    .eq("engagement_id", engagementId)
    .eq("phase_key", phaseKey)
    .eq("status", "draft");
  if (error) throw new Error(`finalizePhaseArtifacts: ${error.message}`);
}
