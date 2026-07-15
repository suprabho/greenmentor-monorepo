/**
 * E/S/G pillar presentation for the MSCI materiality views. Hues are validated
 * dataviz categorical slots 1–3 (same palette as lib/nic — green/blue/amber);
 * the green and amber sit below 3:1 on white, so every mark is direct-labelled
 * and every chart carries a table view (the house relief rule).
 */
import type { MsciPillar } from "@/lib/msci/materiality-map";

export const PILLAR_META: Record<MsciPillar, { label: string; short: string; hue: string }> = {
  environmental: { label: "Environmental", short: "E", hue: "#1baf7a" },
  social: { label: "Social", short: "S", hue: "#2a78d6" },
  governance: { label: "Governance", short: "G", hue: "#eda100" },
};

export const PILLAR_ORDER: MsciPillar[] = ["environmental", "social", "governance"];

/** Weight (%) rounded for display: integers stay whole, else one decimal. */
export const fmtWeight = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1));
