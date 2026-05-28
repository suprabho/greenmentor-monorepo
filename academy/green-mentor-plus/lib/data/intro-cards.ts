import type { Icon } from "@phosphor-icons/react";
import {
  UsersThree,
  Books,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr";

export interface IntroCard {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
  icon: Icon;
}

export const introCards: IntroCard[] = [
  {
    id: "who",
    eyebrow: "Who it's for",
    title: "Built for the next generation of ESG talent.",
    body: "Students, working professionals, and business leaders building serious sustainability skills — without the fluff.",
    bullets: [
      "Students aiming for a recruiter-ready CV",
      "Mid-career pros pivoting into ESG",
      "Founders & leaders shaping their first ESG program",
    ],
    icon: UsersThree,
  },
  {
    id: "what",
    eyebrow: "What's inside",
    title: "Every course you need. One subscription.",
    body: "Plus Essential bundles the full course library, live expert sessions and career tools that map to how real ESG teams actually work.",
    bullets: [
      "8 courses — BRSR, CBAM, GHG, LCA and more",
      "Bi-weekly live Q&A with practitioners",
      "Weekly industry insights & case studies",
    ],
    icon: Books,
  },
  {
    id: "why",
    eyebrow: "Why Plus Essential",
    title: "The community is the part that moves careers.",
    body: "One subscription unlocks the 40,000+ learner network plus the mentorship and jobs feed that turn knowledge into outcomes.",
    bullets: [
      "40,000+ learner WhatsApp community",
      "Curated ESG jobs feed — Tata, EY, ReNew & 50+ more",
      "Personalised career guidance & resume review",
    ],
    icon: Sparkle,
  },
];
