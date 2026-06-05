import { guarantee } from "@/lib/data/guarantee";

export interface Faq {
  id: string;
  question: string;
  answer: string;
}

/**
 * Order matters: the home page shows the first N (see FaqSection `limit`), so
 * the highest-leverage trust answers — what's included vs add-on (F-1) and the
 * money-back guarantee (MB-1) — lead the list.
 */
export const faqs: Faq[] = [
  {
    id: "whats-included",
    question: "What exactly is and isn't included in the monthly plan?",
    answer:
      "Your Plus Essential subscription includes all 8 foundational and self-paced courses, bi-weekly live Q&A sessions with practitioners, the 40,000+ member community, weekly industry insights, and the curated ESG jobs feed. Live intensive programs (like Master LCA and ESG Reporting Pro) and certification bundles are available as paid add-ons — they're not part of the base subscription. We show exactly which is which on every course card.",
  },
  {
    id: "refunds",
    question: "What is the 14-day money-back guarantee?",
    answer: guarantee.full,
  },
  {
    id: "membership-vs-courses",
    question: "What changed — isn't this a per-course platform?",
    answer:
      "We've moved to a single subscription. One price unlocks every track — GRI, SASB, CDP, TCFD, BRSR, DJSI, CBAM — plus capstones, live coaching, and the AI copilot. No more buying frameworks one at a time.",
  },
  {
    id: "vs-one-time",
    question: "How is this different from a one-time course purchase?",
    answer:
      "A one-time course gives you one topic. A Plus subscription gives you the full library, live practitioner access, the community, and career support — all updating as ESG regulations evolve. BRSR requirements have changed repeatedly in the last couple of years; your subscription keeps you current, a one-time course doesn't.",
  },
  {
    id: "certification",
    question: "Are the certifications recognized?",
    answer:
      "Yes. Certifications are verifiable, time-stamped, and shareable on LinkedIn. Recruiters from Big-4 advisories and listed companies have hired through them.",
  },
  {
    id: "time-realistic",
    question: "I'm a working professional. Is this realistic to fit in?",
    answer:
      "Most members commit 3–5 hours a week. Courses are self-paced, so you set the schedule, and the bi-weekly live sessions are recorded if you can't attend live. Many members start with a couple of hours on weekends and scale up as they progress.",
  },
  {
    id: "community",
    question: "What is the community side?",
    answer:
      "We run India's biggest ESG community. The community is where weekly office hours, peer review on disclosures, and the job board live. It's the demand-generation engine that powers GM Academy and Longsight.",
  },
  {
    id: "experience-required",
    question: "Do I need a sustainability background?",
    answer:
      "No. The Foundations track is built for newcomers. If you're already filing disclosures, skip straight to framework-specific tracks and capstones.",
  },
  {
    id: "team-pricing",
    question: "Do you offer team plans?",
    answer:
      "Yes. For 5+ seats we run a team plan with shared analytics, cohort kickoffs, and a dedicated coach. Email help@greenmentor.co.",
  },
  {
    id: "payment",
    question: "How does payment work?",
    answer:
      "Payments are handled by our learning partner Learnyst — cards, UPI, and netbanking via Razorpay. You'll complete checkout there after onboarding.",
  },
];
