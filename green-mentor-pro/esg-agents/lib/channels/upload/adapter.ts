import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChannelAdapter, IncomingPayload, IngestResult } from "../types";

/**
 * Bulk upload channel: a multi-file drop NOT tied to one request. Writes one
 * data_submissions row per file and queues vision/doc extraction. The Phase-4
 * data-collection agent's `classify_submission` back-maps each file to a request_id
 * after extraction.
 */
export const uploadAdapter: ChannelAdapter = {
  key: "upload",
  enabled: true,

  async ingest(payload: IncomingPayload, supabase: SupabaseClient): Promise<IngestResult> {
    const rows = payload.files.map((f) => ({
      org_id: payload.orgId,
      data_request_id: payload.requestId ?? null, // may be null for bulk drop
      channel: "bulk_upload",
      storage_path: f.storagePath,
    }));
    const { data, error } = await supabase.from("esg_data_submissions").insert(rows).select("id");
    if (error) throw new Error(`upload ingest failed: ${error.message}`);

    return {
      submissionId: data?.[0]?.id ?? "",
      channel: "upload",
      extractionsQueued: payload.files.map((f) => ({
        fileId: f.storagePath,
        targetTool: f.mime.includes("pdf") || f.mime.startsWith("image/") ? "extract_bill_vision" : "extract_document",
      })),
      receipt: { status: "received" },
    };
  },
};
