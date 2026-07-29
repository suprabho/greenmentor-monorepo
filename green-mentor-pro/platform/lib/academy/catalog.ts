import { createClient } from "@/lib/supabase/server";
import { LEARNYST_COURSES_URL } from "@/lib/learnyst/config";
import type { BundleCatalogEntry, CatalogCourse } from "./types";

/**
 * The course catalog — every course we sell, in-app or on Learnyst.
 *
 * Separate from repo.ts, which is scoped to the signed-in learner's own session:
 * this data is anon-readable (the logged-out landing page renders it) and comes
 * from public.course_catalog via the course_catalog_public view, which already
 * filters to status='published'. Written only by scripts/import-course-catalog.ts.
 */

// One string literal, not a concatenation: supabase-js parses this at the type
// level, and a computed string collapses the row type to GenericStringError.
const CATALOG_COLUMNS =
  "slug, delivery, hosted_on, title, framework, level, description, outcome, module_count, lesson_count, duration_label, price_inr, included_in_plus, course_url, next_cohort_at, next_cohort_label, instructors, cover_image_url, position";

type CatalogRow = {
  slug: string;
  delivery: string;
  hosted_on: string;
  title: string;
  framework: string;
  level: string;
  description: string | null;
  outcome: string | null;
  module_count: number | null;
  lesson_count: number | null;
  duration_label: string | null;
  price_inr: number | null;
  included_in_plus: boolean;
  course_url: string;
  next_cohort_at: string | null;
  next_cohort_label: string | null;
  instructors: string[] | null;
  cover_image_url: string | null;
  position: number;
};

function mapCatalogCourse(row: CatalogRow): CatalogCourse {
  return {
    slug: row.slug,
    delivery: row.delivery as CatalogCourse["delivery"],
    hostedOn: row.hosted_on as CatalogCourse["hostedOn"],
    title: row.title,
    framework: row.framework,
    level: row.level as CatalogCourse["level"],
    description: row.description ?? "",
    outcome: row.outcome ?? "",
    moduleCount: row.module_count,
    lessonCount: row.lesson_count,
    durationLabel: row.duration_label,
    priceInr: row.price_inr,
    includedInPlus: row.included_in_plus,
    courseUrl: row.course_url,
    nextCohortAt: row.next_cohort_at,
    nextCohortLabel: row.next_cohort_label,
    instructors: row.instructors ?? [],
    coverImageUrl: row.cover_image_url,
    position: row.position,
  };
}

/**
 * Next signals control flow by throwing: DynamicServerError when a static render
 * touches cookies, plus redirect/notFound. Those must propagate — swallowing
 * DYNAMIC_SERVER_USAGE tells the build "this rendered fine statically" and can
 * freeze an empty catalog into the prerendered HTML.
 */
function isNextControlFlowError(e: unknown): boolean {
  const digest = (e as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && (digest === "DYNAMIC_SERVER_USAGE" || digest.startsWith("NEXT_"));
}

/**
 * Never throws on data errors. The marketing landing page renders this, and a
 * missing table or a blip in Supabase should cost us the course section, not the
 * whole page — the console.error is the signal that it happened.
 */
export async function fetchCatalog(): Promise<CatalogCourse[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("course_catalog_public")
      .select(CATALOG_COLUMNS)
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapCatalogCourse);
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    console.error("[catalog] read failed, rendering an empty catalog:", e instanceof Error ? e.message : e);
    return [];
  }
}

export const DEFAULT_COHORT_LABEL = "Next cohort — dates announced soon";

/**
 * next_cohort_at is a date-only column, so it must be formatted in UTC —
 * without the override, "2026-08-29" renders as the 28th anywhere west of UTC.
 */
export function cohortLabel(course: CatalogCourse): string {
  if (course.nextCohortLabel) return course.nextCohortLabel;
  if (!course.nextCohortAt) return DEFAULT_COHORT_LABEL;
  const when = new Date(`${course.nextCohortAt}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return `Next cohort — ${when}`;
}

export function buildPlusEssentialBundle(catalog: CatalogCourse[]): BundleCatalogEntry {
  const included = catalog.filter((c) => c.includedInPlus);
  return {
    name: "Plus Essential",
    description: `All ${included.length} GreenMentor courses — self-paced tracks and live programmes — under one subscription.`,
    learnystUrl: LEARNYST_COURSES_URL,
    courses: included,
  };
}
