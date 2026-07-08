import { createClient } from "@/lib/supabase/server";
import type {
  Assessment,
  Course,
  CourseTree,
  Lesson,
  LessonProgress,
  Module,
  ModuleProgress,
  QuestionPublic,
} from "./types";

// Server-Component-facing reads. All go through the RLS-bound server client
// (the signed-in learner's own session) — no service-role access here. Writes
// to progress/gamification tables never happen from this file; see
// lib/academy/progress.ts and gamification.ts for the admin-client side.

function mapCourse(row: {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  level: string;
  price_credits: number;
  status: string;
  cover_image_object_path: string | null;
  position: number;
}): Course {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    level: row.level as Course["level"],
    priceCredits: row.price_credits,
    status: row.status as Course["status"],
    coverImageObjectPath: row.cover_image_object_path,
    position: row.position,
  };
}

function mapModule(row: {
  id: string;
  course_id: string;
  position: number;
  title: string;
  description: string | null;
  unlock_rule: string;
}): Module {
  return {
    id: row.id,
    courseId: row.course_id,
    position: row.position,
    title: row.title,
    description: row.description,
    unlockRule: row.unlock_rule as Module["unlockRule"],
  };
}

function mapLesson(row: {
  id: string;
  module_id: string;
  position: number;
  type: string;
  title: string;
  objective: string | null;
  key_topics: string[] | null;
  video_object_path: string | null;
  poster_object_path: string | null;
  duration_seconds: number | null;
  completion_threshold_pct: number;
  transcript: string | null;
  summary_block: string | null;
}): Lesson {
  return {
    id: row.id,
    moduleId: row.module_id,
    position: row.position,
    type: row.type as Lesson["type"],
    title: row.title,
    objective: row.objective,
    keyTopics: row.key_topics ?? [],
    videoObjectPath: row.video_object_path,
    posterObjectPath: row.poster_object_path,
    durationSeconds: row.duration_seconds,
    completionThresholdPct: row.completion_threshold_pct,
    transcript: row.transcript,
    summaryBlock: row.summary_block,
  };
}

function mapAssessment(row: {
  id: string;
  scope: string;
  module_id: string | null;
  lesson_id: string | null;
  title: string;
  pass_threshold_pct: number;
  max_attempts: number | null;
  retry_cooldown_seconds: number;
  shuffle_options: boolean;
  xp_award: number;
  coin_award: number;
}): Assessment {
  return {
    id: row.id,
    scope: row.scope as Assessment["scope"],
    moduleId: row.module_id,
    lessonId: row.lesson_id,
    title: row.title,
    passThresholdPct: row.pass_threshold_pct,
    maxAttempts: row.max_attempts,
    retryCooldownSeconds: row.retry_cooldown_seconds,
    shuffleOptions: row.shuffle_options,
    xpAward: row.xp_award,
    coinAward: row.coin_award,
  };
}

const COURSE_COLUMNS =
  "id, slug, title, description, level, price_credits, status, cover_image_object_path, position";

export async function fetchCourseCatalog(): Promise<Course[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .select(COURSE_COLUMNS)
    .eq("status", "published")
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapCourse);
}

export async function fetchCourseTree(slug: string): Promise<CourseTree | null> {
  const supabase = await createClient();

  const { data: courseRow, error: courseErr } = await supabase
    .from("courses")
    .select(COURSE_COLUMNS)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (courseErr) throw new Error(courseErr.message);
  if (!courseRow) return null;

  const { data: moduleRows, error: moduleErr } = await supabase
    .from("modules")
    .select("id, course_id, position, title, description, unlock_rule")
    .eq("course_id", courseRow.id)
    .order("position", { ascending: true });
  if (moduleErr) throw new Error(moduleErr.message);

  const moduleIds = (moduleRows ?? []).map((m) => m.id);
  const noMatch = "00000000-0000-0000-0000-000000000000";

  const [{ data: lessonRows, error: lessonErr }, { data: assessRows, error: assessErr }] = await Promise.all([
    supabase
      .from("lessons")
      .select(
        "id, module_id, position, type, title, objective, key_topics, video_object_path, poster_object_path, duration_seconds, completion_threshold_pct, transcript, summary_block"
      )
      .in("module_id", moduleIds.length ? moduleIds : [noMatch])
      .order("position", { ascending: true }),
    supabase
      .from("assessments")
      .select(
        "id, scope, module_id, lesson_id, title, pass_threshold_pct, max_attempts, retry_cooldown_seconds, shuffle_options, xp_award, coin_award"
      )
      .in("module_id", moduleIds.length ? moduleIds : [noMatch])
      .eq("scope", "module"),
  ]);
  if (lessonErr) throw new Error(lessonErr.message);
  if (assessErr) throw new Error(assessErr.message);

  const lessonsByModule = new Map<string, Lesson[]>();
  for (const row of lessonRows ?? []) {
    const lesson = mapLesson(row);
    const list = lessonsByModule.get(lesson.moduleId) ?? [];
    list.push(lesson);
    lessonsByModule.set(lesson.moduleId, list);
  }

  const assessmentByModule = new Map<string, Assessment>();
  for (const row of assessRows ?? []) {
    const assessment = mapAssessment(row);
    if (assessment.moduleId) assessmentByModule.set(assessment.moduleId, assessment);
  }

  const modules = (moduleRows ?? []).map((row) => {
    const module = mapModule(row);
    return {
      ...module,
      lessons: lessonsByModule.get(module.id) ?? [],
      assessment: assessmentByModule.get(module.id) ?? null,
    };
  });

  return { course: mapCourse(courseRow), modules };
}

