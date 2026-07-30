import { Hero } from "@/components/marketing/Hero";
import { ProblemSolutionSection } from "@/components/marketing/ProblemSolutionSection";
import { BundlePreview } from "@/components/marketing/BundlePreview";
import { CoursePreview } from "@/components/marketing/CoursePreview";
import { LandingAnalytics } from "@/components/marketing/LandingAnalytics";
import { ValueProps } from "@/components/marketing/ValueProps";
import { SocialProof } from "@/components/marketing/SocialProof";
import { HiringCompanies } from "@/components/marketing/HiringCompanies";
import { AboutSection } from "@/components/marketing/AboutSection";
import { PricingSnapshot } from "@/components/marketing/PricingSnapshot";
import { TeamSection } from "@/components/marketing/TeamSection";
import { FaqSection } from "@/components/marketing/FaqSection";
import { FinalCta } from "@/components/marketing/FinalCta";
import { fetchCatalog } from "@/lib/academy/catalog";

/**
 * Green Mentor Pro landing page. Ported from green-mentor-plus, repositioned for
 * the unified platform. Section order follows the Pain → Solution → Proof →
 * Price → CTA sequence.
 *
 * A Server Component so the course catalog is read on the server and ships in
 * the initial HTML. The view event lives in <LandingAnalytics />. No SSG is lost:
 * (marketing)/layout.tsx already calls supabase.auth.getUser(), so this segment
 * renders dynamically either way.
 */
export default async function LandingPage() {
  const catalog = await fetchCatalog();

  return (
    <>
      <LandingAnalytics />
      <Hero />
      <ProblemSolutionSection />
      <HiringCompanies />
      <CoursePreview courses={catalog.courses} />
      <BundlePreview bundles={catalog.bundles} />
      <ValueProps />
      <SocialProof />
      <AboutSection />
      {/* Courses only — bundles are priced separately and are not part of the
          subscription, so counting them would double-count their members. */}
      <PricingSnapshot courses={catalog.courses} />
      <TeamSection />
      <FaqSection limit={8} />
      <FinalCta />
    </>
  );
}
