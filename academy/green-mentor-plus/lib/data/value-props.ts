import type { Icon } from "@phosphor-icons/react";
import {
  VideoCamera,
  WhatsappLogo,
  Newspaper,
  Briefcase,
  UserCircleCheck,
} from "@phosphor-icons/react/dist/ssr";

export interface ValueProp {
  id: string;
  title: string;
  description: string;
  icon: Icon;
}

/**
 * "What else is included" — the non-course inclusions in the Plus Essential
 * subscription. Used by the home ecosystem section under the course grid.
 */
export const valueProps: ValueProp[] = [
  {
    id: "live-qa",
    title: "Bi-weekly live Q&A",
    description:
      "Sit in with industry practitioners every other week — bring your disclosure draft, leave with the next step.",
    icon: VideoCamera,
  },
  {
    id: "community",
    title: "40,000+ peer community",
    description:
      "The WhatsApp room is the answer key — peers, mentors, and someone who has already filed the thing you're stuck on.",
    icon: WhatsappLogo,
  },
  {
    id: "insights",
    title: "Weekly industry insights",
    description:
      "Curated cases, regulator updates, and what's moving in BRSR, CBAM and CDP — delivered without the noise.",
    icon: Newspaper,
  },
  {
    id: "jobs",
    title: "Curated ESG jobs feed",
    description:
      "A live roll of openings at the firms hiring our learners — Tata, EY, KPMG, ReNew, BCG and 45+ more.",
    icon: Briefcase,
  },
  {
    id: "career-guidance",
    title: "Personalised career guidance",
    description:
      "Resume reviews, role mapping, and a clear next step — built into the annual plan, no extra fee.",
    icon: UserCircleCheck,
  },
];
