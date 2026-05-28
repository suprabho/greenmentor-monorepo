import { Container } from "@/components/marketing/Container";
import { SectionHeader } from "@/components/marketing/SectionHeader";

const subBrands = [
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
];

/**
 * "Who we are" — the parent-brand story, sub-brand lockup, philosophy,
 * mentors, and contact. Folded onto the landing page from the former
 * /about route so the whole narrative lives on one page.
 */
export function AboutSection() {
  return (
    <section id="about" className="bg-white py-24 md:py-28">
      <Container width="wide">
        <SectionHeader
          label="About"
          title={
            <>
              The world&apos;s first AI-powered, community-driven{" "}
              <span className="text-green-700">ESG platform.</span>
            </>
          }
          description="We work both sides of the gap. Demand for sustainability professionals is 3× the supply, and ESG compliance — CBAM, SBTi, BRSR, GRI — is complex and ever-changing. We build the talent and automate the workflows."
          className="max-w-2xl"
        />

        {/* Sub-brand lockup */}
        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {subBrands.map((brand) => (
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
        </div>

        <div className="mt-16 grid gap-12 md:grid-cols-2">
          {/* Philosophy */}
          <div className="space-y-5 text-[17px] leading-relaxed text-ink">
            <h3 className="gm-section-label text-[24px] text-green-700 md:text-[28px]">
              The Philosophy
            </h3>
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
              feedback from someone who has seen a thousand of them. That is the
              bar.
            </p>
          </div>

          {/* Mentors */}
          <div
            id="mentors"
            className="space-y-5 text-[17px] leading-relaxed text-ink"
          >
            <h3 className="gm-section-label text-[24px] text-green-700 md:text-[28px]">
              Our Mentors
            </h3>
            <div aria-hidden className="gm-section-rule" />
            <p>
              {/* TODO[About]: drop in real mentor bios with photos */}
              Our mentors include a former Big-4 sustainability partner, the
              head of ESG reporting at a Nifty-50 company, and a TCFD-aligned
              climate risk advisor. We name them on the course pages, not in
              marketing copy.
            </p>
          </div>
        </div>

        {/* Contact */}
        <div
          id="contact"
          className="mt-12 rounded-[20px] bg-section-fade p-8 md:p-10"
        >
          <h3 className="gm-section-label text-[24px] text-green-700 md:text-[28px]">
            Get in Touch
          </h3>
          <div aria-hidden className="gm-section-rule mt-3" />
          <p className="mt-5 text-[18px] text-ink">
            Team plans, partnership questions, or a sanity-check on whether
            we&apos;re right for you:{" "}
            <a
              href="mailto:help@greenmentor.co"
              className="font-semibold text-green-700 underline-offset-4 hover:underline"
            >
              help@greenmentor.co
            </a>{" "}
            · +91 8744943433
          </p>
        </div>
      </Container>
    </section>
  );
}
