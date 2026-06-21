import type { SupabaseClient } from "@supabase/supabase-js";

export type ChannelKey = "portal" | "upload" | "whatsapp" | "email";

export interface IncomingFile {
  storagePath: string;
  filename: string;
  mime: string;
  bytes: number;
  docTypeHint?: string;
}

export interface IncomingPayload {
  engagementId: string;
  orgId: string;
  requestId?: string; // present when tied to a specific data_request
  siteId?: string;
  periodLabel?: string;
  formValues?: Record<string, unknown>;
  files: IncomingFile[]; // already in Supabase Storage
  meta?: Record<string, unknown>;
}

export interface IngestResult {
  submissionId: string;
  channel: ChannelKey;
  extractionsQueued: { fileId: string; targetTool: "extract_document" | "extract_bill_vision" }[];
  receipt: { status: "received" | "rejected"; reason?: string };
}

export type FormField =
  | { type: "number"; name: string; label: string; unit?: string; min?: number; required: boolean }
  | { type: "select"; name: string; label: string; enum: string[]; required: boolean } // ls-ingestion: values constrained to platform enums
  | { type: "text"; name: string; label: string; required: boolean }
  | { type: "file"; name: string; label: string; accept: string[]; multiple: boolean; required: boolean };

export interface FormSchema {
  requestId: string;
  title: string;
  fields: FormField[];
}

/** The contract every channel implements. New channels = new file, no core edits. */
export interface ChannelAdapter {
  readonly key: ChannelKey;
  readonly enabled: boolean;
  /** Normalize a channel-specific payload into data_submissions + queued extractions. */
  ingest(payload: IncomingPayload, supabase: SupabaseClient): Promise<IngestResult>;
  /** Portal/upload build a FormSchema from a data_request; messaging channels return null. */
  formSchemaFor?(requestId: string, supabase: SupabaseClient): Promise<FormSchema | null>;
}