export async function fetchLearnerProgress(
  userId: string,
  tree: CourseTree
): Promise<{ lessonProgress: Map<string, LessonProgress>; moduleProgress: Map<string, ModuleProgress> }> {
  const supabase = await createClient();
  const lessonIds = tree.modules.flatMap((m) => m.lessons.map((l) => l.id));
  const moduleIds = tree.modules.map((m) => m.id);

  const [lessonRes, moduleRes] = await Promise.all([
    lessonIds.length
      ? supabase
          .from("lesson_progress")
          .select("lesson_id, watched_seconds, furthest_position_s, watched_ranges, pct_watched, completed_at")
          .eq("user_id", userId)
          .in("lesson_id", lessonIds)
      : Promise.resolve({ data: [], error: null }),
    moduleIds.length
      ? supabase
          .from("module_progress")
          .select("module_id, lessons_done, gate_passed_at, completed_at")
          .eq("user_id", userId)
          .in("module_id", moduleIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (lessonRes.error) throw new Error(lessonRes.error.message);
  if (moduleRes.error) throw new Error(moduleRes.error.message);

  const lessonProgress = new Map<string, LessonProgress>();
  for (const row of lessonRes.data ?? []) {
    lessonProgress.set(row.lesson_id, {
      lessonId: row.lesson_id,
      watchedSeconds: row.watched_seconds,
      furthestPositionS: Number(row.furthest_position_s),
      watchedRanges: (row.watched_ranges ?? []) as [number, number][],
      pctWatched: row.pct_watched,
      completedAt: row.completed_at,
    });
  }

  const moduleProgress = new Map<string, ModuleProgress>();
  for (const row of moduleRes.data ?? []) {
    moduleProgress.set(row.module_id, {
      moduleId: row.module_id,
      lessonsDone: row.lessons_done,
      gatePassedAt: row.gate_passed_at,
      completedAt: row.completed_at,
    });
  }

  return { lessonProgress, moduleProgress };
}

/** Enrolling in a free course isn't a gameable action, so this runs on the
 * RLS-bound client (policy: "enrolments own") rather than the admin client. */
export async function ensureEnrolled(userId: string, courseId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("enrolments")
    .upsert({ user_id: userId, course_id: courseId }, { onConflict: "user_id,course_id", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}

export async function fetchAssessmentQuestions(assessmentId: string): Promise<QuestionPublic[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("question_public")
    .select("id, assessment_id, position, stem, type, options, topic_tag")
    .eq("assessment_id", assessmentId)
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    assessmentId: row.assessment_id,
    position: row.position,
    stem: row.stem,
    type: row.type as "single_select",
    options: row.options,
    topicTag: row.topic_tag,
  }));
}

/** Header chip stats (XP / coins / streak). Owner-read RLS policies make
 * these safe on the normal server client — no admin client needed to read. */
export async function fetchHeaderStats(
  userId: string
): Promise<{ xp: number; coins: number; streakDays: number } | null> {
  const supabase = await createClient();
  const [xpRes, creditRes, streakRes] = await Promise.all([
    supabase.from("xp_events").select("xp").eq("user_id", userId),
    supabase.from("credit_transactions").select("amount").eq("user_id", userId),
    supabase.from("streaks").select("current_len").eq("user_id", userId).maybeSingle(),
  ]);
  if (xpRes.error || creditRes.error || streakRes.error) return null;

  const xp = (xpRes.data ?? []).reduce((sum, row) => sum + row.xp, 0);
  const coins = (creditRes.data ?? []).reduce((sum, row) => sum + row.amount, 0);
  const streakDays = streakRes.data?.current_len ?? 0;
  return { xp, coins, streakDays };
}
