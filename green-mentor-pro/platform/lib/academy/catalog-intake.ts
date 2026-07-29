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
 * Product decision (2026-07-29): every course is included in the Plus Essential
 * subscription, including the rows whose sheet column says "No". The column is
 * still parsed so the override shows up in the run log and in each row's
 * `notes` — it must never become an invisible hardcode. Set this to false to
 * honour the sheet again.
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
  delivery: "self_paced" | "live";
  hosted_on: "in_app" | "learnyst";
  course_id: string | null;
  title: string;
  framework: string;
  level: string;
  description: string;
  outcome: string;
  module_count: number | null;
  lesson_count: number | null;
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
};

const isBlank = (s: string) => s === "" || s === "-" || s === "—";

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

  const typeRaw = (rec["Type"] ?? "").toLowerCase();
  const delivery = typeRaw.startsWith("self") ? "self_paced" : typeRaw === "live" ? "live" : null;
  if (!delivery) throw new Error(`${slug}: unknown Type ${JSON.stringify(rec["Type"])} (expected Self-Paced or Live)`);

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

  const rawFramework = rec["Framework"];
  if (!rawFramework) throw new Error(`${slug}: missing Framework`);
  const framework = FRAMEWORK_ALIASES[rawFramework] ?? rawFramework;

  const csvIncluded = /^y(es)?$/i.test(rec["Included in Plus Essential"] ?? "");
  const includedInPlus = INCLUDE_ALL_IN_PLUS ? true : csvIncluded;
  const overridden = includedInPlus !== csvIncluded;

  const notes = [
    rec["Notes"] || null,
    framework !== rawFramework ? `Framework relabelled from "${rawFramework}" on import.` : null,
    overridden ? OVERRIDE_NOTE : null,
  ]
    .filter(Boolean)
    .join(" ");

  const row: CatalogIntakeRow = {
    slug,
    delivery,
    hosted_on: hostedOn,
    course_id: null,
    title: rec["Title"],
    framework,
    level,
    description: rec["Description"] ?? "",
    outcome: rec["Outcome"] ?? "",
    module_count: parseCount(rec["Modules"] ?? "", "Modules", slug),
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
  };
  return { row, overridden };
}

/** Parse a whole intake sheet, rejecting duplicate slugs. */
export function parseIntakeSheet(csvText: string): { rows: CatalogIntakeRow[]; overridden: string[] } {
  const records = parseCsvRecords(csvText);
  const parsed = records.map((rec, i) => normaliseRow(rec, i));
  const rows = parsed.map((p) => p.row);

  const dupes = rows.map((r) => r.slug).filter((s, i, a) => a.indexOf(s) !== i);
  if (dupes.length) throw new Error(`duplicate slug(s) in the sheet: ${[...new Set(dupes)].join(", ")}`);

  return { rows, overridden: parsed.filter((p) => p.overridden).map((p) => p.row.slug) };
}
