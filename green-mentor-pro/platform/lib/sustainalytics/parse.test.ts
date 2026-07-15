import { describe, it, expect } from "vitest";
import {
  meiCodeFromName,
  parseMeiCatalog,
  parseSubindustryMatrix,
} from "./parse";

// A trimmed slice of the real resource-center markup: three MEI cards plus an
// unrelated `col-*` div (which must be ignored). Covers the three name shapes
// that make code-derivation non-trivial — an en-dash, a comma, and an "&amp;".
const CARD = (cssCode: string, name: string, desc: string) =>
  `<div class="col-6 col-md-3 ${cssCode}" >` +
  `<div ><div class="sust-mei-card-container"><div class="card">` +
  `<div class="card-body"><div class="sust-mei-summary">` +
  `<p class="card-text">${desc}</p></div>` +
  `<div class="learn-more">Learn More</div></div></div>` +
  `<a href="#" class="card-link">&nbsp;</a>` +
  `</div><p class="sust-mei-title">${name}</p></div></div>`;

const HTML =
  `<div class="col-12 hero">not a card</div>` +
  CARD("CorporateGovernance", "Corporate Governance", "Focuses on the frameworks &amp; controls.") +
  CARD("EmissionsEffluentsWaste", "Emissions, Effluents and Waste", "Air, water and land releases &#8212; excluding GHG.") +
  CARD("ESImpactofProductsServices", "E&amp;S Impact of Products and Services", "Lifecycle impacts of a company&#39;s products.");

const MATRIX = {
  Advertising: { name: "Advertising", meis: ["CorporateGovernance"] },
  AerospaceandDefence: {
    name: "Aerospace and Defence",
    meis: ["CorporateGovernance", "EmissionsEffluentsandWaste", "ESImpactofProductsandServices"],
  },
};

describe("meiCodeFromName", () => {
  it("normalizes en/em dashes to a hyphen without surrounding spaces", () => {
    expect(meiCodeFromName("Carbon – Own Operations")).toBe("Carbon-OwnOperations");
    expect(meiCodeFromName("Water Use – Supply Chain")).toBe("WaterUse-SupplyChain");
  });

  it("drops commas, spaces and ampersands (matching the JSON scheme)", () => {
    expect(meiCodeFromName("Emissions, Effluents and Waste")).toBe("EmissionsEffluentsandWaste");
    expect(meiCodeFromName("E&S Impact of Products and Services")).toBe(
      "ESImpactofProductsandServices",
    );
  });

  it("decodes HTML entities before deriving the code", () => {
    expect(meiCodeFromName("E&amp;S Impact of Products and Services")).toBe(
      "ESImpactofProductsandServices",
    );
  });
});

describe("parseMeiCatalog", () => {
  const catalog = parseMeiCatalog(HTML);

  it("parses one entry per MEI card and ignores non-card columns", () => {
    expect(catalog.map((c) => c.code)).toEqual([
      "CorporateGovernance",
      "EmissionsEffluentsandWaste",
      "ESImpactofProductsandServices",
    ]);
  });

  it("derives the canonical code from the name, not the CSS class", () => {
    // CSS class is `EmissionsEffluentsWaste`; the JSON/canonical code keeps "and".
    expect(catalog[1].code).toBe("EmissionsEffluentsandWaste");
  });

  it("decodes entities in name and description", () => {
    expect(catalog[2].name).toBe("E&S Impact of Products and Services");
    expect(catalog[0].description).toBe("Focuses on the frameworks & controls.");
    expect(catalog[1].description).toBe("Air, water and land releases — excluding GHG.");
    expect(catalog[2].description).toBe("Lifecycle impacts of a company's products.");
  });

  it("records page order in sortOrd", () => {
    expect(catalog.map((c) => c.sortOrd)).toEqual([0, 1, 2]);
  });

  it("throws when the layout yields no cards", () => {
    expect(() => parseMeiCatalog("<div>nothing here</div>")).toThrow(/no MEI cards/);
  });
});

describe("parseSubindustryMatrix", () => {
  const subs = parseSubindustryMatrix(MATRIX);

  it("returns one entry per subindustry, sorted by name", () => {
    expect(subs.map((s) => s.slug)).toEqual(["Advertising", "AerospaceandDefence"]);
  });

  it("keeps the applicable MEI codes and matches the catalog", () => {
    const catalogCodes = new Set(parseMeiCatalog(HTML).map((c) => c.code));
    const matrixCodes = new Set(subs.flatMap((s) => s.meiCodes));
    for (const code of matrixCodes) expect(catalogCodes.has(code)).toBe(true);
    expect(subs[1].meiCodes).toContain("ESImpactofProductsandServices");
  });

  it("rejects a non-object payload", () => {
    expect(() => parseSubindustryMatrix([] as unknown)).toThrow(/expected a JSON object/);
  });
});
