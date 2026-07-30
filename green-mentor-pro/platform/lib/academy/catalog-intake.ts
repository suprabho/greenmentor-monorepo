// Relative, not the "@/" alias: this module is loaded by tsx scripts as well as
// by the app, and the scripts don't go through Next's path resolution.
import { parseCsvRecords } from "../utils/csv";

/**
 * Normalisation for the course catalog intake sheet
 * (scripts/data/course-catalog.csv) → public.course_catalog rows.
 *
 * Pure and DB-free so it can be unit-tested, and so both scripts/import-course-catalog.ts
 * (which writes the DB) and scripts/gen-course-catalog.ts --from-csv (which
 * emits the marketing site's committed copy) agree byte for byte.
 */

/**
 * Product decision (2026-07-29): every *course* is included in the Plus
 * Essential subscription, including the rows whose sheet column says "No". The
 * column is still parsed so the override shows up in the run log and in each
 * row's `notes` — it must never become an invisible hardcode. Set this to false
 * to honour the sheet again.
 *
 * Scoped to kind='course' on purpose. Bundles are separately-priced collections
 * (₹12,000–₹69,999) that the sheet marks "No", and they must stay "No": marking
 * one included would both misprice the subscription and double-count its member
 * courses into the pricing page's standalone-value total.
 */
export const INCLUDE_ALL_IN_PLUS = true;
export const OVERRIDE_NOTE =
  'Sheet says Included in Plus Essential = No; overridden to true per product decision 2026-07-29.';

/**
 * Marketing taxonomy fixes applied on import. The sheet labels the circularity
 * course "ESG" (the whole domain, not a framework) and the self-paced LCA course
 * "LCA methodology" where the live one says "LCA". The raw value is preserved in
 * `notes` so the transformation stays auditable.
 */
export const FRAMEWORK_ALIASES: Record<string, string> = {
  ESG: "Circular Economy",
  "LCA methodology": "LCA",
};

export const LEVELS = ["beginner", "foundation", "intermediate", "advanced"] as const;

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

/**
 * Exact match on the full name or the three-letter abbreviation. Deliberately
 * not a prefix match: that accepts "Augvst" as August and imports a plausible
 * wrong date instead of failing.
 */
function monthIndex(name: string): number {
  const s = name.toLowerCase();
  return MONTHS.findIndex((m) => m === s || m.slice(0, 3) === s);
}

export type CatalogIntakeRow = {
  slug: string;
  kind: "course" | "bundle";
  /** Null for bundles: how it's taught is a property of the member courses. */
  delivery: "self_paced" | "live" | null;
  hosted_on: "in_app" | "learnyst";
  course_id: string | null;
  title: string;
  /** Null for bundles — the sheet leaves Framework blank for them. */
  framework: string | null;
  level: string;
  description: string;
  outcome: string;
  module_count: number | null;
  lesson_count: number | null;
  /** Bundles only: how many courses the bundle advertises. */
  course_count: number | null;
  duration_label: string | null;
  price_inr: number | null;
  included_in_plus: boolean;
  course_url: string;
  next_cohort_at: string | null;
  next_cohort_label: string | null;
  instructors: string[];
  cover_image_url: string | null;
  status: string;
  position: number;
  notes: string | null;
  /** Member course slugs, bundles only. Empty until the sheet lists them. */
  members: string[];
};

const isBlank = (s: string) => s === "" || s === "-" || s === "—";

/**
 * Bundles state their size in the Modules column as prose — "8 courses",
 * "3 course". Pulls the leading integer out; throws if there isn't one, so a
 * reworded cell fails loudly instead of dropping the count.
 */
export function parseCourseCount(raw: string, slug: string): number | null {
  if (isBlank(raw)) return null;
  const m = raw.match(/^(\d+)\s*courses?$/i) ?? raw.match(/^(\d+)$/);
  if (!m) throw new Error(`${slug}: unreadable Modules for a bundle (expected e.g. "8 courses"): ${JSON.stringify(raw)}`);
  return Number(m[1]);
}

