/**
 * Shared inline-style design tokens for the stage views AND the two pipeline boards.
 * Plain .ts (no "use client") so it can be imported from client and server components.
 * Single source for the palette that was previously duplicated in PipelineBoard.tsx
 * and EngagementBoard.tsx.
 */
import type { CSSProperties } from "react";

export const ACCENT = "#1f8a5b";

export const C = {
  bg: "#f6f8f7",
  card: "#ffffff",
  border: "#e3e8e5",
  text: "#1a2420",
  sub: "#5d6b64",
  high: "#1f8a5b",
  medium: "#b8860b",
  low: "#c2410c",
  blocked: "#9aa6a0",
};

export type Confidence = "high" | "medium" | "low";

/** Confidence pill colours (superset shape: includes `label`, used by PipelineBoard). */
export const CONF_STYLE: Record<Confidence, { bg: string; fg: string; label: string }> = {
  high: { bg: "#e6f4ec", fg: C.high, label: "high" },
  medium: { bg: "#fbf2dc", fg: C.medium, label: "medium" },
  low: { bg: "#fde8de", fg: C.low, label: "low" },
};

export function btn(color: string): CSSProperties {
  return {
    background: color,
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "7px 13px",
    fontSize: 13,
    fontWeight: 650,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

export const btnGhost: CSSProperties = {
  background: "#fff",
  color: C.sub,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  padding: "7px 13px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
};
