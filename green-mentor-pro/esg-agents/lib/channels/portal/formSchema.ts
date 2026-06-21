import type { SupabaseClient } from "@supabase/supabase-js";
import type { FormSchema, FormField } from "../types";

/**
 * Build a portal FormSchema directly from a data_request_list row. The request's
 * unit / granularity / evidence_required / quality_params become typed fields +
 * file dropzones. Select fields are enum-constrained to platform dropdowns
 * (ls-ingestion rule).
 */
export interface DataRequestRow {
  request_id: string;
  label: string;
  unit?: string;
  evidence_required?: string[];
  quality_params?: { expected_min?: number; required?: boolean };
  enum_fields?: { name: string; label: string; values: string[] }[];
}

export function buildFormSchema(req: DataRequestRow): FormSchema {
  const fields: FormField[] = [
    {
      type: "number",
      name: "value",
      label: req.unit ? `${req.label} (${req.unit})` : req.label,
      unit: req.unit,
      min: req.quality_params?.expected_min ?? 0,
      required: req.quality_params?.required ?? true,
    },
    { type: "text", name: "period_label", label: "Period covered", required: true },
  ];

  for (const ef of req.enum_fields ?? []) {
    fields.push({ type: "select", name: ef.name, label: ef.label, enum: ef.values, required: true });
  }

  const accept = (req.evidence_required?.length ? req.evidence_required : ["pdf", "xlsx", "csv", "png", "jpg"]).map(
    (e) => e.replace(/[^a-z0-9]/gi, "").toLowerCase(),
  );
  fields.push({ type: "file", name: "evidence", label: "Supporting evidence", accept, multiple: true, required: true });
  fields.push({ type: "text", name: "notes", label: "Notes (optional)", required: false });

  return { requestId: req.request_id, title: req.label, fields };
}

export async function formSchemaFromDb(
  requestId: string,
  supabase: SupabaseClient,
): Promise<FormSchema | null> {
  const { data, error } = await supabase
    .from("esg_data_requests")
    .select("id, metric, unit")
    .eq("id", requestId)
    .single();
  if (error || !data) return null;
  return buildFormSchema({ request_id: data.id, label: data.metric, unit: data.unit ?? undefined });
}
