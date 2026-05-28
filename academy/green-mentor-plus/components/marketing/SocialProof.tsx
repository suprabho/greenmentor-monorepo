import { LinkedinLogo } from "@phosphor-icons/react/dist/ssr";
import { Container } from "@/components/marketing/Container";
import { SectionHeader } from "@/components/marketing/SectionHeader";
import { StatBand } from "@/components/marketing/StatBand";
import { testimonials } from "@/lib/data/testimonials";

export function SocialProof() {
  return (
    <section className="bg-white py-24 md:py-28">
      <Container width="wide">
        <SectionHeader
          label="What learners say"
          title={
            <>
              Real people.{" "}
              <span className="text-green-700">Real results.</span>
            </>
          }
          description="The community is the platform — and it shows up in the disclosure work, the placements, and the conversations our learners have on LinkedIn."
        />

        <StatBand
          className="mt-16"
          stats={[
            { number: "5,000+", caption: "Professionals trained" },
            { number: "40,000+", caption: "ESG learners community" },
            { number: "10+", caption: "Live ESG courses" },
            { number: "50+", caption: "Companies hiring" },
          ]}
        />

        <div className="mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t) => (
            <figure
              key={t.name}
              className="flex flex-col rounded-[20px] border border-gray-200 bg-white p-7"
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

              <a
                href={t.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center gap-1.5 text-[12px] font-semibold text-green-700 hover:text-green-700/80"
              >
                <LinkedinLogo size={14} weight="fill" /> View on LinkedIn
              </a>
            </figure>
          ))}
        </div>
      </Container>
    </section>
  );
}
