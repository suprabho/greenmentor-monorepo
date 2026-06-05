import { LinkedinLogo } from "@phosphor-icons/react/dist/ssr";
import { Container } from "@/components/marketing/Container";
import { SectionHeader } from "@/components/marketing/SectionHeader";
import { testimonials } from "@/lib/data/testimonials";

export function SocialProof() {
  return (
    <section className="bg-white py-24 md:py-28">
      <Container width="wide">
        <SectionHeader
          label="What members say"
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

        <div className="mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t) => (
            <a
              key={t.name}
              href={t.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`View ${t.name} on LinkedIn`}
              className="group flex flex-col rounded-lg border border-gray-200 bg-white p-7 transition hover:-translate-y-0.5 hover:border-green-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700 focus-visible:ring-offset-2"
            >
              <div className="flex items-center gap-3">
                <span
                  className="grid size-10 shrink-0 place-items-center rounded-full bg-green-100 text-[13px] font-semibold text-green-700"
                  aria-hidden
                >
                  {t.initials}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-bold text-ink">
                    {t.name}
                  </p>
                  <p className="truncate text-[12px] text-gray-500">
                    {t.role}
                  </p>
                </div>
              </div>

              <blockquote className="mt-5 flex-1 text-[15px] leading-relaxed text-gray-700 italic">
                &ldquo;{t.quote}&rdquo;
              </blockquote>

              <span className="mt-5 inline-flex items-center gap-1.5 text-[12px] font-semibold text-green-700 group-hover:text-green-700/80">
                <LinkedinLogo size={14} weight="fill" /> View on LinkedIn
              </span>
            </a>
          ))}
        </div>
      </Container>
    </section>
  );
}
