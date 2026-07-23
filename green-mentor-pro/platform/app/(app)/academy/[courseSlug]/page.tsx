import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CheckCircle, FlagCheckered, Lock, Play } from "@phosphor-icons/react/dist/ssr";
import { Card, Chip } from "@/components/ui";
import { CourseHero } from "@/components/academy/course-hero";
import { CourseSummaryCard } from "@/components/academy/course-summary-card";
import { fmtDuration, sumDurations } from "@/lib/academy/format";
import { ensureEnrolled, fetchCourseTree, fetchLearnerProgress } from "@/lib/academy/repo";
import { computeCourseState } from "@/lib/academy/state";
import type { CourseState, ModuleWithContent } from "@/lib/academy/types";
import { createClient } from "@/lib/supabase/server";

function primaryHref(courseSlug: string, module: ModuleWithContent, moduleState: CourseState["modules"][number]) {
  const nextLesson = moduleState.lessons.find((l) => l.state === "available" || l.state === "current");
  if (nextLesson) return `/academy/${courseSlug}/lesson/${nextLesson.lessonId}`;
  if (moduleState.gate === "available") return `/academy/${courseSlug}/module/${module.id}/assessment`;
  return null;
}

export default async function CourseOverviewPage({ params }: { params: Promise<{ courseSlug: string }> }) {
  const { courseSlug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/academy/${courseSlug}`)}`);

  const tree = await fetchCourseTree(courseSlug);
  if (!tree) notFound();

  await ensureEnrolled(user.id, tree.course.id);
  const { lessonProgress, moduleProgress } = await fetchLearnerProgress(user.id, tree);
  const state = computeCourseState(tree, lessonProgress, moduleProgress);

  const moduleById = new Map(tree.modules.map((m) => [m.id, m]));
  const continueHref =
    state.continueTarget.kind === "lesson"
      ? `/academy/${courseSlug}/lesson/${state.continueTarget.lessonId}`
      : state.continueTarget.kind === "assessment"
        ? `/academy/${courseSlug}/module/${state.continueTarget.moduleId}/assessment`
        : null;
  const continueLabel = state.overallPct === 0 ? "Start course" : "Continue";

  // "Next up" resolves the continue target to a human title + module label.
  const moduleIndex = new Map(tree.modules.map((m, i) => [m.id, i + 1]));
  let nextUp: { title: string; moduleLabel: string } | null = null;
  if (state.continueTarget.kind === "lesson") {
    const { lessonId, moduleId } = state.continueTarget;
    const lesson = moduleById.get(moduleId)?.lessons.find((l) => l.id === lessonId);
    if (lesson) nextUp = { title: lesson.title, moduleLabel: `Module ${moduleIndex.get(moduleId)}` };
  } else if (state.continueTarget.kind === "assessment") {
    const { moduleId } = state.continueTarget;
    const assessment = moduleById.get(moduleId)?.assessment;
    if (assessment) nextUp = { title: assessment.title, moduleLabel: `Module ${moduleIndex.get(moduleId)}` };
  }

  const allLessons = tree.modules.flatMap((m) => m.lessons);
  const lessonStateById = new Map(state.modules.flatMap((ms) => ms.lessons.map((l) => [l.lessonId, l.state])));
  const lessonsDone = allLessons.filter((l) => lessonStateById.get(l.id) === "complete").length;
  const gatesTotal = tree.modules.filter((m) => m.assessment).length;
  const gatesPassed = state.modules.filter((ms) => ms.gate === "passed").length;
  const remainingDurationS = sumDurations(allLessons.filter((l) => lessonStateById.get(l.id) !== "complete"));

  return (
    <div className="mx-auto max-w-5xl">
      <CourseHero
        course={tree.course}
        moduleCount={tree.modules.length}
        lessonCount={allLessons.length}
        totalDurationS={sumDurations(allLessons)}
        hasGates={gatesTotal > 0}
        overallPct={state.overallPct}
        continueHref={continueHref}
        continueLabel={continueLabel}
      />

      <div className="mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start lg:gap-6">
        <Card className="p-6">
          <h2 className="mb-5 text-[15.5px] font-semibold text-ink">Learning path</h2>

          <div className="space-y-0">
            {state.modules.map((ms, i) => {
              const module = moduleById.get(ms.moduleId)!;
              const isLast = i === state.modules.length - 1;
              const href = primaryHref(courseSlug, module, ms);
              const sortedLessons = [...module.lessons].sort((a, b) => a.position - b.position);
              const moduleDuration = fmtDuration(sumDurations(module.lessons));

              return (
                <div key={ms.moduleId} className="relative flex gap-4 pb-5 last:pb-0">
                  {!isLast && (
                    <span
                      className={`absolute left-[17px] top-9 h-[calc(100%-28px)] w-0.5 ${
                        ms.state === "complete" ? "bg-green-500" : "bg-gray-200"
                      }`}
                    />
                  )}
                  <span
                    className={`z-10 grid size-9 shrink-0 place-items-center rounded-full ${
                      ms.state === "complete"
                        ? "bg-green-500 text-teal-900"
                        : ms.state === "current"
                          ? "bg-teal-900 text-white ring-4 ring-green-100"
                          : ms.state === "available"
                            ? "bg-teal-900 text-white"
                            : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {ms.state === "complete" ? (
                      <CheckCircle size={18} weight="fill" />
                    ) : ms.state === "locked" ? (
                      <Lock size={15} />
                    ) : (
                      <Play size={15} weight="fill" />
                    )}
                  </span>

                  <div
                    className={`flex-1 rounded-2xl border p-4 ${
                      ms.state === "current"
                        ? "border-teal-900 bg-white shadow-soft"
                        : ms.state === "complete"
                          ? "border-gray-100 bg-gray-50/60"
                          : ms.state === "locked"
                            ? "border-gray-100 bg-white opacity-70"
                            : "border-gray-100 bg-white"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-[11.5px] font-semibold uppercase tracking-wide text-gray-500">
                          Module {i + 1}
                        </div>
                        <div className="text-[14.5px] font-semibold text-ink">{module.title}</div>
                        <div className="mt-0.5 text-[12px] text-gray-600">
                          {module.lessons.length} lesson{module.lessons.length === 1 ? "" : "s"}
                          {moduleDuration ? ` · ~${moduleDuration}` : ""}
                          {module.assessment ? " · gate quiz" : ""}
                        </div>
                      </div>
                      {href && (
                        <Link
                          href={href}
                          className="flex items-center gap-1.5 rounded-pill bg-teal-900 px-4 py-2 text-[12.5px] font-semibold text-white"
                        >
                          {ms.state === "current" ? "Resume" : "Start"} <ArrowRight size={13} weight="bold" />
                        </Link>
                      )}
                      {ms.state === "complete" && <Chip tone="green">Complete</Chip>}
                    </div>

                    <ul className="mt-3 space-y-1.5 border-t border-gray-100 pt-3">
                      {sortedLessons.map((lesson) => {
                        const ls = ms.lessons.find((x) => x.lessonId === lesson.id)!;
                        const locked = ls.state === "locked";
                        const duration = fmtDuration(lesson.durationSeconds);
                        return (
                          <li key={lesson.id} className="flex items-center gap-2 text-[12.5px]">
                            {ls.state === "complete" ? (
                              <CheckCircle size={14} weight="fill" className="shrink-0 text-green-500" />
                            ) : locked ? (
                              <Lock size={12} className="shrink-0 text-gray-400" />
                            ) : (
                              <Play size={12} weight="fill" className="shrink-0 text-teal-800" />
                            )}
                            {locked ? (
                              <span className="text-gray-400">{lesson.title}</span>
                            ) : (
                              <Link
                                href={`/academy/${courseSlug}/lesson/${lesson.id}`}
                                className="text-ink hover:underline"
                              >
                                {lesson.title}
                              </Link>
                            )}
                            {duration && (
                              <span className="ml-auto shrink-0 text-[11px] tabular-nums text-gray-400">
                                {duration}
                              </span>
                            )}
                          </li>
                        );
                      })}
                      {module.assessment && (
                        <li className="flex items-center gap-2 text-[12.5px]">
                          {ms.gate === "passed" ? (
                            <CheckCircle size={14} weight="fill" className="shrink-0 text-green-500" />
                          ) : ms.gate === "locked" ? (
                            <Lock size={12} className="shrink-0 text-gray-400" />
                          ) : (
                            <FlagCheckered size={12} className="shrink-0 text-teal-800" />
                          )}
                          {ms.gate === "locked" ? (
                            <span className="text-gray-400">{module.assessment.title}</span>
                          ) : (
                            <Link
                              href={`/academy/${courseSlug}/module/${ms.moduleId}/assessment`}
                              className="text-ink hover:underline"
                            >
                              {module.assessment.title}
                            </Link>
                          )}
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="hidden lg:sticky lg:top-8 lg:block">
          <CourseSummaryCard
            summary={{
              overallPct: state.overallPct,
              nextUp,
              continueHref,
              continueLabel,
              lessonsDone,
              lessonsTotal: allLessons.length,
              gatesPassed,
              gatesTotal,
              remainingDurationS,
            }}
          />
        </div>
      </div>

      {/* Mobile sticky continue bar — sits above the bottom tab bar */}
      {continueHref && (
        <div className="fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-10 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <div className="text-[12px] font-semibold text-gray-600">{state.overallPct}% complete</div>
            <Link
              href={continueHref}
              className="flex items-center gap-2 rounded-pill bg-green-500 px-5 py-2.5 text-[13px] font-bold text-teal-900"
            >
              {continueLabel} <ArrowRight size={14} weight="bold" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
