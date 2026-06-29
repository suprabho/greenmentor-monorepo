import type { Icon } from "@phosphor-icons/react";
import { GraduationCap, Briefcase, Buildings } from "@phosphor-icons/react";
import type { AudienceSegment } from "@/lib/store/onboarding";

// Content ported from academy/green-mentor-plus (lib/data/{audiences,goals,plans}).
export interface Audience {
  id: AudienceSegment;
  label: string;
  tagline: string;
  description: string;
  icon: Icon;
}

export const audiences: Audience[] = [
  {
    id: "student",
    label: "Students",
    tagline: "Build a CV recruiters call back",
    description:
      "Sustainability foundations, GRI and CDP basics, and project work you can show recruiters. Pace yourself between classes.",
    icon: GraduationCap,
  },
  {
    id: "mid-career",
    label: "Mid-career Professionals",
    tagline: "Pivot into ESG with confidence",
    description:
      "Reporting frameworks end-to-end. TCFD climate risk. BRSR for Indian listed entities. Built for working hours.",
    icon: Briefcase,
  },
  {
    id: "business-leader",
    label: "Business Leaders",
    tagline: "Lead the program, not the spreadsheet",
    description:
      "Materiality, board-level reporting, and how to brief Big-4 auditors. Strategy first, with frameworks as the toolkit.",
    icon: Buildings,
  },
];

export interface Goal {
  id: string;
  label: string;
}

export const goals: Goal[] = [
  { id: "career-pivot", label: "Pivot My Career into ESG" },
  { id: "framework-mastery", label: "Master Reporting Frameworks" },
  { id: "csr-strategy", label: "Build a CSR Strategy at My Company" },
  { id: "disclosure-readiness", label: "Get Disclosure-ready" },
  { id: "certification", label: "Earn a Recognized Certification" },
  { id: "cv-projects", label: "Add ESG Projects to My CV" },
  { id: "team-upskilling", label: "Upskill My Team" },
  { id: "exploration", label: "Just Exploring the Space" },
];

export interface Plan {
  id: string;
  name: string;
  tagline: string;
  priceMonthly: number; // ₹ per month, billed monthly
  priceAnnualTotal: number; // ₹ billed once annually
}

export const plan: Plan = {
  id: "membership",
  name: "GM Academy Plus Essential",
  tagline: "Full access to courses, frameworks, the AI Hub, and the community.",
  priceMonthly: 4000,
  priceAnnualTotal: 44000,
};

export const annualSavingsPercent = 8;
