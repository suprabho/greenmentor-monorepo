import { NextResponse } from "next/server";
import { createAdminClient, listEngagements } from "@gm/orchestrator";
import { getEngagementContext } from "@/lib/engagement-session";
import { jsonError } from "@/lib/api-error";

export const runtime = "nodejs";

const COLUMNS = "id, engagement_id, phase_key, artifact_type, payload, confidence, status, version, created_at, updated_at";

/**
 * GET /api/ai-hub/artifacts — cross-engagement artifact list for the Artifacts
 * gallery, org-scoped. Excludes superseded rows by default so re-runs don't
 * pollute the grid. `?artifactId=` returns a single row for the detail view.
 * There's no cross-engagement artifact query in @gm/orchestrator, so we read
 * esg_artifacts directly via the same service-role admin client lib/tenancy uses.
 */
export async function GET(req: Request) {
  try {
    const ctx = await getEngagementContext();
    if (!ctx) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

    const artifactId = new URL(req.url).searchParams.get("artifactId");
    const admin = createAdminClient();

    let query = admin.from("esg_artifacts").select(COLUMNS).eq("org_id", ctx.orgId);
    if (artifactId) {
      query = query.eq("id", artifactId);
    } else {
      query = query.in("status", ["draft", "final"]).order("updated_at", { ascending: false });
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Enrich with client_name (small N — one list read, mapped in memory).
    const engagements = await listEngagements(ctx.orgId);
    const nameById = new Map(engagements.map((e) => [e.id, e.client_name]));
    const artifacts = (data ?? []).map((a) => ({
      ...a,
      client_name: nameById.get(a.engagement_id as string) ?? "Engagement",
    }));

    return NextResponse.json({ artifacts });
  } catch (e) {
    return jsonError(e);
  }
}
