import { LEARNYST_COURSES_URL } from "@/lib/learnyst/config";

/**
 * Course taxonomy used in two places:
 *  - Home `CoursePreview` (compact grid with lesson count + standalone price)
 *  - `/courses` library page (full card with framework + duration + level)
 *
 * The course list is the v3 reframe: 8 named courses, each available
 * standalone but bundled into the single Plus Essential subscription.
 */

export type Framework =
  | "ESG & BRSR"
  | "ESG Strategy"
  | "GHG Accounting"
  | "Materiality"
  | "LCA"
  | "CBAM"
  | "Circularity"
  | "ESG Tools";

export interface Course {
  id: string;
  title: string;
  framework: Framework;
  description: string;
  /** Display string for the `/courses` library cards, e.g. "23 lessons". */
  duration: string;
  /** Number of lessons. Powers the home preview card meta line. */
  lessons: number;
  /** Standalone INR price; null = included with subscription only. */
  standalonePrice: number | null;
  level: "Foundation" | "Intermediate" | "Advanced";
  // TODO[Learnyst]: replace with per-course Learnyst URLs once migrated.
  learnystUrl: string;
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
    level: "Foundation",
    learnystUrl: `${LEARNYST_COURSES_URL}/fundamentals-esg-brsr`,
  },
  {
    id: "esg-readiness",
    title: "ESG Readiness",
    framework: "ESG Strategy",
    description:
      "Build an ESG program from scratch — governance, materiality, KPIs, and the rollout plan that actually survives Q1.",
    duration: "30 lessons",
    lessons: 30,
    standalonePrice: 6999,
    level: "Intermediate",
    learnystUrl: `${LEARNYST_COURSES_URL}/esg-readiness`,
  },
  {
    id: "ghg-accounting-mastery",
    title: "GHG Accounting Mastery",
    framework: "GHG Accounting",
    description:
      "Scope 1, 2 and 3 from first principles — ISO 14064-aligned, with the spreadsheets and audit trail your assurance partner will accept.",
    duration: "25 lessons",
    lessons: 25,
    standalonePrice: 6999,
    level: "Intermediate",
    learnystUrl: `${LEARNYST_COURSES_URL}/ghg-accounting-mastery`,
  },
  {
    id: "materiality-assessment-mastery",
    title: "Materiality Assessment Mastery",
    framework: "Materiality",
    description:
      "Run a double-materiality assessment your board can defend — stakeholder mapping, scoring, and the disclosure that comes out the other side.",
    duration: "21 lessons",
    lessons: 21,
    standalonePrice: 5999,
    level: "Intermediate",
    learnystUrl: `${LEARNYST_COURSES_URL}/materiality-assessment-mastery`,
  },
  {
    id: "lca-mastery",
    title: "Life Cycle Assessment Mastery",
    framework: "LCA",
    description:
      "ISO 14040/14044 LCA — goal & scope, inventory, impact assessment, interpretation — on real product systems, not toy examples.",
    duration: "15 lessons",
    lessons: 15,
    standalonePrice: 5999,
    level: "Advanced",
    learnystUrl: `${LEARNYST_COURSES_URL}/lca-mastery`,
  },
  {
    id: "cbam-mastery",
    title: "CBAM Mastery Course",
    framework: "CBAM",
    description:
      "CBAM scope, embedded emissions, and how to ready your supply chain for the European compliance bar before the levy kicks in.",
    duration: "18 lessons",
    lessons: 18,
    standalonePrice: 10000,
    level: "Advanced",
    learnystUrl: `${LEARNYST_COURSES_URL}/cbam-mastery`,
  },
  {
    id: "circularity-mastery",
    title: "Circularity Mastery",
    framework: "Circularity",
    description:
      "Circular design, business model patterns, and the metrics — including the Indian regulatory hooks — that turn circularity from buzzword to roadmap.",
    duration: "37 lessons",
    lessons: 37,
    standalonePrice: 6999,
    level: "Intermediate",
    learnystUrl: `${LEARNYST_COURSES_URL}/circularity-mastery`,
  },
  {
    id: "esg-software-tool-training",
    title: "ESG Software Tool Training",
    framework: "ESG Tools",
    description:
      "Hands-on with the disclosure software hiring teams ask for — data input, mapping, and a clean export ready for assurance.",
    duration: "Included with subscription",
    lessons: 0,
    standalonePrice: null,
    level: "Foundation",
    learnystUrl: `${LEARNYST_COURSES_URL}/esg-software-tool-training`,
  },
];

/**
 * Paid certifications & live workshops sold separately from the subscription.
 * Surfaced in the home page's "courses included" section as a small footer
 * bar so the price story stays clean.
 */
export interface AddOn {
  id: string;
  title: string;
  price: number;
}

export const certificationAddOns: AddOn[] = [
  {
    id: "esg-reporting-pro",
    title: "Become an ESG Reporting Pro",
    price: 35000,
  },
  {
    id: "live-lca-training",
    title: "Live LCA Training",
    price: 20000,
  },
];
