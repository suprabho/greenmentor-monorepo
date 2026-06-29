import type { CSSProperties } from "react";
import { LinkedinLogo } from "@phosphor-icons/react/dist/ssr";
import { Container } from "@/components/marketing/Container";
import { SectionHeader } from "@/components/marketing/SectionHeader";
import { testimonials, type Testimonial } from "@/lib/data/testimonials";

/** A single testimonial card, sized for the horizontal marquee track. */
function TestimonialCard({ t }: { t: Testimonial }) {
  return (
    <a
      href={t.linkedinUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`View ${t.name} on LinkedIn`}
      className="group flex w-[340px] shrink-0 flex-col rounded-lg border border-gray-200 bg-white p-7 transition hover:-translate-y-0.5 hover:border-green-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700 focus-visible:ring-offset-2"
    >
      <div className="flex items-center gap-3">
        {t.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={t.photo}
            alt={t.name}
            loading="lazy"
            className="size-10 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span
            className="grid size-10 shrink-0 place-items-center rounded-full bg-green-100 text-[13px] font-semibold text-green-700"
            aria-hidden
          >
            {t.initials}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-[14px] font-bold text-ink">{t.name}</p>
          <p className="truncate text-[12px] text-gray-500">{t.role}</p>
        </div>
      </div>

      <blockquote className="mt-5 flex-1 text-[15px] leading-relaxed text-gray-700 italic">
        &ldquo;{t.quote}&rdquo;
      </blockquote>

      <span className="mt-5 inline-flex items-center gap-1.5 text-[12px] font-semibold text-green-700 group-hover:text-green-700/80">
        <LinkedinLogo size={14} weight="fill" /> View on LinkedIn
      </span>
    </a>
  );
}

export function SocialProof() {
  return (
    <section className="bg-white py-24 md:py-28">
      <Container width="wide">
        <SectionHeader
          label="What members say"
          align="center"
          title={
            <>
              From first course to{" "}
              <span className="text-green-700">career momentum.</span>
            </>
          }
          description="Across disclosure work, certifications, and new roles, our members show up in the ESG conversations happening on LinkedIn every week."
        />

        {/* T-3 — single pull-quote replaces the repeated hero stat band. The 3×
            demand-vs-supply line mirrors the figure used in the About section. */}

        {/* Continuously-scrolling testimonial row — reuses the gm-marquee
            system (HiringCompanies). The group is duplicated (copy is
            aria-hidden) so the loop is seamless; pauses on hover and collapses
            to a static first frame under prefers-reduced-motion. */}
        <div className="gm-marquee-mask mt-16 overflow-hidden">
          <div
            className="gm-marquee-track"
            style={{ "--gm-marquee-duration": "60s" } as CSSProperties}
          >
            {[0, 1].map((copy) => (
              <div
                key={copy}
                className="flex shrink-0 items-stretch gap-5"
                aria-hidden={copy === 1}
              >
                {testimonials.map((t) => (
                  <TestimonialCard key={t.name} t={t} />
                ))}
              </div>
            ))}
          </div>
        </div>
        <figure className="mx-auto mt-16 max-w-3xl text-center">
          <blockquote className="font-display text-[28px] leading-snug tracking-[-0.02em] text-ink md:text-[36px]">
            &ldquo;Demand for ESG professionals in India is{" "}
            <span className="text-green-700">3× the supply.</span> GreenMentor is
            where that supply gets built.&rdquo;
          </blockquote>
          <figcaption className="mt-5 text-[14px] text-gray-500">
            GreenMentor, built with IIM Bangalore (NSRCEL) &amp; IIT-B
            Innovation Centre
          </figcaption>
        </figure>
      </Container>
    </section>
  );
}
