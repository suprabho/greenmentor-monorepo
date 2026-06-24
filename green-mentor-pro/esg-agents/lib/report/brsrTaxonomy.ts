/**
 * BRSR principle taxonomy + a tolerant disclosure-code parser. Disclosure codes
 * arrive in two forms: clean machine codes ("P6-E7", "P6Q1") from the calculation
 * agent, and verbose human strings ("BRSR — Principle 6, Q1 — Energy consumption")
 * from report drafting. Both must route to the right principle; anything non-BRSR
 * (GRI/ESRS) falls into a visible "Other frameworks" bucket.
 */
export const BRSR_PRINCIPLES: Record<number, string> = {
  1: "Ethics, Transparency & Accountability",
  2: "Sustainable & Safe Goods and Services",
  3: "Employee Well-being",
  4: "Stakeholder Responsiveness",
  5: "Human Rights",
  6: "Environment",
  7: "Responsible Public Policy Advocacy",
  8: "Inclusive Growth & Equitable Development",
  9: "Consumer Value",
};

export interface ParsedCode {
  principle: number | null; // 1..9 or null
  indicator: "E" | "L" | null; // Essential / Leadership
  isBrsr: boolean;
}

function clampPrinciple(n: number): number | null {
  return Number.isInteger(n) && n >= 1 && n <= 9 ? n : null;
}

export function parseBrsrCode(raw: string): ParsedCode {
  const s = (raw || "").trim();

  // Clean machine code: P6, P6-E7, P6_L1, P6E7, P6Q1 …
  const code = s.match(/\bP\s*(\d{1,2})(?:[\s\-_]*([EL])\s*\d*)?/i);
  if (code) {
    const principle = clampPrinciple(Number(code[1]));
    if (principle) return { principle, indicator: (code[2]?.toUpperCase() as "E" | "L") ?? null, isBrsr: true };
  }

  // Spelled-out: "Principle 6", optionally "… Leadership/Essential …"
  const spelled = s.match(/\bPrinciple\s+(\d{1,2})/i);
  if (spelled) {
    const principle = clampPrinciple(Number(spelled[1]));
    if (principle) {
      const indicator = /lead/i.test(s) ? "L" : /essential/i.test(s) ? "E" : null;
      return { principle, indicator, isBrsr: true };
    }
  }

  return { principle: null, indicator: null, isBrsr: false };
}
