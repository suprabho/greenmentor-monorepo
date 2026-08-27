import { createClient } from "@/lib/supabase/server";
import { ARTICLE_COLUMNS, mapArticle, type ArticleRowRaw, type FeedArticle } from "@/lib/feed/repo";
import { rankFeed } from "@/lib/feed/rank";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchCourseCatalog, fetchCourseTree, type CatalogDb } from "@/lib/academy/repo";
import { sumDurations } from "@/lib/academy/format";
import { fetchJobs, type Job } from "@/lib/jobs/repo";
import type { Course } from "@/lib/academy/types";
import { CYCLE_SIZE } from "./landing-constants";

/** One real course plus the meta the CourseCard needs, same math as /academy. */
export type LandingCourse = {
  course: Course;
  moduleCount: number;
  lessonCount: number;
  totalDurationS: number;
};

/**
 * Real product content for the landing carousel: the top-ranked feed
 * articles and newest jobs (the slides cycle through these), and the first
 * published in-app course. Each read fails soft to empty/`null` — the
 * carousel then falls back to its static preview card, so a missing
 * migration or an empty table never blanks the landing page.
 */
export type LandingSamples = {
  articles: FeedArticle[];
  course: LandingCourse | null;
  jobs: Job[];
};

// Over-fetch so rankFeed has something to reorder (it prefers India-region
// and recent items over the raw newest rows).
const ARTICLE_FETCH = 24;

async function topArticles(): Promise<FeedArticle[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("articles")
    .select(ARTICLE_COLUMNS)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(ARTICLE_FETCH);
  if (error) throw new Error(error.message);
  return rankFeed(((data ?? []) as unknown as ArticleRowRaw[]).map(mapArticle)).slice(0, CYCLE_SIZE);
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

async function newestJobs(): Promise<Job[]> {
  return (await fetchJobs()).slice(0, CYCLE_SIZE);
}

export async function fetchLandingSamples(): Promise<LandingSamples> {
  const [articles, course, jobs] = await Promise.all([
    topArticles().catch(() => []),
    firstCourse().catch(() => null),
    newestJobs().catch(() => []),
  ]);
  return { articles, course, jobs };
}
