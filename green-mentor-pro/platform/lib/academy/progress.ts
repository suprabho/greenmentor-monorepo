import type { SupabaseClient } from "@supabase/supabase-js";
import { AcademyApiError } from "./errors";
import { awardAssessmentPass, awardCourseCompletion, awardLessonCompletion, touchStreak } from "./gamification";
import { mergeRanges, watchedSeconds, type Range } from "./ranges";

// Admin-client only — the authoritative side of the anti-cheat boundary
// (PRD §6.2 FR-V-04, §9). Import exclusively from app/api/academy/** route
// handlers, never from a Server Component. Every write here recomputes state
// from the DB, not from anything the client claims.

export type LessonProgressResult = {
  pctWatched: number;
  completed: boolean;
  xpAwarded: number;
  coinsAwarded: number;
  streakDays: number;
};

export async function applyLessonProgress(
  admin: SupabaseClient,
  userId: string,
  lessonId: string,
  segments: Range[]
): Promise<LessonProgressResult> {
  const { data: lesson, error: lessonErr } = await admin
    .from("lessons")
    .select("id, module_id, duration_seconds, completion_threshold_pct")
    .eq("id", lessonId)
    .maybeSingle();
  if (lessonErr) throw new Error(lessonErr.message);
  if (!lesson) throw new AcademyApiError("lesson not found", 404);

  const { data: existing, error: fetchErr } = await admin
    .from("lesson_progress")
    .select("watched_ranges, completed_at")
    .eq("user_id", userId)
    .eq("lesson_id", lessonId)
    .maybeSingle();
  if (fetchErr) throw new Error(fetchErr.message);

  const priorRanges = (existing?.watched_ranges ?? []) as Range[];
  const merged = mergeRanges(priorRanges, segments);
  const totalWatched = watchedSeconds(merged);
  const duration = lesson.duration_seconds ?? 0;
  const pctWatched = duration > 0 ? Math.min(100, Math.round((totalWatched / duration) * 100)) : 0;
  const furthest = merged.length ? merged[merged.length - 1][1] : 0;

  const wasCompleteAlready = !!existing?.completed_at;
  const completing = !wasCompleteAlready && pctWatched >= lesson.completion_threshold_pct;
  const nowIso = new Date().toISOString();

  const { error: upsertErr } = await admin.from("lesson_progress").upsert(
    {
      user_id: userId,
      lesson_id: lessonId,
      watched_seconds: Math.round(totalWatched),
      furthest_position_s: furthest,
      watched_ranges: merged,
      pct_watched: pctWatched,
      completed_at: wasCompleteAlready ? existing!.completed_at : completing ? nowIso : null,
      last_event_at: nowIso,
    },
    { onConflict: "user_id,lesson_id" }
  );
  if (upsertErr) throw new Error(upsertErr.message);

  let xpAwarded = 0;
  let coinsAwarded = 0;
  let streakDays = 0;

  if (completing) {
    const award = await awardLessonCompletion(admin, userId, lessonId);
    xpAwarded += award.xpAwarded;
    coinsAwarded += award.coinsAwarded;

    const streak = await touchStreak(admin, userId);
    streakDays = streak.currentLen;
    if (streak.milestoneAward) {
      xpAwarded += streak.milestoneAward.xpAwarded;
      coinsAwarded += streak.milestoneAward.coinsAwarded;
    }

    await bumpModuleLessonCount(admin, userId, lesson.module_id);
  } else {
    const { data: streakRow } = await admin.from("streaks").select("current_len").eq("user_id", userId).maybeSingle();
    streakDays = streakRow?.current_len ?? 0;
  }

  return { pctWatched, completed: completing || wasCompleteAlready, xpAwarded, coinsAwarded, streakDays };
}

async function bumpModuleLessonCount(admin: SupabaseClient, userId: string, moduleId: string): Promise<void> {
  const { data: lessonRows, error: lessonErr } = await admin.from("lessons").select("id").eq("module_id", moduleId);
  if (lessonErr) throw new Error(lessonErr.message);
  const lessonIds = (lessonRows ?? []).map((row) => row.id);
  if (!lessonIds.length) return;

  const { data: progressRows, error: progressErr } = await admin
    .from("lesson_progress")
    .select("lesson_id")
    .eq("user_id", userId)
    .in("lesson_id", lessonIds)
    .not("completed_at", "is", null);
  if (progressErr) throw new Error(progressErr.message);

  const { error: upsertErr } = await admin
    .from("module_progress")
    .upsert(
      { user_id: userId, module_id: moduleId, lessons_done: progressRows?.length ?? 0 },
      { onConflict: "user_id,module_id" }
    );
  if (upsertErr) throw new Error(upsertErr.message);
}

