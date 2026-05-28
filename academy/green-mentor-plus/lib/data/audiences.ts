import type { Icon } from "@phosphor-icons/react";
import {
  GraduationCap,
  Briefcase,
  Buildings,
} from "@phosphor-icons/react/dist/ssr";

export type AudienceSegment = "student" | "mid-career" | "business-leader";

export interface Audience {
  id: AudienceSegment;
  label: string;
  tagline: string;
  description: string;
  icon: Icon;
  cta: string;
}

export const audiences: Audience[] = [
  {
    id: "student",
    label: "Students",
    tagline: "Build a CV recruiters call back",
    description:
      "Sustainability foundations, GRI and CDP basics, and project work you can show recruiters. Pace yourself between classes.",
    icon: GraduationCap,
    cta: "Start as a Student",
  },
  {
    id: "mid-career",
    label: "Mid-career Professionals",
    tagline: "Pivot into ESG with confidence",
    description:
      "Reporting frameworks end-to-end. TCFD climate risk. BRSR for Indian listed entities. Built for working hours.",
    icon: Briefcase,
    cta: "Switch into ESG",
  },
  {
    id: "business-leader",
    label: "Business Leaders",
    tagline: "Lead the program, not the spreadsheet",
    description:
      "Materiality, board-level reporting, and how to brief Big-4 auditors. Strategy first, with frameworks as the toolkit.",
    icon: Buildings,
    cta: "Lead the Program",
  },
];
