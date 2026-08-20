import { describe, expect, it } from "vitest";
import { extractContexts, extractFacts, matchIndicators } from "./xbrl";
import type { BrsrIndicatorDef } from "./tag-map";

/**
 * Fallback tags rescue filings where the primary element is filed as 0 — banks
 * and insurers do this with Turnover, because turnover is not a meaningful
 * concept for them, and report the figure under TotalRevenueOfTheCompany
 * instead. LICI 2023-24 filed Turnover=0 alongside TotalRevenue=4.758e12.
 */
const DEFS: BrsrIndicatorDef[] = [
  { key: "turnover", tags: ["Turnover"], fallbackTags: ["TotalRevenueOfTheCompany"], category: "financial" },
];

const wrap = (body: string) => `<?xml version="1.0"?>
<xbrli:xbrl xmlns:xbrli="http://www.xbrl.org/2003/instance" xmlns:in-capmkt="http://sebi.gov.in/xbrl/in-capmkt">
  <xbrli:context id="DCYMain">
    <xbrli:period><xbrli:startDate>2025-04-01</xbrli:startDate><xbrli:endDate>2026-03-31</xbrli:endDate></xbrli:period>
  </xbrli:context>
  <xbrli:context id="DPYMain">
    <xbrli:period><xbrli:startDate>2024-04-01</xbrli:startDate><xbrli:endDate>2025-03-31</xbrli:endDate></xbrli:period>
  </xbrli:context>
  ${body}
</xbrli:xbrl>`;

const run = (body: string) => {
  const xml = wrap(body);
  return matchIndicators(extractFacts(xml), extractContexts(xml), DEFS).indicators.filter((i) => i.key === "turnover");
};

describe("matchIndicators fallbackTags", () => {
  it("replaces a filed zero with the fallback in the same context", () => {
    const rows = run(`
      <in-capmkt:Turnover contextRef="DCYMain" unitRef="INR">0</in-capmkt:Turnover>
      <in-capmkt:TotalRevenueOfTheCompany contextRef="DCYMain" unitRef="INR">4758000000000</in-capmkt:TotalRevenueOfTheCompany>
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].value).toBe(4758000000000);
    expect(rows[0].rawTag).toBe("TotalRevenueOfTheCompany");
  });

  it("leaves a genuinely filed value alone, and mints no extra period rows", () => {
    // The healthy case: primary is fine in CY, fallback also present in CY and PY.
    // Seeding PY here would inflate every healthy filing in the table.
    const rows = run(`
      <in-capmkt:Turnover contextRef="DCYMain" unitRef="INR">52467758757</in-capmkt:Turnover>
      <in-capmkt:TotalRevenueOfTheCompany contextRef="DCYMain" unitRef="INR">52467758757</in-capmkt:TotalRevenueOfTheCompany>
      <in-capmkt:TotalRevenueOfTheCompany contextRef="DPYMain" unitRef="INR">49349000000</in-capmkt:TotalRevenueOfTheCompany>
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].contextRef).toBe("DCYMain");
    expect(rows[0].rawTag).toBe("Turnover");
    expect(rows[0].value).toBe(52467758757);
  });

  it("seeds only the latest period when the primary tag is absent entirely", () => {
    const rows = run(`
      <in-capmkt:TotalRevenueOfTheCompany contextRef="DCYMain" unitRef="INR">300</in-capmkt:TotalRevenueOfTheCompany>
      <in-capmkt:TotalRevenueOfTheCompany contextRef="DPYMain" unitRef="INR">200</in-capmkt:TotalRevenueOfTheCompany>
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].contextRef).toBe("DCYMain");
    expect(rows[0].value).toBe(300);
  });

  it("replaces a negative primary too — turnover cannot be negative", () => {
    // IDEA FY2024-25 filed Turnover = -698562487426, apparently its net loss.
    const rows = run(`
      <in-capmkt:Turnover contextRef="DCYMain" unitRef="INR">-698562487426</in-capmkt:Turnover>
      <in-capmkt:TotalRevenueOfTheCompany contextRef="DCYMain" unitRef="INR">431572244213</in-capmkt:TotalRevenueOfTheCompany>
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].value).toBe(431572244213);
    expect(rows[0].rawTag).toBe("TotalRevenueOfTheCompany");
  });

  it("does not rescue with a negative fallback", () => {
    const rows = run(`
      <in-capmkt:Turnover contextRef="DCYMain" unitRef="INR">0</in-capmkt:Turnover>
      <in-capmkt:TotalRevenueOfTheCompany contextRef="DCYMain" unitRef="INR">-5</in-capmkt:TotalRevenueOfTheCompany>
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].value).toBe(0);
    expect(rows[0].rawTag).toBe("Turnover");
  });

  it("does not rescue a zero with another zero", () => {
    const rows = run(`
      <in-capmkt:Turnover contextRef="DCYMain" unitRef="INR">0</in-capmkt:Turnover>
      <in-capmkt:TotalRevenueOfTheCompany contextRef="DCYMain" unitRef="INR">0</in-capmkt:TotalRevenueOfTheCompany>
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].value).toBe(0);
    expect(rows[0].rawTag).toBe("Turnover");
  });

  it("keeps the zero when the fallback sits in a different context", () => {
    // Only a same-context substitution is defensible; a PY figure is not this
    // year's revenue.
    const rows = run(`
      <in-capmkt:Turnover contextRef="DCYMain" unitRef="INR">0</in-capmkt:Turnover>
      <in-capmkt:TotalRevenueOfTheCompany contextRef="DPYMain" unitRef="INR">900</in-capmkt:TotalRevenueOfTheCompany>
    `);
    const cy = rows.find((r) => r.contextRef === "DCYMain");
    expect(cy?.value).toBe(0);
  });

  it("ignores fallbacks for defs that declare none", () => {
    const defs: BrsrIndicatorDef[] = [{ key: "turnover", tags: ["Turnover"], category: "financial" }];
    const xml = wrap(`
      <in-capmkt:Turnover contextRef="DCYMain" unitRef="INR">0</in-capmkt:Turnover>
      <in-capmkt:TotalRevenueOfTheCompany contextRef="DCYMain" unitRef="INR">123</in-capmkt:TotalRevenueOfTheCompany>
    `);
    const rows = matchIndicators(extractFacts(xml), extractContexts(xml), defs).indicators;
    expect(rows).toHaveLength(1);
    expect(rows[0].value).toBe(0);
  });
});
