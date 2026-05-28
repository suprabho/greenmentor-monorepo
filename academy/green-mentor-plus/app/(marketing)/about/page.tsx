import type { Metadata } from "next";
import { Container } from "@/components/marketing/Container";
import { Eyebrow } from "@/components/ui/Badge";
import { FinalCta } from "@/components/marketing/FinalCta";
import { SocialProof } from "@/components/marketing/SocialProof";

export const metadata: Metadata = {
  title: "About",
  description:
    "About Greenmentor — the parent brand, the sub-brands, and what we won't do.",
};

export default function AboutPage() {
  return (
    <>
      <Container width="default" className="pt-16 pb-20 md:pt-24 md:pb-24">
        <article className="space-y-14">
          <header>
            <Eyebrow tone="white">About</Eyebrow>
            <h1 className="font-display mt-8 text-[clamp(40px,6vw,72px)] leading-tight tracking-[-0.02em] text-ink">
              At Greenmentor, we&apos;ve designed the{" "}
              <span className="text-green-700">
                world&apos;s first AI-powered, community-driven platform
              </span>{" "}
              that directly addresses the two critical challenges facing
              businesses today.
            </h1>
            <p className="mt-8 max-w-2xl text-[18px] leading-relaxed text-gray-700 md:text-[20px]">
              Talent shortage and compliance complexity. Demand for
              sustainability professionals is 3× the supply. Sustainability
              and ESG compliance workflows are complex and ever-changing —
              CBAM, SBTi, BRSR, GRI. We work both sides.
            </p>
          </header>

          {/* Sub-brand lockup */}
          <section className="grid gap-4 md:grid-cols-3">
            {[
              {
                name: "GM Academy",
                tag: "Learning",
                blurb:
                  "Community-led, sustainability-focused learning platform. Self-paced plus expert-led plus live coaching plus AI copilot.",
              },
              {
                name: "Longsight",
                tag: "Compliance Software",
                blurb:
                  "AI-powered suite that automates sustainability compliance workflows — GRI, BRSR, CDP, CBAM, SASB. 1st CBAM Ready tool for European compliance.",
              },
              {
                name: "Greenmentor Community",
                tag: "ESG Community",
                blurb:
                  "India's biggest ESG community — the demand-generation engine that feeds Academy and Longsight.",
              },
            ].map((brand) => (
              <div
                key={brand.name}
                className="rounded-[20px] border border-gray-200 bg-white p-7"
              >
                <p className="gm-eyebrow text-green-700">{brand.tag}</p>
                <h3 className="font-accent mt-4 text-[28px] leading-tight text-ink">
                  {brand.name}
                </h3>
                <p className="mt-3 text-[15px] leading-relaxed text-gray-700">
                  {brand.blurb}
                </p>
              </div>
            ))}
          </section>

          <section className="space-y-5 text-[18px] leading-relaxed text-ink">
            <h2 className="gm-section-label text-[28px] text-green-700 md:text-[40px]">
              The Philosophy
            </h2>
            <div aria-hidden className="gm-section-rule" />
            <p>
              Frameworks are a means, not an identity. A sustainability
              practitioner is someone who can write a report that survives
              external assurance — not someone who can recite the GRI 200
              series.
            </p>
            <p>
              Every track is taught by a practitioner with filing experience.
              Every module ships with assignments. Every assignment gets
              feedback from someone who has seen a thousand of them. That is
              the bar.
            </p>
          </section>

          <section
            id="mentors"
            className="space-y-5 text-[18px] leading-relaxed text-ink"
          >
            <h2 className="gm-section-label text-[28px] text-green-700 md:text-[40px]">
              Our Mentors
            </h2>
            <div aria-hidden className="gm-section-rule" />
            <p>
              {/* TODO[About]: drop in real mentor bios with photos */}
              Our mentors include a former Big-4 sustainability partner, the
              head of ESG reporting at a Nifty-50 company, and a TCFD-aligned
              climate risk advisor. We name them on the course pages, not in
              marketing copy.
            </p>
          </section>

          <section
            id="contact"
            className="rounded-[20px] bg-section-fade p-8 md:p-10"
          >
            <h2 className="gm-section-label text-[28px] text-green-700 md:text-[40px]">
              Get in Touch
            </h2>
            <div aria-hidden className="gm-section-rule mt-3" />
            <p className="mt-5 text-[18px] text-ink">
              Team plans, partnership questions, or a sanity-check on whether
              we&apos;re right for you:{" "}
              <a
                href="mailto:sachin@greenmentor.co"
                className="font-semibold text-green-700 underline-offset-4 hover:underline"
              >
                sachin@greenmentor.co
              </a>{" "}
              · +91 8744943433
            </p>
          </section>
        </article>
      </Container>

      <SocialProof />
      <FinalCta />
    </>
  );
}
