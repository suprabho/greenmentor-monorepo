import { Container } from "@/components/marketing/Container";
import { SectionHeader } from "@/components/marketing/SectionHeader";
import { mentors } from "@/lib/data/mentors";

/**
 * Institutional backers and accreditation badges for the "Backed by & built
 * with" strip (A-2). Logos mirror the trust strip on the live greenmentor.co
 * hero. SVG where available for crisp scaling; raster otherwise.
 */
const backedBy = [
  { name: "IIM Bangalore · NSRCEL", logo: "/brand/badges/iimb-nsrcel.webp" },
  { name: "IIIT-B Innovation Centre", logo: "/brand/badges/iiit-b.svg" },
  { name: "Somaiya Vidyavihar University", logo: "/brand/badges/somaiya.png" },
  { name: "TÜV SÜD", logo: "/brand/badges/tuv-sud.svg" },
  { name: "ISO", logo: "/brand/badges/iso.png" },
  { name: "Greenhouse Gas Protocol", logo: "/brand/badges/ghg-protocol.webp" },
  { name: "GRI Sustainability Disclosure Database", logo: "/brand/badges/gri-sdd.png" },
  { name: "BRSR India", logo: "/brand/badges/brsr-india.png" },
];

const subBrands = [
  {
    name: "Academy",
    tag: "Learn",
    blurb:
      "Community-led, sustainability-focused learning: self-paced courses, expert-led intensives, live coaching, and an AI study copilot — GRI, BRSR, CDP, TCFD, SASB.",
  },
  {
    name: "AI Hub",
    tag: "Report",
    blurb:
      "An AI copilot that automates sustainability compliance workflows — GRI, BRSR, CDP, CBAM, SASB — powered by Longsight, the 1st CBAM-ready tool for European compliance.",
  },
  {
    name: "Jobs & Community",
    tag: "Grow",
    blurb:
      "A curated ESG jobs board plus India's biggest sustainability community — where members get hired, get peer review, and stay current.",
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
          description="We work both sides of the gap. Demand for sustainability professionals is 3× the supply, and ESG compliance (CBAM, SBTi, BRSR, GRI) is complex and ever-changing. We build the talent and automate the workflows."
          className="max-w-2xl"
          align="center"
        />

        {/* A-2 — Backed by & built with: institutional credibility, elevated */}
        <div className="mt-12 rounded-[12px] border border-gray-200 bg-section-fade p-6 md:p-8">
          <p className="gm-eyebrow text-center text-green-700">
            Backed by &amp; built with
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
            {backedBy.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={p.name}
                src={p.logo}
                alt={p.name}
                title={p.name}
                loading="lazy"
                className="h-9 w-auto object-contain"
              />
            ))}
          </div>
        </div>

        {/* Sub-brand lockup */}
        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {subBrands.map((brand) => (
            <div
              key={brand.name}
              className="rounded-[12px] border border-gray-200 bg-white p-7"
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
              external assurance, not someone who can recite the GRI 200
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
            <p className="text-[15px] text-gray-700">
              The practitioners who teach and grade, named here at the point of
              purchase, not buried on a course page.
            </p>
            {/* Auto-scrolling vertical ticker of the mentor roster. The list
                is rendered twice for a seamless loop; the second copy is
                aria-hidden so screen readers and the tab order see each
                mentor once. Pauses on hover; collapses to a static first
                frame under prefers-reduced-motion. */}
            <div className="relative h-[440px] overflow-hidden rounded-[12px] border border-white/10 bg-teal-900 px-3">
              <div className="gm-ticker-mask h-full overflow-hidden">
                <div className="gm-ticker-track py-3">
                  {[...mentors, ...mentors].map((m, i) => (
                    <div
                      key={`${m.name}-${i}`}
                      aria-hidden={i >= mentors.length}
                      className="rounded-[8px] border border-white/10 bg-white/[0.04] p-4"
                    >
                      <div className="flex items-center gap-3">
                        {m.photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={m.photo}
                            alt={m.name}
                            loading="lazy"
                            className="size-9 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <div
                            className="grid size-9 shrink-0 place-items-center rounded-full bg-green-500/15 text-[12px] font-semibold text-green-500"
                            aria-hidden
                          >
                            {m.initials}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-semibold text-white">
                            {m.name}
                          </p>
                          <p className="truncate text-[12px] text-white/55">
                            {m.role}
                          </p>
                        </div>
                      </div>

                      {m.tags.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {m.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full border border-green-500/20 bg-green-500/10 px-2 py-0.5 text-[10px] text-green-100"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      {m.company || m.location ? (
                        <div className="mt-3 flex items-center gap-2 text-[11px] text-green-100/80">
                          <span
                            className="size-1.5 shrink-0 rounded-full bg-green-500"
                            aria-hidden
                          />
                          <span className="truncate">
                            {m.company}
                            {m.company && m.location ? " · " : ""}
                            {!m.company && m.location ? m.location : ""}
                            {m.company && m.location ? m.location : ""}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Contact */}
        <div
          id="contact"
          className="mt-12 rounded-[12px] bg-section-fade p-8 md:p-10"
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
