import { notFound, redirect } from "next/navigation";
import { ensureEnrolled, fetchCourseTree, fetchLearnerProgress } from "@/lib/academy/repo";
import { computeCourseState } from "@/lib/academy/state";
import { createClient } from "@/lib/supabase/server";
import { LessonPlayer } from "./lesson-player";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ courseSlug: string; lessonId: string }>;
}) {
  const { courseSlug, lessonId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/academy/${courseSlug}/lesson/${lessonId}`)}`);

  const tree = await fetchCourseTree(courseSlug);
  if (!tree) notFound();
  await ensureEnrolled(user.id, tree.course.id);

  const module = tree.modules.find((m) => m.lessons.some((l) => l.id === lessonId));
  const lesson = module?.lessons.find((l) => l.id === lessonId);
  if (!module || !lesson) notFound();

  const { lessonProgress, moduleProgress } = await fetchLearnerProgress(user.id, tree);
  const state = computeCourseState(tree, lessonProgress, moduleProgress);
  const lessonState = state.modules
    .find((m) => m.moduleId === module.id)
    ?.lessons.find((l) => l.lessonId === lessonId)?.state;

  // URL-level authorization, not just hidden links — a locked lesson redirects
  // back to the overview even if someone bookmarks/guesses the URL.
  if (lessonState === "locked") redirect(`/academy/${courseSlug}`);

  const sortedLessons = [...module.lessons].sort((a, b) => a.position - b.position);
  const idx = sortedLessons.findIndex((l) => l.id === lessonId);
  const nextLesson = sortedLessons[idx + 1];
  const nextHref = nextLesson
    ? `/academy/${courseSlug}/lesson/${nextLesson.id}`
    : module.assessment
      ? `/academy/${courseSlug}/module/${module.id}/assessment`
      : `/academy/${courseSlug}`;

  const existingProgress = lessonProgress.get(lessonId);

  return (
    <LessonPlayer
      lesson={{
        id: lesson.id,
        title: lesson.title,
        objective: lesson.objective,
        keyTopics: lesson.keyTopics,
        completionThresholdPct: lesson.completionThresholdPct,
        summaryBlock: lesson.summaryBlock,
      }}
      moduleTitle={module.title}
      alreadyCompleted={!!existingProgress?.completedAt}
      furthestPositionS={existingProgress?.furthestPositionS ?? 0}
      nextHref={nextHref}
    />
  );
}
