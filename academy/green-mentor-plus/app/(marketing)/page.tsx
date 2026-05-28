"use client";

import { useEffect } from "react";
import { Hero } from "@/components/marketing/Hero";
import { ProblemSection } from "@/components/marketing/ProblemSection";
import { CoursePreview } from "@/components/marketing/CoursePreview";
import { ValueProps } from "@/components/marketing/ValueProps";
import { HiringCompanies } from "@/components/marketing/HiringCompanies";
import { SocialProof } from "@/components/marketing/SocialProof";
import { AboutSection } from "@/components/marketing/AboutSection";
import { PricingSnapshot } from "@/components/marketing/PricingSnapshot";
import { FaqSection } from "@/components/marketing/FaqSection";
import { FinalCta } from "@/components/marketing/FinalCta";
import { track } from "@/lib/utils/analytics";

/**
 * Greenmentor Plus landing page. Section order follows the v3 narrative:
 * hook + credibility, problem framing, pricing, what you get
 * (courses → ecosystem), outcomes (hiring companies → social proof),
 * who we are (about), FAQ → final CTA.
 */
export default function LandingPage() {
  useEffect(() => {
    track("landing_viewed");
  }, []);

  return (
    <>
      <Hero />
      <ProblemSection />
      <PricingSnapshot />
      <CoursePreview />
      <ValueProps />
      <HiringCompanies />
      <SocialProof />
      <AboutSection />
      <FaqSection limit={6} />
      <FinalCta />
    </>
  );
}
