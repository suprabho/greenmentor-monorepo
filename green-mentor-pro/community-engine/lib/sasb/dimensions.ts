/**
 * The five SASB sustainability dimensions, for the materiality views. Each carries
 * a hue (validated dataviz categorical slots — the green/blue/amber shared with
 * lib/nic + lib/msci, plus violet/slate for the extra two) and a short tag. Marks
 * are direct-labelled and the dimensions are always shown with their name, so the
 * lower-contrast hues stay legible (the house relief rule).
 */
export const DIMENSION_ORDER = [
  "Environment",
  "Social Capital",
  "Human Capital",
  "Business Model and Innovation",
  "Leadership and Governance",
] as const;

export interface DimensionMeta {
  short: string;
  hue: string;
}

export const DIMENSION_META: Record<string, DimensionMeta> = {
  "Environment": { short: "ENV", hue: "#1baf7a" },
  "Social Capital": { short: "SOC", hue: "#2a78d6" },
  "Human Capital": { short: "HUM", hue: "#eda100" },
  "Business Model and Innovation": { short: "B&I", hue: "#8b5cf6" },
  "Leadership and Governance": { short: "L&G", hue: "#64748b" },
};

const FALLBACK: DimensionMeta = { short: "—", hue: "#94a3b8" };

/** Meta for a dimension name, defaulting gracefully if SASB ever renames one. */
export const dimensionMeta = (name: string): DimensionMeta => DIMENSION_META[name] ?? FALLBACK;
