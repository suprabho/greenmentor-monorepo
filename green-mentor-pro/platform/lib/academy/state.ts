import type { CourseState, CourseTree, LessonProgress, LessonState, ModuleProgress } from "./types";

/**
 * Derive locked/available/current/complete for every module and lesson, the
 * overall course percentage, and the single "continue" target — purely from
 * content + progress rows, no I/O. Sequencing rule: module i is locked unless
 * its unlock_rule is 'free', it's the first module, or module i-1 is
 * complete; lesson j within an unlocked module is locked unless it's the
 * first lesson or lesson j-1 is complete. "current" marks whichever module
 * contains the continue target.
 */
export function computeCourseState(
  tree: CourseTree,
  lessonProgress: Map<string, LessonProgress>,
  moduleProgress: Map<string, ModuleProgress>
): CourseState {
  const modulesSorted = [...tree.modules].sort((a, b) => a.position - b.position);

  let totalUnits = 0;
  let doneUnits = 0;
  let priorModuleComplete = true; // the first module is always unlocked
  let continueTarget: CourseState["continueTarget"] = { kind: "done" };
  let continueModuleId: string | null = null;
  let foundContinue = false;

  const modules: CourseState["modules"] = modulesSorted.map((m) => {
    const mProgress = moduleProgress.get(m.id);
    const moduleUnlocked = m.unlockRule === "free" || priorModuleComplete;
    const lessonsSorted = [...m.lessons].sort((a, b) => a.position - b.position);

    let priorLessonComplete = true;
    const lessonStates = lessonsSorted.map((lesson) => {
      totalUnits += 1;
      const lp = lessonProgress.get(lesson.id);
      const completed = !!lp?.completedAt;
      if (completed) doneUnits += 1;

      let state: LessonState;
      if (!moduleUnlocked) state = "locked";
      else if (completed) state = "complete";
      else if (priorLessonComplete) state = "available";
      else state = "locked";

      if (!foundContinue && state === "available") {
        continueTarget = { kind: "lesson", lessonId: lesson.id, moduleId: m.id };
        continueModuleId = m.id;
        foundContinue = true;
      }

      priorLessonComplete = completed;
      return { lessonId: lesson.id, state };
    });

    const allLessonsDone =
      lessonsSorted.length > 0 && lessonsSorted.every((lesson) => !!lessonProgress.get(lesson.id)?.completedAt);

    let gate: CourseState["modules"][number]["gate"] = "locked";
    if (m.assessment) {
      totalUnits += 1;
      const gatePassed = !!mProgress?.gatePassedAt;
      if (gatePassed) {
        doneUnits += 1;
        gate = "passed";
      } else if (moduleUnlocked && allLessonsDone) {
        gate = "available";
      }

      if (!foundContinue && gate === "available") {
        continueTarget = { kind: "assessment", assessmentId: m.assessment.id, moduleId: m.id };
        continueModuleId = m.id;
        foundContinue = true;
      }
    }

    const moduleComplete = allLessonsDone && (!m.assessment || gate === "passed");
    let moduleState: CourseState["modules"][number]["state"];
    if (moduleComplete) moduleState = "complete";
    else if (!moduleUnlocked) moduleState = "locked";
    else moduleState = "available";

    priorModuleComplete = moduleComplete;

    return { moduleId: m.id, state: moduleState, lessons: lessonStates, gate };
  });

  // The module holding the continue target is the one to visually highlight.
  if (continueModuleId) {
    const idx = modules.findIndex((m) => m.moduleId === continueModuleId);
    if (idx >= 0 && modules[idx].state === "available") modules[idx].state = "current";
  }

  const overallPct = totalUnits === 0 ? 0 : Math.round((doneUnits / totalUnits) * 100);

  return { overallPct, modules, continueTarget };
}