export async function fetchQuestionAnswer(
  admin: SupabaseClient,
  assessmentId: string,
  questionId: string
): Promise<{ correctKey: string; explanation: string | null } | null> {
  const { data, error } = await admin
    .from("questions")
    .select("correct_key, explanation")
    .eq("assessment_id", assessmentId)
    .eq("id", questionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { correctKey: data.correct_key, explanation: data.explanation };
}

export type AssessmentSubmitResult = {
  scorePct: number;
  passed: boolean;
  attemptNo: number;
  xpAwarded: number;
  coinsAwarded: number;
  moduleCompleted: boolean;
  courseCompleted: boolean;
  streakDays: number;
};

export async function applyAssessmentSubmit(
  admin: SupabaseClient,
  userId: string,
  assessmentId: string,
  answers: { questionId: string; selectedKey: string }[]
): Promise<AssessmentSubmitResult> {
  const { data: assessment, error: assessErr } = await admin
    .from("assessments")
    .select("id, module_id, pass_threshold_pct, max_attempts, retry_cooldown_seconds, xp_award, coin_award")
    .eq("id", assessmentId)
    .maybeSingle();
  if (assessErr) throw new Error(assessErr.message);
  if (!assessment) throw new AcademyApiError("assessment not found", 404);
  if (!assessment.module_id) throw new AcademyApiError("lesson-scoped assessments are not supported yet", 400);

  const { data: questions, error: questionsErr } = await admin
    .from("questions")
    .select("id, correct_key")
    .eq("assessment_id", assessmentId);
  if (questionsErr) throw new Error(questionsErr.message);
  const correctByQuestion = new Map((questions ?? []).map((q) => [q.id, q.correct_key]));

  const { data: priorAttempts, error: attemptsErr } = await admin
    .from("assessment_attempts")
    .select("attempt_no, submitted_at")
    .eq("user_id", userId)
    .eq("assessment_id", assessmentId)
    .order("attempt_no", { ascending: false });
  if (attemptsErr) throw new Error(attemptsErr.message);

  const attemptNo = (priorAttempts?.[0]?.attempt_no ?? 0) + 1;
  if (assessment.max_attempts != null && attemptNo > assessment.max_attempts) {
    throw new AcademyApiError("max attempts reached for this assessment", 403);
  }
  const lastAttempt = priorAttempts?.[0];
  if (lastAttempt?.submitted_at && assessment.retry_cooldown_seconds > 0) {
    const elapsedSeconds = (Date.now() - Date.parse(lastAttempt.submitted_at)) / 1000;
    if (elapsedSeconds < assessment.retry_cooldown_seconds) {
      throw new AcademyApiError("retry cooldown still active", 429);
    }
  }

  const gradedAnswers = answers.map((a) => ({
    question_id: a.questionId,
    selected_key: a.selectedKey,
    correct: correctByQuestion.get(a.questionId) === a.selectedKey,
  }));
  const totalQuestions = correctByQuestion.size || 1;
  const correctCount = gradedAnswers.filter((a) => a.correct).length;
  const scorePct = Math.round((correctCount / totalQuestions) * 100);
  const passed = scorePct >= assessment.pass_threshold_pct;
  const nowIso = new Date().toISOString();

  const { error: insertErr } = await admin.from("assessment_attempts").insert({
    user_id: userId,
    assessment_id: assessmentId,
    attempt_no: attemptNo,
    answers: gradedAnswers,
    score_pct: scorePct,
    passed,
    submitted_at: nowIso,
  });
  if (insertErr) throw new Error(insertErr.message);

  let xpAwarded = 0;
  let coinsAwarded = 0;
  let streakDays = 0;
  let moduleCompleted = false;
  let courseCompleted = false;

  if (passed) {
    const award = await awardAssessmentPass(
      admin,
      userId,
      assessmentId,
      assessment.xp_award,
      assessment.coin_award,
      scorePct === 100
    );
    xpAwarded += award.xpAwarded;
    coinsAwarded += award.coinsAwarded;

    const { data: existingModuleProgress } = await admin
      .from("module_progress")
      .select("lessons_done, gate_passed_at, completed_at")
      .eq("user_id", userId)
      .eq("module_id", assessment.module_id)
      .maybeSingle();

    const wasModuleComplete = !!existingModuleProgress?.completed_at;
    const { error: mpErr } = await admin.from("module_progress").upsert(
      {
        user_id: userId,
        module_id: assessment.module_id,
        lessons_done: existingModuleProgress?.lessons_done ?? 0,
        gate_passed_at: existingModuleProgress?.gate_passed_at ?? nowIso,
        completed_at: existingModuleProgress?.completed_at ?? nowIso,
      },
      { onConflict: "user_id,module_id" }
    );
    if (mpErr) throw new Error(mpErr.message);
    moduleCompleted = !wasModuleComplete;

    const streak = await touchStreak(admin, userId);
    streakDays = streak.currentLen;
    if (streak.milestoneAward) {
      xpAwarded += streak.milestoneAward.xpAwarded;
      coinsAwarded += streak.milestoneAward.coinsAwarded;
    }

    if (moduleCompleted) {
      const courseId = await getCourseIdForModule(admin, assessment.module_id);
      if (courseId && (await isCourseFullyComplete(admin, userId, courseId))) {
        courseCompleted = true;
        const courseAward = await awardCourseCompletion(admin, userId, courseId);
        xpAwarded += courseAward.xpAwarded;
        coinsAwarded += courseAward.coinsAwarded;
      }
    }
  } else {
    const { data: streakRow } = await admin.from("streaks").select("current_len").eq("user_id", userId).maybeSingle();
    streakDays = streakRow?.current_len ?? 0;
  }

  return { scorePct, passed, attemptNo, xpAwarded, coinsAwarded, moduleCompleted, courseCompleted, streakDays };
}

async function getCourseIdForModule(admin: SupabaseClient, moduleId: string): Promise<string | null> {
  const { data, error } = await admin.from("modules").select("course_id").eq("id", moduleId).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.course_id ?? null;
}

async function isCourseFullyComplete(admin: SupabaseClient, userId: string, courseId: string): Promise<boolean> {
  const { data: allModules, error: modulesErr } = await admin.from("modules").select("id").eq("course_id", courseId);
  if (modulesErr) throw new Error(modulesErr.message);
  const moduleIds = (allModules ?? []).map((m) => m.id);
  if (!moduleIds.length) return false;

  const { data: progressRows, error: progressErr } = await admin
    .from("module_progress")
    .select("module_id, completed_at")
    .eq("user_id", userId)
    .in("module_id", moduleIds);
  if (progressErr) throw new Error(progressErr.message);

  const completedIds = new Set((progressRows ?? []).filter((row) => row.completed_at).map((row) => row.module_id));
  return moduleIds.every((id) => completedIds.has(id));
}
