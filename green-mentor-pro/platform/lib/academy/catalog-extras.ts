import { courses as marketingCourses } from "@/lib/data/courses";
import { LEARNYST_COURSES_URL } from "@/lib/learnyst/config";

/**
 * Live-training and bundle entries for the Academy landing page. These mirror
 * the external Learnyst catalog (single-sourced from lib/data/courses.ts so
 * prices/URLs never drift) — unlike the self-paced Supabase catalog, they link
 * out rather than into the in-app player. When live cohorts get real dates
 * (none exist in any data source yet), replace `nextCohortLabel` with data.
 */

// Explicit, not inferred from titles. Per lib/data/courses.ts these are the
// two premium instructor-led programs.
const LIVE_COURSE_IDS = new Set(["live-lca-training", "esg-reporting-pro"]);

export type LiveCatalogCourse = {
  id: string;
  title: string;
  description: string;
  framework: string;
  level: string;
  standalonePrice: number | null;
  learnystUrl: string;
  nextCohortLabel: string;
};

export const liveCourses: LiveCatalogCourse[] = marketingCourses
  .filter((c) => LIVE_COURSE_IDS.has(c.id))
  .map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    framework: c.framework,
    level: c.level,
    standalonePrice: c.standalonePrice,
    learnystUrl: c.learnystUrl,
    nextCohortLabel: "Next cohort — dates announced soon",
  }));

export type BundleCatalogEntry = {
  name: string;
  description: string;
  learnystUrl: string;
  courses: { id: string; title: string; framework: string; lessons: number; level: string }[];
};

export const plusEssentialBundle: BundleCatalogEntry = {
  name: "Plus Essential",
  description: "All five GreenMentor courses — self-paced tracks and both live programs — under one subscription.",
  learnystUrl: LEARNYST_COURSES_URL,
  courses: marketingCourses
    .filter((c) => c.included)
    .map((c) => ({ id: c.id, title: c.title, framework: c.framework, lessons: c.lessons, level: c.level })),
};