/** Whole numbers only; blank/"-" → null. Throws rather than silently zeroing. */
export function parseCount(raw: string, field: string, slug: string): number | null {
  if (isBlank(raw)) return null;
  const n = Number(raw.replace(/,/g, ""));
  if (!Number.isInteger(n) || n < 0) throw new Error(`${slug}: ${field} is not a whole number: ${JSON.stringify(raw)}`);
  return n;
}

/** "Free" → 0, "6999"/"₹6,999" → 6999, blank → null (not sold standalone). */
export function parsePrice(raw: string, slug: string): number | null {
  if (isBlank(raw)) return null;
  if (/^free$/i.test(raw)) return 0;
  const n = Number(raw.replace(/[₹,\s]|INR/gi, ""));
  if (!Number.isInteger(n) || n < 0) throw new Error(`${slug}: unreadable Price (INR): ${JSON.stringify(raw)}`);
  return n;
}

/**
 * "29th August 2026" → "2026-08-29" for a `date` column. Throws on a non-empty
 * value it can't read — a typo must not silently erase a cohort date.
 */
export function parseCohortDate(raw: string, slug: string): string | null {
  if (isBlank(raw) || /^(tbd|tba|n\/?a|none)$/i.test(raw)) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const m = raw.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+),?\s+(\d{4})$/);
  if (!m) throw new Error(`${slug}: unparseable Next Cohort Date: ${JSON.stringify(raw)}`);
  const month = monthIndex(m[2]);
  if (month < 0) throw new Error(`${slug}: unknown month in Next Cohort Date: ${JSON.stringify(raw)}`);
  const day = Number(m[1]);
  if (day < 1 || day > 31) throw new Error(`${slug}: bad day in Next Cohort Date: ${JSON.stringify(raw)}`);
  return `${m[3]}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** One sheet record → one course_catalog row. `course_id` is resolved later. */
export function normaliseRow(rec: Record<string, string>, index: number): { row: CatalogIntakeRow; overridden: boolean } {
  const slug = rec["Course ID / Slug"];
  if (!slug) throw new Error(`row ${index + 2}: missing "Course ID / Slug"`);

  const typeRaw = (rec["Type"] ?? "").trim().toLowerCase();
  const kind = typeRaw === "bundle" ? "bundle" : "course";
  // Bundles have no delivery mode of their own — see CatalogIntakeRow.
  const delivery = kind === "bundle" ? null : typeRaw.startsWith("self") ? "self_paced" : typeRaw === "live" ? "live" : null;
  if (kind === "course" && !delivery) {
    throw new Error(`${slug}: unknown Type ${JSON.stringify(rec["Type"])} (expected Self-Paced, Live or Bundle)`);
  }

  const hostedOn = /in-?app|green\s*mentor/i.test(rec["Hosted On"] ?? "") ? "in_app" : "learnyst";

  const level = (rec["Level"] ?? "").toLowerCase();
  if (!LEVELS.includes(level as (typeof LEVELS)[number])) {
    throw new Error(`${slug}: unknown Level ${JSON.stringify(rec["Level"])} (expected one of ${LEVELS.join(", ")})`);
  }

  const url = rec["Course URL"];
  if (!url) throw new Error(`${slug}: missing Course URL`);
  if (hostedOn === "in_app" && !url.startsWith("/")) throw new Error(`${slug}: in-app course needs an internal Course URL, got ${url}`);
  if (hostedOn === "learnyst" && !/^https?:\/\//.test(url)) throw new Error(`${slug}: Learnyst course needs an absolute Course URL, got ${url}`);

  const statusRaw = (rec["Status"] ?? "").toLowerCase();
  const status = /published|live/.test(statusRaw) ? "published" : statusRaw === "archived" ? "archived" : "draft";

  const rawFramework = (rec["Framework"] ?? "").trim();
  if (kind === "course" && !rawFramework) throw new Error(`${slug}: missing Framework`);
  if (kind === "bundle" && rawFramework) {
    throw new Error(`${slug}: bundles must leave Framework blank, got ${JSON.stringify(rawFramework)}`);
  }
  const framework = rawFramework ? FRAMEWORK_ALIASES[rawFramework] ?? rawFramework : null;

  const csvIncluded = /^y(es)?$/i.test(rec["Included in Plus Essential"] ?? "");
  // The override is course-only: a separately-priced bundle must stay excluded.
  const includedInPlus = INCLUDE_ALL_IN_PLUS && kind === "course" ? true : csvIncluded;
  const overridden = includedInPlus !== csvIncluded;

  const members = (rec["Bundle Courses"] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (kind === "course" && members.length) {
    throw new Error(`${slug}: "Bundle Courses" is only valid on Bundle rows`);
  }

  const notes = [
    rec["Notes"] || null,
    framework !== rawFramework ? `Framework relabelled from "${rawFramework}" on import.` : null,
    overridden ? OVERRIDE_NOTE : null,
  ]
    .filter(Boolean)
    .join(" ");

  const row: CatalogIntakeRow = {
    slug,
    kind,
    delivery,
    hosted_on: hostedOn,
    course_id: null,
    title: (rec["Title"] ?? "").trim(),
    framework,
    level,
    description: rec["Description"] ?? "",
    outcome: rec["Outcome"] ?? "",
    // Bundles reuse the Modules column for their course count ("8 courses").
    module_count: kind === "bundle" ? null : parseCount(rec["Modules"] ?? "", "Modules", slug),
    course_count: kind === "bundle" ? parseCourseCount(rec["Modules"] ?? "", slug) : null,
    lesson_count: parseCount(rec["Lessons"] ?? "", "Lessons", slug),
    duration_label: isBlank(rec["Duration"] ?? "") ? null : rec["Duration"],
    price_inr: parsePrice(rec["Price (INR)"] ?? "", slug),
    included_in_plus: includedInPlus,
    course_url: url,
    next_cohort_at: parseCohortDate(rec["Next Cohort Date"] ?? "", slug),
    next_cohort_label: null,
    instructors: (rec["Instructor(s)"] ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s && s !== "-"),
    cover_image_url: isBlank(rec["Cover Image URL"] ?? "") ? null : rec["Cover Image URL"],
    status,
    position: index,
    notes: notes || null,
    members,
  };
  if (kind === "bundle" && row.course_count === null) {
    throw new Error(`${slug}: bundles need a course count in the Modules column (e.g. "8 courses")`);
  }
  return { row, overridden };
}

/**
 * Parse a whole intake sheet: rejects duplicate slugs, and validates bundle
 * membership against the courses in the same sheet. Count mismatches are
 * returned as warnings rather than thrown, so a bundle whose membership hasn't
 * been filled in yet still imports and renders as counts only.
 */
export function parseIntakeSheet(csvText: string): {
  rows: CatalogIntakeRow[];
  overridden: string[];
  warnings: string[];
} {
  const records = parseCsvRecords(csvText);
  const parsed = records.map((rec, i) => normaliseRow(rec, i));
  const rows = parsed.map((p) => p.row);

  const dupes = rows.map((r) => r.slug).filter((s, i, a) => a.indexOf(s) !== i);
  if (dupes.length) throw new Error(`duplicate slug(s) in the sheet: ${[...new Set(dupes)].join(", ")}`);

  const courseSlugs = new Set(rows.filter((r) => r.kind === "course").map((r) => r.slug));
  const warnings: string[] = [];

  for (const row of rows.filter((r) => r.kind === "bundle")) {
    // A typo'd slug is a hard error: it would silently shrink the course list on
    // a paid product page.
    const unknown = row.members.filter((m) => !courseSlugs.has(m));
    if (unknown.length) {
      throw new Error(`${row.slug}: "Bundle Courses" names slug(s) that are not courses in this sheet: ${unknown.join(", ")}`);
    }
    const dupeMembers = row.members.filter((m, i, a) => a.indexOf(m) !== i);
    if (dupeMembers.length) {
      throw new Error(`${row.slug}: "Bundle Courses" repeats ${[...new Set(dupeMembers)].join(", ")}`);
    }
    if (!row.members.length) {
      warnings.push(`${row.slug}: no "Bundle Courses" listed — the card will show counts only`);
    } else if (row.course_count !== null && row.members.length !== row.course_count) {
      warnings.push(
        `${row.slug}: sheet advertises ${row.course_count} courses but lists ${row.members.length} in "Bundle Courses"`,
      );
    }
  }

  return { rows, overridden: parsed.filter((p) => p.overridden).map((p) => p.row.slug), warnings };
}
