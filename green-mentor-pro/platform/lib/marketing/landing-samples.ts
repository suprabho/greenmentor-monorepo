import { createClient } from "@/lib/supabase/server";
import { ARTICLE_COLUMNS, mapArticle, type ArticleRowRaw, type FeedArticle } from "@/lib/feed/repo";
import { rankFeed } from "@/lib/feed/rank";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchCourseCatalog, fetchCourseTree, type CatalogDb } from "@/lib/academy/repo";
import { sumDurations } from "@/lib/academy/format";
import { fetchJobs, type Job } from "@/lib/jobs/repo";
import type { Course } from "@/lib/academy/types";

/** One real course plus the meta the CourseCard needs, same math as /academy. */
export type LandingCourse = {
  course: Course;
  moduleCount: number;
  lessonCount: number;
  totalDurationS: number;
};

/**
 * Real product content for the landing carousel: the top-ranked feed article,
 * the first published in-app course, and the newest job. Each read fails soft
 * to `null` — the carousel then falls back to its static preview card, so a
 * missing migration or an empty table never blanks the landing page.
 */
export type LandingSamples = {
  article: FeedArticle | null;
  course: LandingCourse | null;
  job: Job | null;
};

// Over-fetch a little so rankFeed has something to reorder (it prefers
// India-region and recent items over the raw newest row).
const ARTICLE_FETCH = 12;

async function topArticle(): Promise<FeedArticle | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("articles")
    .select(ARTICLE_COLUMNS)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(ARTICLE_FETCH);
  if (error) throw new Error(error.message);
  const rows = rankFeed(((data ?? []) as unknown as ArticleRowRaw[]).map(mapArticle));
  return rows[0] ?? null;
}

async function firstCourse(): Promise<LandingCourse | null> {
  // The academy tables are readable by `authenticated` only, and the landing
  // visitor is signed out. The readers below filter to status = 'published'
  // themselves, so the service-role client exposes nothing a learner couldn't
  // see; it just runs without a session. Server-only — this module is never
  // imported by client code.
  const db = createAdminClient() as unknown as CatalogDb;
  const courses = await fetchCourseCatalog(db);
  const course = courses[0];
  if (!course) return null;
  const tree = await fetchCourseTree(course.slug, db);
  if (!tree) return null;
  const lessons = tree.modules.flatMap((m) => m.lessons);
  return {
    course: tree.course,
    moduleCount: tree.modules.length,
    lessonCount: lessons.length,
    totalDurationS: sumDurations(lessons),
  };
}

async function newestJob(): Promise<Job | null> {
  const jobs = await fetchJobs();
  return jobs[0] ?? null;
}

export async function fetchLandingSamples(): Promise<LandingSamples> {
  const [article, course, job] = await Promise.all([
    topArticle().catch(() => null),
    firstCourse().catch(() => null),
    newestJob().catch(() => null),
  ]);
  return { article, course, job };
}
