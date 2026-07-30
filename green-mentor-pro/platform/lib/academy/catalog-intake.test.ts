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

/** A minimal valid Bundle record; override fields per test. */
function bundleRec(over: Record<string, string> = {}): Record<string, string> {
  return rec({
    Type: "Bundle",
    "Course ID / Slug": "demo-bundle",
    Framework: "",
    Modules: "2 courses",
    "Included in Plus Essential": "No",
    "Bundle Courses": "",
    ...over,
  });
}

describe("normaliseRow — bundles", () => {
  it("reads Type: Bundle with no framework and no delivery", () => {
    const { row } = normaliseRow(bundleRec(), 0);
    expect(row.kind).toBe("bundle");
    expect(row.delivery).toBeNull();
    expect(row.framework).toBeNull();
  });

  it("pulls the course count out of the Modules prose", () => {
    expect(normaliseRow(bundleRec({ Modules: "8 courses" }), 0).row.course_count).toBe(8);
    // The sheet writes "3 course" singular; still a valid count.
    expect(normaliseRow(bundleRec({ Modules: "3 course" }), 0).row.course_count).toBe(3);
    expect(normaliseRow(bundleRec({ Modules: "2" }), 0).row.course_count).toBe(2);
  });

  it("keeps module_count null for bundles — Modules means courses there", () => {
    expect(normaliseRow(bundleRec({ Modules: "8 courses" }), 0).row.module_count).toBeNull();
  });

  it("throws when a bundle's course count is unreadable", () => {
    expect(() => normaliseRow(bundleRec({ Modules: "a few courses" }), 0)).toThrow(/unreadable Modules/);
    expect(() => normaliseRow(bundleRec({ Modules: "" }), 0)).toThrow(/need a course count/);
  });

  it("does NOT apply the plus override to bundles", () => {
    // A separately-priced bundle marked "No" must stay excluded, or it would
    // double-count its member courses into the pricing page's value total.
    const { row, overridden } = normaliseRow(bundleRec({ "Price (INR)": "69999" }), 0);
    expect(row.included_in_plus).toBe(false);
    expect(overridden).toBe(false);
  });

  it("rejects a bundle that carries a framework", () => {
    expect(() => normaliseRow(bundleRec({ Framework: "CBAM" }), 0)).toThrow(/must leave Framework blank/);
  });

  it("rejects Bundle Courses on a course row", () => {
    expect(() => normaliseRow(rec({ "Bundle Courses": "lca" }), 0)).toThrow(/only valid on Bundle rows/);
  });

  it("trims a stray trailing space off the title", () => {
    expect(normaliseRow(bundleRec({ Title: "Emission Mastery " }), 0).row.title).toBe("Emission Mastery");
  });
});

describe("parseIntakeSheet — bundle membership", () => {
  const sheet = (...lines: string[]) =>
    [
      "Type,Course ID / Slug,Title,Framework,Level,Description,Outcome,Modules,Lessons,Duration,Price (INR),Included in Plus Essential,Hosted On,Course URL,Next Cohort Date,Instructor(s),Cover Image URL,Status,Notes,Bundle Courses",
      ...lines,
    ].join("\n");
  const COURSE = "Self-Paced,lca,LCA,LCA,Intermediate,d,o,6,12,6 hours,5999,Yes,Learnyst,https://x.co/lca,,,,Published,,";
  const bundle = (members: string, count = "2 courses") =>
    `Bundle,b1,B,,Intermediate,d,o,${count},40,21 hours,12000,No,Learnyst,https://x.co/b,,,,Published,,"${members}"`;

  it("throws when Bundle Courses names a slug that is not a course", () => {
    expect(() => parseIntakeSheet(sheet(COURSE, bundle("lca, nope")))).toThrow(/not courses in this sheet: nope/);
  });

  it("throws when Bundle Courses repeats a slug", () => {
    expect(() => parseIntakeSheet(sheet(COURSE, bundle("lca, lca")))).toThrow(/repeats lca/);
  });

  it("warns, not throws, when membership is missing — the card degrades to counts", () => {
    const { warnings } = parseIntakeSheet(sheet(COURSE, bundle("")));
    expect(warnings).toEqual([expect.stringMatching(/no "Bundle Courses" listed/)]);
  });

  it("warns when the listed members disagree with the advertised count", () => {
    const { warnings } = parseIntakeSheet(sheet(COURSE, bundle("lca", "2 courses")));
    expect(warnings).toEqual([expect.stringMatching(/advertises 2 courses but lists 1/)]);
  });

  it("is silent when the count matches", () => {
    expect(parseIntakeSheet(sheet(COURSE, bundle("lca", "1 course"))).warnings).toEqual([]);
  });
});

describe("parseIntakeSheet on the committed sheet", () => {
  const { rows, overridden, warnings } = parseIntakeSheet(SHEET);
  const courses = rows.filter((r) => r.kind === "course");
  const bundles = rows.filter((r) => r.kind === "bundle");

  it("reads twelve courses and three bundles", () => {
    expect(courses).toHaveLength(12);
    expect(bundles).toHaveLength(3);
    expect(new Set(rows.map((r) => r.slug)).size).toBe(15);
  });

  it("overrides every course the sheet excluded from Plus Essential, and no bundle", () => {
    // The four live programmes plus the free in-app course.
    expect(overridden).toEqual([
      "esg-fundamentals",
      "live-lca-training",
      "esg-reporting-pro",
      "ghg-lead-verifier",
      "carbon-market",
    ]);
    expect(courses.every((r) => r.included_in_plus)).toBe(true);
    expect(bundles.every((r) => !r.included_in_plus)).toBe(true);
  });

  it("carries the bundle prices and counts", () => {
    expect(bundles.map((b) => [b.slug, b.course_count, b.price_inr])).toEqual([
      ["leadership", 8, 69999],
      ["esg-3-in-1", 3, 15000],
      ["emission-2-in-1", 2, 12000],
    ]);
  });

  it("resolves the membership that has been filled in", () => {
    const byslug = new Map(bundles.map((b) => [b.slug, b.members]));
    expect(byslug.get("esg-3-in-1")).toEqual([
      "fundamentals-esg-brsr",
      "esg-materiality",
      "ghg-accounting-mastery",
    ]);
    expect(byslug.get("emission-2-in-1")).toEqual(["ghg-accounting-mastery", "lca"]);
  });

  it("warns that the leadership bundle still needs its course list", () => {
    expect(warnings).toEqual([expect.stringMatching(/^leadership: no "Bundle Courses" listed/)]);
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

  it("sums COURSES to the standalone value the pricing page claims", () => {
    // Courses only. Summing bundles in as well gives ₹260,993 and double-counts
    // every member course — which is why the plus override is course-scoped and
    // the landing page passes catalog.courses, not the whole catalog, to
    // PricingSnapshot.
    expect(courses.reduce((sum, r) => sum + (r.price_inr ?? 0), 0)).toBe(163994);
    expect(bundles.reduce((sum, r) => sum + (r.price_inr ?? 0), 0)).toBe(96999);
  });

  it("rejects a sheet with a duplicate slug", () => {
    const dupe = SHEET + "\n" + SHEET.split("\n")[1];
    expect(() => parseIntakeSheet(dupe)).toThrow(/duplicate slug/);
  });
});
