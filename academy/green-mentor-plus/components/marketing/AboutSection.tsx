import { LinkedinLogo } from "@phosphor-icons/react/dist/ssr";
import { Container } from "@/components/marketing/Container";
import { SectionHeader } from "@/components/marketing/SectionHeader";

/**
 * Mentor roster (A-1). Roles are the approved credentials already used across
 * the site; names/photos/LinkedIn are scaffolded placeholders.
 * TODO[About]: drop in real mentor name, photo and LinkedIn for each before
 * publishing — the cards render obvious "pending" markers until then.
 */
const mentors = [
  { role: "Former sustainability partner, Big-4 firm" },
  { role: "Head of ESG Reporting, Nifty-50 company" },
  { role: "TCFD-aligned climate risk advisor" },
];

/** Institutional partners for the "Backed by & built with" strip (A-2). */
const backedBy = [
  { name: "IIM Bangalore · NSRCEL", logo: "/brand/partner-iimb-nsrcel.png" },
  { name: "IIT-B Innovation Centre", logo: "/brand/partner-iitb.png" },
];
// TODO[assets]: add real logos for these partners, then move them out of the
// placeholder list below.
const backedByTodo = ["EFFAS", "ASSOCHAM", "BIA", "JITO"];

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
      "AI-powered suite that automates sustainability compliance workflows: GRI, BRSR, CDP, CBAM, SASB. 1st CBAM Ready tool for European compliance.",
  },
  {
    name: "Greenmentor Community",
    tag: "ESG Community",
    blurb:
      "India's biggest ESG community, the demand-generation engine that feeds Academy and Longsight.",
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
        />

        {/* A-2 — Backed by & built with: institutional credibility, elevated */}
        <div className="mt-12 rounded-[20px] border border-gray-200 bg-section-fade p-6 md:p-8">
          <p className="gm-eyebrow text-green-700">Backed by &amp; built with</p>
          <div className="mt-5 flex flex-wrap items-center gap-x-10 gap-y-5">
            {backedBy.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={p.name}
                src={p.logo}
                alt={p.name}
                className="h-9 w-auto object-contain"
              />
            ))}
            {backedByTodo.map((name) => (
              <span
                key={name}
                className="rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-[12px] text-gray-400"
              >
                {name} · logo TODO
              </span>
            ))}
          </div>
        </div>

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
            <div className="grid gap-3">
              {mentors.map((m) => (
                <div
                  key={m.role}
                  className="flex items-center gap-4 rounded-[16px] border border-dashed border-gray-300 bg-white p-4"
                >
                  <div
                    className="grid size-12 shrink-0 place-items-center rounded-full border border-dashed border-gray-300 text-[10px] text-gray-400"
                    aria-hidden
                  >
                    Photo
                  </div>
                  <div className="min-w-0">
                    <p className="text-[14px] font-bold text-gray-400">
                      Name pending
                    </p>
                    <p className="text-[13px] leading-snug text-gray-700">
                      {m.role}
                    </p>
                    <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-gray-400">
                      <LinkedinLogo size={12} weight="fill" aria-hidden />{" "}
                      LinkedIn pending
                    </span>
                  </div>
                </div>
              ))}
            </div>
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
