import { createAdminClient } from "../admin";
import type { Json } from "./types";
import { getLatestArtifact } from "./artifacts";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface DataRequestInput {
  materialTopic: string;
  disclosureCode?: string | null;
  metric: string;
  unit?: string | null;
  ownerEmail?: string | null;
  channel?: "web_portal" | "bulk_upload" | "whatsapp" | "email";
  dueDate?: string | null;
}

export async function insertDataRequests(
  orgId: string,
  engagementId: string,
  requests: DataRequestInput[],
): Promise<number> {
  if (requests.length === 0) return 0;
  const admin = createAdminClient();
  const rows = requests.map((r) => ({
    org_id: orgId,
    engagement_id: engagementId,
    material_topic: r.materialTopic,
    disclosure_code: r.disclosureCode ?? null,
    metric: r.metric,
    unit: r.unit ?? null,
    owner_email: r.ownerEmail ?? null,
    channel: r.channel ?? "web_portal",
    due_date: r.dueDate ?? null,
    status: "requested",
  }));
  const { error } = await admin.from("esg_data_requests").insert(rows);
  if (error) throw new Error(`insertDataRequests: ${error.message}`);
  return rows.length;
}

export async function listDataRequests(orgId: string, engagementId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("esg_data_requests")
    .select("*")
    .eq("org_id", orgId)
    .eq("engagement_id", engagementId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`listDataRequests: ${error.message}`);
  return data ?? [];
}

/** Find or create the catch-all "Uploaded document" data request for ad-hoc evidence. */
export async function getOrCreateUploadRequest(orgId: string, engagementId: string): Promise<string> {
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("esg_data_requests")
    .select("id")
    .eq("org_id", orgId)
    .eq("engagement_id", engagementId)
    .eq("metric", "Uploaded document")
    .limit(1)
    .maybeSingle();
  if (existing) return existing.id as string;
  const { data, error } = await admin
    .from("esg_data_requests")
    .insert({
      org_id: orgId, engagement_id: engagementId, material_topic: "ad-hoc",
      metric: "Uploaded document", channel: "bulk_upload", status: "received",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`getOrCreateUploadRequest: ${error?.message ?? "no row"}`);
  return data.id as string;
}

/** Record an uploaded document (evidence) against a data request (Workstream D upload). */
export async function insertSubmission(
  orgId: string,
  args: {
    dataRequestId: string;
    storagePath: string;
    channel?: string;
    extracted?: Json;
    confidence?: number | null;
    submittedBy?: string | null;
  },
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("esg_data_submissions").insert({
    org_id: orgId,
    data_request_id: args.dataRequestId,
    channel: args.channel ?? "bulk_upload",
    storage_path: args.storagePath,
    extracted: args.extracted ?? null,
    confidence: args.confidence ?? null,
    submitted_by: args.submittedBy ?? null,
  });
  if (error) throw new Error(`insertSubmission: ${error.message}`);
}

/**
 * Query the collected dataset rows for an engagement (latest 'dataset' artifact),
 * optionally filtered by metric codes / site ids. Backs the query_workspace_dataset
 * tool so agents can read prior-collected data, tenant-scoped via ctx.orgId.
 */
export async function queryDataset(
  orgId: string,
  engagementId: string,
  filter: { metricCodes?: string[]; siteIds?: string[] } = {},
): Promise<{ rows: any[]; count: number }> {
  const artifact = await getLatestArtifact(orgId, engagementId, "data_collection");
  const allRows = ((artifact?.payload as { dataset_rows?: any[] })?.dataset_rows ?? []) as any[];
  const metricSet = filter.metricCodes?.length ? new Set(filter.metricCodes) : null;
  const siteSet = filter.siteIds?.length ? new Set(filter.siteIds) : null;
  const rows = allRows.filter(
    (r) => (!metricSet || metricSet.has(r.metric_code)) && (!siteSet || siteSet.has(r.site_id)),
  );
  return { rows, count: rows.length };
}
