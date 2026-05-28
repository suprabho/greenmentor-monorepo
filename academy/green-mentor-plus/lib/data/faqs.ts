export interface Faq {
  id: string;
  question: string;
  answer: string;
}

export const faqs: Faq[] = [
  {
    id: "membership-vs-courses",
    question: "What changed — isn't this a per-course platform?",
    answer:
      "We've moved to a single subscription. One price unlocks every track — GRI, SASB, CDP, TCFD, BRSR, DJSI, CBAM — plus capstones, live coaching, and the AI copilot. No more buying frameworks one at a time.",
  },
  {
    id: "experience-required",
    question: "Do I need a sustainability background?",
    answer:
      "No. The Foundations track is built for newcomers. If you're already filing disclosures, skip straight to framework-specific tracks and capstones.",
  },
  {
    id: "certification",
    question: "Are the certifications recognized?",
    answer:
      "Yes. Certifications are verifiable, time-stamped, and shareable on LinkedIn. Recruiters from Big-4 advisories and listed companies have hired through them.",
  },
  {
    id: "time-commitment",
    question: "How much time do I need each week?",
    answer:
      "Plan for 3–5 hours a week to finish a track in a quarter. Heavier during the capstone, lighter during Foundations. You set the pace.",
  },
  {
    id: "community",
    question: "What is the community side?",
    answer:
      "We run India's biggest ESG community. The community is where weekly office hours, peer review on disclosures, and the job board live. It's the demand-generation engine that powers GM Academy and Longsight.",
  },
  {
    id: "refunds",
    question: "What if it isn't for me?",
    answer:
      "Cancel anytime before your next billing cycle. We don't lock annual plans behind a no-refund wall — if it's not working in the first 14 days, write to us.",
  },
  {
    id: "team-pricing",
    question: "Do you offer team plans?",
    answer:
      "Yes. For 5+ seats we run a team plan with shared analytics, cohort kickoffs, and a dedicated coach. Email sachin@greenmentor.co.",
  },
  {
    id: "payment",
    question: "How does payment work?",
    answer:
      "Payments are handled by our learning partner Learnyst — cards, UPI, and netbanking via Razorpay. You'll complete checkout there after onboarding.",
  },
];
