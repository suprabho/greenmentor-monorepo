/**
 * Authored player content: modules, lessons, assessments, enrolments and both
 * progress tables all hang off this. Only courses that actually run in the
 * in-app player have one — see CatalogCourse for the merchandising record.
 */
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

export type CatalogDelivery = "self_paced" | "live";
export type CatalogHost = "in_app" | "learnyst";
export type CatalogLevel = "beginner" | "foundation" | "intermediate" | "advanced";

/**
 * The merchandising record for a course we sell — what the marketing grid, the
 * live-training cards and the bundle render. Most of these live on Learnyst and
 * have no player content here at all, so this is deliberately NOT `Course`:
 * there is no id, no track, no modules, and `courseUrl` may leave the app.
 *
 * `framework` is free text — the taxonomy is marketing's to rename.
 */
export type CatalogCourse = {
  slug: string;
  delivery: CatalogDelivery;
  hostedOn: CatalogHost;
  title: string;
  framework: string;
  level: CatalogLevel;
  description: string;
  outcome: string;
  moduleCount: number | null;
  lessonCount: number | null;
  /** Verbatim display string — "~67 min", "9.5 hours", "4 days". */
  durationLabel: string | null;
  /** Standalone INR list price. 0 = free, null = not sold standalone. */
  priceInr: number | null;
  includedInPlus: boolean;
  /** Absolute Learnyst URL, or an internal path when hostedOn is "in_app". */
  courseUrl: string;
  nextCohortAt: string | null;
  nextCohortLabel: string | null;
  instructors: string[];
  coverImageUrl: string | null;
  position: number;
};

export type BundleCatalogEntry = {
  name: string;
  description: string;
  learnystUrl: string;
  courses: CatalogCourse[];
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
