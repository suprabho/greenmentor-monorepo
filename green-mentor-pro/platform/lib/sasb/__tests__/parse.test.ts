// Unit tests for the SASB Materiality Finder parsers. Run with:
//   pnpm --filter @gm/platform sasb:test
// (node:test via tsx — no test-framework dependency, matching the repo's
// existing `--import tsx` script pattern, e.g. esg:test / sustainalytics:test.)
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  SASB_SOURCES,
  parseSectorIndustry,
  parseDimensions,
  parseIndustryTopics,
} from "../parse";

// Trimmed slices of the three real responses, preserving the exact key names and
// the int-vs-string typing of the codes that the parsers must normalize.
const SECTOR_INDUSTRY = [
  {
    sector: "Consumer Goods",
    hs_value: "Consumer Goods",
    industries: [
      { code: "CG-AA", name: "Apparel, Accessories & Footwear", hs_value: "…", description: "The Apparel industry…" },
      { code: "CG-EC", name: "E-Commerce", hs_value: "…", description: "" },
    ],
  },
  {
    sector: "Technology & Communications",
    industries: [
      { code: "TC-SI", name: "Software & IT Services", description: "The Software industry…" },
    ],
  },
];

const DIMENSIONS = [
  {
    name: "Environment",
    issueCategories: [
      { code: 110, name: "GHG Emissions", description: "Direct (Scope 1) emissions…" },
      { code: 120, name: "Air Quality", description: "Air emissions other than GHGs…" },
    ],
  },
  {
    name: "Social Capital",
    issueCategories: [{ code: 250, name: "Product Quality & Safety", description: "Unintended characteristics…" }],
  },
];

const INDUSTRY_TOPICS = [
  {
    industry_code: "CG-AA",
    industry_name: "Apparel, Accessories & Footwear",
    industry_description: "…",
    industry_gics: [
      {
        gic_code: 250,
        gic_name: "Product Quality & Safety",
        gic_description: "…",
        gic_dimension: "Social Capital",
        gic_topics: [
          { topic_code: "CG-AA-250b", topic_name: "Chemical Concerns", topic_description: "Concerns B…" },
          { topic_code: "CG-AA-250a", topic_name: "Management of Chemicals in Products", topic_description: "Concerns A…" },
        ],
      },
      {
        gic_code: 110,
        gic_name: "GHG Emissions",
        gic_description: "…",
        gic_dimension: "Environment",
        gic_topics: [{ topic_code: "CG-AA-110a", topic_name: "GHG Emissions", topic_description: "…" }],
      },
    ],
  },
];

// ── parseSectorIndustry ──────────────────────────────────────────────────────
test("parseSectorIndustry flattens sectors → industries carrying the sector name", () => {
  const rows = parseSectorIndustry(SECTOR_INDUSTRY);
  assert.equal(rows.length, 3);
  // sorted by code: CG-AA, CG-EC, TC-SI
  assert.deepEqual(rows.map((r) => r.code), ["CG-AA", "CG-EC", "TC-SI"]);
  const aa = rows.find((r) => r.code === "CG-AA")!;
  assert.equal(aa.sector, "Consumer Goods");
  assert.equal(aa.name, "Apparel, Accessories & Footwear");
  const si = rows.find((r) => r.code === "TC-SI")!;
  assert.equal(si.sector, "Technology & Communications");
  // a missing description degrades to "" rather than undefined
  assert.equal(rows.find((r) => r.code === "CG-EC")!.description, "");
});

test("parseSectorIndustry throws on an empty / wrong shape", () => {
  assert.throws(() => parseSectorIndustry([]), /no industries found/);
  assert.throws(() => parseSectorIndustry([{ sector: "X" }]), /no industries found/);
  assert.throws(() => parseSectorIndustry({} as unknown), /expected an array/);
});

// ── parseDimensions ──────────────────────────────────────────────────────────
test("parseDimensions flattens dimensions → GICs, stringifies codes, keeps canonical order", () => {
  const cats = parseDimensions(DIMENSIONS);
  assert.equal(cats.length, 3);
  // order preserved as sortOrd 0,1,2 across dimensions
  assert.deepEqual(cats.map((c) => c.code), ["110", "120", "250"]);
  assert.deepEqual(cats.map((c) => c.sortOrd), [0, 1, 2]);
  assert.equal(typeof cats[0].code, "string"); // int 110 → "110"
  assert.equal(cats[0].dimension, "Environment");
  assert.equal(cats[2].dimension, "Social Capital");
  assert.equal(cats[0].name, "GHG Emissions");
});

test("parseDimensions throws on an empty result", () => {
  assert.throws(() => parseDimensions([]), /no issue categories/);
  assert.throws(() => parseDimensions("nope" as unknown), /expected an array/);
});

// ── parseIndustryTopics ──────────────────────────────────────────────────────
test("parseIndustryTopics normalizes GIC codes and extracts sorted topics", () => {
  const inds = parseIndustryTopics(INDUSTRY_TOPICS);
  assert.equal(inds.length, 1);
  const cgaa = inds[0];
  assert.equal(cgaa.industryCode, "CG-AA");
  // GICs sorted by code: "110" before "250"
  assert.deepEqual(cgaa.gics.map((g) => g.gicCode), ["110", "250"]);
  assert.equal(typeof cgaa.gics[0].gicCode, "string"); // int 110 → "110"
  const pqs = cgaa.gics.find((g) => g.gicCode === "250")!;
  assert.equal(pqs.dimension, "Social Capital");
  // topics sorted by code: 250a before 250b
  assert.deepEqual(pqs.topics.map((t) => t.code), ["CG-AA-250a", "CG-AA-250b"]);
  assert.equal(pqs.topics[0].name, "Management of Chemicals in Products");
});

test("parseIndustryTopics throws on an empty / wrong shape", () => {
  assert.throws(() => parseIndustryTopics([]), /no industries found/);
  assert.throws(() => parseIndustryTopics({} as unknown), /expected an array/);
});

// ── SASB_SOURCES ─────────────────────────────────────────────────────────────
test("SASB_SOURCES.industryTopics batches codes into one query, default locale en", () => {
  const url = SASB_SOURCES.industryTopics(["CG-AA", "TC-SI"]);
  assert.match(url, /\/industryTopics\?industries=CG-AA,TC-SI&locale=en$/);
  assert.match(SASB_SOURCES.industryTopics(["CG-AA"], "fr"), /locale=fr$/);
});
