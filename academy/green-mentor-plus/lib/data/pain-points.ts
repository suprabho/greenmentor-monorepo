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
  icon: Icon;
}

/**
 * Four pain cards used in the home "Problem" section. The framing is:
 * learners aren't stuck on effort, they're stuck on structure.
 */
export const painPoints: PainPoint[] = [
  {
    id: "too-much-theory",
    title: "Too much theory",
    description:
      "Frameworks without the practical skills to apply them on the job.",
    icon: Books,
  },
  {
    id: "no-clear-path",
    title: "No clear path",
    description:
      "No guidance on which skills matter, in which order, for which role.",
    icon: ClockCountdown,
  },
  {
    id: "learning-alone",
    title: "Learning alone",
    description:
      "No community, no one to ask when you get stuck halfway through.",
    icon: UsersThree,
  },
  {
    id: "gap-to-jobs",
    title: "Gap to jobs",
    description:
      "Completing courses but not landing opportunities at the firms hiring.",
    icon: Briefcase,
  },
];
