import type { Icon } from "@phosphor-icons/react";
import {
  Books,
  ClockCountdown,
  UsersThree,
  Briefcase,
} from "@phosphor-icons/react/dist/ssr";

export interface PainPoint {
  id: string;
  title: string;
  description: string;
  /** "Sound familiar?" micro-copy — a specific, visceral scenario (P-2). */
  echo: string;
  /** Short, bold fix headline shown in the solution-state card (≤3 words). */
  solutionTitle: string;
  /** How GreenMentor closes this trap — powers the SolutionSection (G-3). */
  solution: string;
  icon: Icon;
}

/**
 * Four pain cards used in the home "Problem" section. The framing is:
 * learners aren't stuck on effort, they're stuck on structure.
 *
 * Each card carries its own `solution`, so the "How we solve it" section
 * (SolutionSection / G-3) stays aligned with the problem it answers.
 */
export const painPoints: PainPoint[] = [
  {
    id: "too-much-theory",
    title: "Too much theory",
    description:
      "Frameworks without the practical skills to apply them on the job.",
    echo: "You've read the GRI standards. You still don't know how to file.",
    solutionTitle: "Graded by practitioners",
    solution:
      "Every module ships with assignments graded by practitioners with real filing experience.",
    icon: Books,
  },
  {
    id: "no-clear-path",
    title: "No clear path",
    description:
      "No guidance on which skills matter, in which order, for which role.",
    echo: "You've started 4 courses. Finished none.",
    solutionTitle: "Role-based tracks",
    solution:
      "Role-based learning tracks: ESG Analyst, Reporting Lead, Sustainability Manager.",
    icon: ClockCountdown,
  },
  {
    id: "learning-alone",
    title: "Learning alone",
    description:
      "No community, no one to ask when you get stuck halfway through.",
    echo: "You Googled it. Got 12 conflicting answers.",
    solutionTitle: "Community + live Q&A",
    solution:
      "A 40,000+ member community plus bi-weekly live Q&A. Ask, get answered in hours, not weeks.",
    icon: UsersThree,
  },
  {
    id: "gap-to-jobs",
    title: "Gap to jobs",
    description:
      "Completing courses but not landing opportunities at the firms hiring.",
    echo: "Your CV says ESG. Recruiters still pass.",
    solutionTitle: "Jobs + career services",
    solution:
      "Curated jobs feed plus Career Services (annual): mock interviews and placement support.",
    icon: Briefcase,
  },
];
