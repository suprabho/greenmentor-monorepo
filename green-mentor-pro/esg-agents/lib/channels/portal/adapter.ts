import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChannelAdapter, IncomingPayload, IngestResult } from "../types";
import { formSchemaFromDb } from "./formSchema";

/**
 * Portal channel: form-schema-driven uploader tied to a specific data_request.
 * ingest() inserts a data_submissions row and queues each file for extraction by
 * the Phase-4 data-collection agent.
 */
export const portalAdapter: ChannelAdapter = {
  key: "portal",
  enabled: true,

  async ingest(payload: IncomingPayload, supabase: SupabaseClient): Promise<IngestResult> {
    const { data, error } = await supabase
      .from("esg_data_submissions")
      .insert({
        org_id: payload.orgId,
        data_request_id: payload.requestId,
        channel: "web_portal",
        storage_path: payload.files[0]?.storagePath ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(`portal ingest failed: ${error.message}`);

    return {
      submissionId: data.id,
      channel: "portal",
      extractionsQueued: payload.files.map((f) => ({
        fileId: f.storagePath,
        targetTool: f.mime.includes("pdf") || f.mime.startsWith("image/") ? "extract_bill_vision" : "extract_document",
      })),
      receipt: { status: "received" },
    };
  },

  formSchemaFor(requestId, supabase) {
    return formSchemaFromDb(requestId, supabase);
  },
};
