import type { Metadata } from "next";
import { PricingSnapshot } from "@/components/marketing/PricingSnapshot";
import { FaqSection } from "@/components/marketing/FaqSection";
import { FinalCta } from "@/components/marketing/FinalCta";
import { Container } from "@/components/marketing/Container";
import { Eyebrow } from "@/components/ui/Badge";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "One subscription, the whole ESG library. Affordable for Consultants & SMEs.",
};

export default function PricingPage() {
  return (
    <>
      <Container width="wide" className="pt-16 pb-2 md:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow tone="white">Membership</Eyebrow>
          <h1 className="font-display mt-8 text-[clamp(40px,6vw,72px)] leading-tight tracking-[-0.02em] text-ink">
            Simple pricing.{" "}
            <span className="text-green-700">Whole library.</span>
          </h1>
          <p className="mt-6 text-[18px] leading-relaxed text-gray-700 md:text-[20px]">
            We used to charge per course. Then we got tired of telling people
            they&apos;d need three SKUs to learn one job. So we switched.
          </p>
        </div>
      </Container>

      <PricingSnapshot compact />
      <FaqSection limit={5} />
      <FinalCta />
    </>
  );
}
