export type Course = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  level: "beginner" | "intermediate" | "advanced";
  priceCredits: number;
  status: "draft" | "review" | "published";
  coverImageObjectPath: string | null;
  position: number;
};

export type Module = {
  id: string;
  courseId: string;
  position: number;
  title: string;
  description: string | null;
  unlockRule: "sequential" | "free";
};

export type Lesson = {
  id: string;
  moduleId: string;
  position: number;
  type: "video" | "blocks";
  title: string;
  objective: string | null;
  keyTopics: string[];
  videoObjectPath: string | null;
  posterObjectPath: string | null;
  durationSeconds: number | null;
  completionThresholdPct: number;
  transcript: string | null;
  summaryBlock: string | null;
};

export type Assessment = {
  id: string;
  scope: "module" | "lesson";
  moduleId: string | null;
  lessonId: string | null;
  title: string;
  passThresholdPct: number;
  maxAttempts: number | null;
  retryCooldownSeconds: number;
  shuffleOptions: boolean;
  xpAward: number;
  coinAward: number;
};

export type QuestionOption = { key: string; text: string };

export type QuestionPublic = {
  id: string;
  assessmentId: string;
  position: number;
  stem: string;
  type: "single_select";
  options: QuestionOption[];
  topicTag: string | null;
};

export type LessonProgress = {
  lessonId: string;
  watchedSeconds: number;
  furthestPositionS: number;
  watchedRanges: [number, number][];
  pctWatched: number;
  completedAt: string | null;
};

export type ModuleProgress = {
  moduleId: string;
  lessonsDone: number;
  gatePassedAt: string | null;
  completedAt: string | null;
};

export type ModuleWithContent = Module & { lessons: Lesson[]; assessment: Assessment | null };

export type CourseTree = {
  course: Course;
  modules: ModuleWithContent[];
};

export type LessonState = "locked" | "available" | "current" | "complete";
export type ModuleState = "locked" | "available" | "current" | "complete";
export type ModuleGateState = "locked" | "available" | "passed";

export type ContinueTarget =
  | { kind: "lesson"; lessonId: string; moduleId: string }
  | { kind: "assessment"; assessmentId: string; moduleId: string }
  | { kind: "done" };

export type CourseState = {
  overallPct: number;
  modules: {
    moduleId: string;
    state: ModuleState;
    lessons: { lessonId: string; state: LessonState }[];
    gate: ModuleGateState;
  }[];
  continueTarget: ContinueTarget;
};
