"use client";

import { useEffect } from "react";
import { Hero } from "@/components/marketing/Hero";
import { ProblemSolutionSection } from "@/components/marketing/ProblemSolutionSection";
import { CoursePreview } from "@/components/marketing/CoursePreview";
import { ValueProps } from "@/components/marketing/ValueProps";
import { SocialProof } from "@/components/marketing/SocialProof";
import { HiringCompanies } from "@/components/marketing/HiringCompanies";
import { AboutSection } from "@/components/marketing/AboutSection";
import { PricingSnapshot } from "@/components/marketing/PricingSnapshot";
import { TeamSection } from "@/components/marketing/TeamSection";
import { FaqSection } from "@/components/marketing/FaqSection";
import { FinalCta } from "@/components/marketing/FinalCta";
import { track } from "@/lib/utils/analytics";

/**
 * Greenmentor Plus landing page. Section order follows the high-converting
 * Pain → Solution → Proof → Price → CTA sequence (G-2): we establish the
 * problem and how we solve it, then lead the proof with hiring credibility
 * (HiringCompanies sits right under ProblemSolution to surface career trust
 * early), before deepening it with courses + testimonials + who-we-are, and
 * only then asking for the commitment (pricing), with a B2B on-ramp and FAQ
 * before the final CTA.
 *
 * Not yet mounted (need real data / a product decision first):
 *   - UrgencyBar (G-6): "@/components/marketing/UrgencyBar". Mount above <Hero/>
 *     ONLY with a genuine upcoming session date + seat count (no fabricated
 *     urgency). It requires real props, so it can't render placeholder data.
 *   - RoadmapCapture (G-5): "@/components/marketing/RoadmapCapture". Drop in
 *     before <FinalCta/> (or wire to an exit-intent trigger) once the actual
 *     ESG Career Roadmap asset exists.
 */
export default function LandingPage() {
  useEffect(() => {
    track("landing_viewed");
  }, []);

  return (
    <>
      <Hero />
      <ProblemSolutionSection />
      <HiringCompanies />
      <CoursePreview />
      <ValueProps />
      <SocialProof />
      <AboutSection />
      <PricingSnapshot />
      <TeamSection />
      <FaqSection limit={8} />
      <FinalCta />
    </>
  );
}
