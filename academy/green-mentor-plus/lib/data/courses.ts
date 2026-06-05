import { LEARNYST_COURSES_URL } from "@/lib/learnyst/config";

/**
 * Course taxonomy powering the home `CoursePreview` grid (lesson count + price).
 *
 * The list mirrors the five live Learnyst courses. Each is sold standalone;
 * the foundational three are also bundled into the Plus Essential subscription,
 * while the two premium programs (Live LCA, ESG Reporting Pro) are paid extras.
 */

export type Framework =
  | "ESG & BRSR"
  | "GHG Accounting"
  | "ESG Strategy"
  | "LCA"
  | "ESG Reporting";

export interface Course {
  id: string;
  title: string;
  framework: Framework;
  description: string;
  /** Display string for course cards, e.g. "23 lessons". */
  duration: string;
  /** Number of lessons. Powers the preview card meta line. */
  lessons: number;
  /** Standalone INR price; null = included with subscription only. */
  standalonePrice: number | null;
  /**
   * True = bundled into the Plus Essential subscription; false = a paid add-on
   * bought on top of the subscription. Drives the included/add-on badge (C-2).
   */
  included: boolean;
  /** One-line outcome — what you can DO after the course, not its topic (C-3). */
  outcome: string;
  level: "Foundation" | "Intermediate" | "Advanced";
  /** Full per-course page on academy.greenmentor.co/learn (see LEARNYST_COURSES_URL). */
  learnystUrl: string;
  /**
   * Card thumbnail. Currently a generated placeholder in /public/courses.
   * TODO[assets]: swap each file for the real Learnyst banner (keep the path).
   */
  image: string;
}

export const courses: Course[] = [
  {
    id: "fundamentals-esg-brsr",
    title: "Fundamentals of ESG & BRSR",
    framework: "ESG & BRSR",
    description:
      "The vocabulary, the actors, the regulations — and a working knowledge of the BRSR framework Indian listed entities file under.",
    duration: "23 lessons",
    lessons: 23,
    standalonePrice: 999,
    included: true,
    outcome:
      "Master GRI, BRSR, SASB and CDP — the frameworks employers hire for.",
    level: "Foundation",
    learnystUrl: `${LEARNYST_COURSES_URL}/Intro-to-ESG-and-BRSR`,
    image: "/courses/fundamentals-esg-brsr.svg",
  },
  {
    id: "ghg-accounting-mastery",
    title: "GHG Accounting Mastery in 20 Hours",
    framework: "GHG Accounting",
    description:
      "Scope 1, 2 and 3 from first principles — ISO 14064-aligned, with the spreadsheets and audit trail your assurance partner will accept.",
    duration: "22 lessons",
    lessons: 22,
    standalonePrice: 6999,
    included: true,
    outcome:
      "Calculate Scope 1, 2 and 3 emissions and lead your org's carbon disclosure.",
    level: "Intermediate",
    learnystUrl: `${LEARNYST_COURSES_URL}/GHG-Accounting-101`,
    image: "/courses/ghg-accounting-mastery.svg",
  },
  {
    id: "esg-readiness",
    title: "ESG Readiness",
    framework: "ESG Strategy",
    description:
      "Build an ESG program from scratch — governance, materiality, KPIs, and the rollout plan that actually survives Q1.",
    duration: "28 lessons",
    lessons: 28,
    standalonePrice: 6999,
    included: true,
    outcome: "Build a board-ready ESG strategy from scratch.",
    level: "Intermediate",
    learnystUrl: `${LEARNYST_COURSES_URL}/ESG-Readiness`,
    image: "/courses/esg-readiness.svg",
  },
  {
    id: "live-lca-training",
    title: "Live Training — Master Life Cycle Assessment (LCA)",
    framework: "LCA",
    description:
      "Live, instructor-led LCA — work a real product system through ISO 14040/14044 (goal & scope, inventory, impact assessment, interpretation) with direct feedback on your model.",
    duration: "1 lesson",
    lessons: 1,
    standalonePrice: 20000,
    included: false,
    outcome: "Conduct a full life cycle assessment — ISO 14040/44 compliant.",
    level: "Advanced",
    learnystUrl: `${LEARNYST_COURSES_URL}/Live-Training---Master-Life-Cycle-Assessment-LCA-`,
    image: "/courses/live-lca-training.svg",
  },
  {
    id: "esg-reporting-pro",
    title: "Become an ESG Reporting Pro",
    framework: "ESG Reporting",
    description:
      "A four-week intensive that takes you from data to a defensible ESG report — disclosure structure, the evidence trail, and the review cycle assurance partners expect.",
    duration: "2 lessons",
    lessons: 2,
    standalonePrice: 35000,
    included: false,
    outcome: "File a GRI/BRSR report that survives external assurance.",
    level: "Advanced",
    learnystUrl: `${LEARNYST_COURSES_URL}/Become-an-ESG-Reporting-Pro`,
    image: "/courses/esg-reporting-pro.svg",
  },
];
