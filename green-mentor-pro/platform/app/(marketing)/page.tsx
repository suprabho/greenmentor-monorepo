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
 * Green Mentor Pro landing page. Ported from green-mentor-plus, repositioned for
 * the unified platform. Section order follows the Pain → Solution → Proof →
 * Price → CTA sequence.
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
