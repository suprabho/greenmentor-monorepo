// Client-safe artifact presentation helpers. Like lib/engagement-ui.ts, this must
// NOT import @gm/orchestrator (that pulls the service-role admin client + node
// modules into the browser). It only mirrors the artifact_type → label mapping.

import type { PhaseKey } from "@/lib/engagement-ui";

export type ArtifactStatus = "draft" | "final" | "superseded";

/** One artifact row as returned by GET /api/ai-hub/artifacts (enriched with client_name). */
export interface ArtifactRow {
  id: string;
  engagement_id: string;
  phase_key: PhaseKey;
  artifact_type: string;
  payload: unknown;
  confidence: number | null;
  status: ArtifactStatus;
  version: number;
  created_at: string;
  updated_at: string;
  client_name: string;
}

export const ARTIFACT_LABEL: Record<string, string> = {
  scope_plan: "Scope Plan",
  materiality_matrix: "Materiality Matrix",
  data_request_list: "Data Request List",
  dataset: "Dataset",
  validation_report: "Validation Report",
  calc_result: "Calculation Result",
  report_section: "Report Section",
  disclosure_draft: "Disclosure Draft",
};

/** Human label for an artifact, disambiguating the shared report_section type by phase. */
export function artifactLabel(type: string, phaseKey?: string): string {
  if (type === "report_section" && phaseKey === "publication") return "Final Report";
  return ARTIFACT_LABEL[type] ?? type.replace(/_/g, " ");
}

export const ARTIFACT_STATUS_TONE: Record<ArtifactStatus, "green" | "warn" | "neutral"> = {
  draft: "warn",
  final: "green",
  superseded: "neutral",
};

/** A short human summary of a heterogeneous artifact payload for card previews. */
export function artifactTldr(payload: unknown): string {
  if (payload == null) return "";
  if (typeof payload === "string") return payload.slice(0, 240);
  if (typeof payload === "number" || typeof payload === "boolean") return String(payload);
  if (Array.isArray(payload)) return `${payload.length} item${payload.length === 1 ? "" : "s"}`;
  if (typeof payload === "object") {
    const o = payload as Record<string, unknown>;
    for (const key of ["summary", "narrative", "overview", "description", "headline", "tldr", "title"]) {
      if (typeof o[key] === "string" && o[key]) return (o[key] as string).slice(0, 240);
    }
    const keys = Object.keys(o);
    if (keys.length === 0) return "Empty";
    return keys.slice(0, 6).map((k) => k.replace(/_/g, " ")).join(" · ");
  }
  return String(payload);
}

/** Relative "3d ago" formatter (client-side only). */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const s = Math.round((Date.now() - then) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.round(mo / 12)}y ago`;
}
