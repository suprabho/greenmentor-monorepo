import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { normaliseRow, parseCohortDate, parseIntakeSheet, parsePrice } from "./catalog-intake";

const SHEET = readFileSync(
  fileURLToPath(new URL("../../scripts/data/course-catalog.csv", import.meta.url)),
  "utf8",
);

/** A minimal valid record; override fields per test. */
function rec(over: Record<string, string> = {}): Record<string, string> {
  return {
    Type: "Self-Paced",
    "Course ID / Slug": "demo",
    Title: "Demo",
    Framework: "CBAM",
    Level: "Intermediate",
    Description: "d",
    Outcome: "o",
    Modules: "3",
    Lessons: "9",
    Duration: "4 hours",
    "Price (INR)": "999",
    "Included in Plus Essential": "Yes",
    "Hosted On": "Learnyst",
    "Course URL": "https://academy.greenmentor.co/learn/Demo",
    "Next Cohort Date": "",
    "Instructor(s)": "",
    "Cover Image URL": "",
    Status: "Live on Learnyst",
    Notes: "",
    ...over,
  };
}

describe("parsePrice", () => {
  it("maps Free to 0, not null — a free course is priced, just at zero", () => {
    expect(parsePrice("Free", "x")).toBe(0);
  });

  it("strips currency decoration", () => {
    expect(parsePrice("₹6,999", "x")).toBe(6999);
  });

  it("returns null when there is no standalone price", () => {
    expect(parsePrice("", "x")).toBeNull();
    expect(parsePrice("-", "x")).toBeNull();
  });

  it("throws on garbage rather than silently zeroing", () => {
    expect(() => parsePrice("ask us", "x")).toThrow(/unreadable Price/);
  });
});

describe("parseCohortDate", () => {
  it("reads the sheet's ordinal format", () => {
    expect(parseCohortDate("29th August 2026", "x")).toBe("2026-08-29");
  });

  it("zero-pads single-digit days", () => {
    expect(parseCohortDate("1st March 2027", "x")).toBe("2027-03-01");
  });

  it("passes ISO through", () => {
    expect(parseCohortDate("2026-08-29", "x")).toBe("2026-08-29");
  });

  it("treats blanks and TBD as no date", () => {
    expect(parseCohortDate("", "x")).toBeNull();
    expect(parseCohortDate("TBD", "x")).toBeNull();
  });

  it("throws on an unreadable date — a typo must not silently erase a cohort", () => {
    expect(() => parseCohortDate("next August", "x")).toThrow(/unparseable/);
    expect(() => parseCohortDate("29th Augvst 2026", "x")).toThrow(/unknown month/);
  });
});

describe("normaliseRow", () => {
  it("relabels the framework aliases and records why in notes", () => {
    const { row } = normaliseRow(rec({ Framework: "ESG" }), 0);
    expect(row.framework).toBe("Circular Economy");
    expect(row.notes).toMatch(/relabelled from "ESG"/);

    expect(normaliseRow(rec({ Framework: "LCA methodology" }), 0).row.framework).toBe("LCA");
  });

  it("leaves unaliased frameworks alone and adds no note", () => {
    const { row } = normaliseRow(rec(), 0);
    expect(row.framework).toBe("CBAM");
    expect(row.notes).toBeNull();
  });

  it("overrides included_in_plus to true and says so in notes", () => {
    const { row, overridden } = normaliseRow(rec({ "Included in Plus Essential": "No" }), 0);
    expect(row.included_in_plus).toBe(true);
    expect(overridden).toBe(true);
    expect(row.notes).toMatch(/overridden to true/);
  });

  it("does not flag an override when the sheet already says Yes", () => {
    expect(normaliseRow(rec(), 0).overridden).toBe(false);
  });

  it("splits a multi-instructor cell", () => {
    const { row } = normaliseRow(rec({ "Instructor(s)": "Karuna Kalra, Maitri Desai, Shriya Singh" }), 0);
    expect(row.instructors).toEqual(["Karuna Kalra", "Maitri Desai", "Shriya Singh"]);
  });

  it("maps delivery, host and status", () => {
    const live = normaliseRow(rec({ Type: "Live" }), 0).row;
    expect(live.delivery).toBe("live");

    const inApp = normaliseRow(
      rec({ "Hosted On": "GreenMentor Pro (in-app)", "Course URL": "/academy/demo", Status: "Published" }),
      0,
    ).row;
    expect(inApp.hosted_on).toBe("in_app");
    expect(inApp.status).toBe("published");
  });

  it("rejects a level the catalog check constraint would refuse", () => {
    expect(() => normaliseRow(rec({ Level: "Expert" }), 0)).toThrow(/unknown Level/);
  });

  it("rejects an in-app course pointing at an external URL", () => {
    expect(() =>
      normaliseRow(rec({ "Hosted On": "GreenMentor Pro (in-app)", "Course URL": "https://elsewhere.com" }), 0),
    ).toThrow(/internal Course URL/);
  });

  it("rejects a Learnyst course pointing at an internal path", () => {
    expect(() => normaliseRow(rec({ "Course URL": "/academy/demo" }), 0)).toThrow(/absolute Course URL/);
  });

  it("uses row order as position", () => {
    expect(normaliseRow(rec(), 4).row.position).toBe(4);
  });
});

describe("parseIntakeSheet on the committed sheet", () => {
  const { rows, overridden } = parseIntakeSheet(SHEET);

  it("reads all twelve courses", () => {
    expect(rows).toHaveLength(12);
    expect(new Set(rows.map((r) => r.slug)).size).toBe(12);
  });

  it("overrides every row the sheet excluded from Plus Essential", () => {
    // The four live programmes plus the free in-app course.
    expect(overridden).toEqual([
      "esg-fundamentals",
      "live-lca-training",
      "esg-reporting-pro",
      "ghg-lead-verifier",
      "carbon-market",
    ]);
    expect(rows.every((r) => r.included_in_plus)).toBe(true);
  });

  it("has exactly one in-app course, linked to an internal path", () => {
    const inApp = rows.filter((r) => r.hosted_on === "in_app");
    expect(inApp.map((r) => r.slug)).toEqual(["esg-fundamentals"]);
    expect(inApp[0].course_url).toBe("/academy/esg-fundamentals");
    expect(inApp[0].price_inr).toBe(0);
  });

  it("carries the one real cohort date", () => {
    const withCohort = rows.filter((r) => r.next_cohort_at);
    expect(withCohort.map((r) => [r.slug, r.next_cohort_at])).toEqual([["ghg-lead-verifier", "2026-08-29"]]);
  });

  it("publishes every row, whether the sheet said Published or Live on Learnyst", () => {
    expect(rows.every((r) => r.status === "published")).toBe(true);
  });

  it("emits no aliased framework labels", () => {
    const frameworks = new Set(rows.map((r) => r.framework));
    expect(frameworks.has("ESG")).toBe(false);
    expect(frameworks.has("LCA methodology")).toBe(false);
    expect(frameworks.has("Circular Economy")).toBe(true);
  });

  it("sums to the standalone value the pricing page claims", () => {
    const total = rows.reduce((sum, r) => sum + (r.price_inr ?? 0), 0);
    expect(total).toBe(163994);
  });

  it("rejects a sheet with a duplicate slug", () => {
    const dupe = SHEET + "\n" + SHEET.split("\n")[1];
    expect(() => parseIntakeSheet(dupe)).toThrow(/duplicate slug/);
  });
});
