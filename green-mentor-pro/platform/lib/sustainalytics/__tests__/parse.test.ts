// Unit tests for the Sustainalytics MEI parsers. Run with:
//   pnpm --filter @gm/platform sustainalytics:test
// (node:test via tsx — no test-framework dependency, matching the repo's
// existing `--import tsx` script pattern, e.g. esg:test.)
import assert from "node:assert/strict";
import { test } from "node:test";

import { meiCodeFromName, parseMeiCatalog, parseSubindustryMatrix } from "../parse";

// A trimmed slice of the real resource-center markup: three MEI cards plus an
// unrelated `col-*` div (which must be ignored). Covers the three name shapes
// that make code-derivation non-trivial — an en-dash, a comma, and an "&amp;".
const card = (cssCode: string, name: string, desc: string) =>
  `<div class="col-6 col-md-3 ${cssCode}" >` +
  `<div ><div class="sust-mei-card-container"><div class="card">` +
  `<div class="card-body"><div class="sust-mei-summary">` +
  `<p class="card-text">${desc}</p></div>` +
  `<div class="learn-more">Learn More</div></div></div>` +
  `<a href="#" class="card-link">&nbsp;</a>` +
  `</div><p class="sust-mei-title">${name}</p></div></div>`;

const HTML =
  `<div class="col-12 hero">not a card</div>` +
  card("CorporateGovernance", "Corporate Governance", "Focuses on the frameworks &amp; controls.") +
  card("EmissionsEffluentsWaste", "Emissions, Effluents and Waste", "Air, water and land releases &#8212; excluding GHG.") +
  card("ESImpactofProductsServices", "E&amp;S Impact of Products and Services", "Lifecycle impacts of a company&#39;s products.");

const MATRIX = {
  Advertising: { name: "Advertising", meis: ["CorporateGovernance"] },
  AerospaceandDefence: {
    name: "Aerospace and Defence",
    meis: ["CorporateGovernance", "EmissionsEffluentsandWaste", "ESImpactofProductsandServices"],
  },
};

test("meiCodeFromName normalizes en/em dashes to a hyphen without spaces", () => {
  assert.equal(meiCodeFromName("Carbon – Own Operations"), "Carbon-OwnOperations");
  assert.equal(meiCodeFromName("Water Use – Supply Chain"), "WaterUse-SupplyChain");
});

test("meiCodeFromName drops commas, spaces and ampersands (matching the JSON scheme)", () => {
  assert.equal(meiCodeFromName("Emissions, Effluents and Waste"), "EmissionsEffluentsandWaste");
  assert.equal(meiCodeFromName("E&S Impact of Products and Services"), "ESImpactofProductsandServices");
});

test("meiCodeFromName decodes HTML entities before deriving the code", () => {
  assert.equal(meiCodeFromName("E&amp;S Impact of Products and Services"), "ESImpactofProductsandServices");
});

test("parseMeiCatalog parses one entry per card and ignores non-card columns", () => {
  const catalog = parseMeiCatalog(HTML);
  assert.deepEqual(catalog.map((c) => c.code), [
    "CorporateGovernance",
    "EmissionsEffluentsandWaste",
    "ESImpactofProductsandServices",
  ]);
});

test("parseMeiCatalog derives the canonical code from the name, not the CSS class", () => {
  // CSS class is `EmissionsEffluentsWaste`; the JSON/canonical code keeps "and".
  assert.equal(parseMeiCatalog(HTML)[1].code, "EmissionsEffluentsandWaste");
});

test("parseMeiCatalog decodes entities in name and description and records order", () => {
  const catalog = parseMeiCatalog(HTML);
  assert.equal(catalog[2].name, "E&S Impact of Products and Services");
  assert.equal(catalog[0].description, "Focuses on the frameworks & controls.");
  assert.equal(catalog[1].description, "Air, water and land releases — excluding GHG.");
  assert.equal(catalog[2].description, "Lifecycle impacts of a company's products.");
  assert.deepEqual(catalog.map((c) => c.sortOrd), [0, 1, 2]);
});

test("parseMeiCatalog throws when the layout yields no cards", () => {
  assert.throws(() => parseMeiCatalog("<div>nothing here</div>"), /no MEI cards/);
});

test("parseSubindustryMatrix returns one entry per subindustry, sorted by name", () => {
  const subs = parseSubindustryMatrix(MATRIX);
  assert.deepEqual(subs.map((s) => s.slug), ["Advertising", "AerospaceandDefence"]);
});

test("parseSubindustryMatrix keeps applicable MEI codes that match the catalog", () => {
  const subs = parseSubindustryMatrix(MATRIX);
  const catalogCodes = new Set(parseMeiCatalog(HTML).map((c) => c.code));
  for (const code of subs.flatMap((s) => s.meiCodes)) assert.ok(catalogCodes.has(code));
  assert.ok(subs[1].meiCodes.includes("ESImpactofProductsandServices"));
});

test("parseSubindustryMatrix rejects a non-object payload", () => {
  assert.throws(() => parseSubindustryMatrix([] as unknown), /expected a JSON object/);
});
