import { notFound, redirect } from "next/navigation";
import { ensureEnrolled, fetchAssessmentQuestions, fetchCourseTree, fetchLearnerProgress } from "@/lib/academy/repo";
import { computeCourseState } from "@/lib/academy/state";
import { createClient } from "@/lib/supabase/server";
import { AssessmentRunner } from "./assessment-runner";

export default async function AssessmentPage({
  params,
}: {
  params: Promise<{ courseSlug: string; moduleId: string }>;
}) {
  const { courseSlug, moduleId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/academy/${courseSlug}/module/${moduleId}/assessment`)}`);

  const tree = await fetchCourseTree(courseSlug);
  if (!tree) notFound();
  await ensureEnrolled(user.id, tree.course.id);

  const module = tree.modules.find((m) => m.id === moduleId);
  if (!module || !module.assessment) notFound();

  const { lessonProgress, moduleProgress } = await fetchLearnerProgress(user.id, tree);
  const state = computeCourseState(tree, lessonProgress, moduleProgress);
  const gate = state.modules.find((m) => m.moduleId === moduleId)?.gate;

  // URL-level authorization: can't reach a gate whose lessons aren't done yet.
  if (gate === "locked") redirect(`/academy/${courseSlug}`);

  const questions = await fetchAssessmentQuestions(module.assessment.id);
  const nextModule = tree.modules.filter((m) => m.position > module.position).sort((a, b) => a.position - b.position)[0];
  const nextModuleFirstLesson = nextModule
    ? [...nextModule.lessons].sort((a, b) => a.position - b.position)[0]
    : undefined;
  const nextHref = nextModuleFirstLesson
    ? `/academy/${courseSlug}/lesson/${nextModuleFirstLesson.id}`
    : `/academy/${courseSlug}`;

  return (
    <AssessmentRunner
      moduleTitle={module.title}
      assessment={{
        id: module.assessment.id,
        title: module.assessment.title,
        shuffleOptions: module.assessment.shuffleOptions,
      }}
      questions={questions}
      alreadyPassed={gate === "passed"}
      overviewHref={`/academy/${courseSlug}`}
      nextHref={nextHref}
    />
  );
}
