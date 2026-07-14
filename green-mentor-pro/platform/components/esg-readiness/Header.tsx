import { Container } from "@/components/marketing/Container";

/**
 * Hero-style page header for the ESG readiness assessment. Mirrors the landing
 * page Hero band — full-bleed teal with the animated Aura background and the
 * outlined wordmark device — so the tool reads as part of the marketing site.
 * Persistent above the wizard; carries the assessment title.
 */
export function AssessmentHeader() {
  return (
    <section className="relative overflow-hidden bg-teal-900 text-white">
      {/* Animated color-blend background — the Aura embed, decorative only. */}
      <iframe
        title="Green Background – Vibrant & Abstract Website Header Design"
        src="https://aura.promad.design/embed/green-background-vibrant-abstract-website-header-design?hideText=true"
        aria-hidden
        tabIndex={-1}
        className="pointer-events-none absolute inset-0 z-0 h-full w-full border-0 object-cover opacity-60"
      />

      {/* Outlined `greenmentor` wordmark device behind the copy. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-0 flex justify-center"
        style={{ height: "min(40vw, 320px)", mixBlendMode: "color-dodge", opacity: 0.4 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/wordmark-outline.svg" alt="" className="h-full w-auto max-w-none" />
      </div>

      <Container width="wide" className="relative z-10 pt-28 pb-14 md:pt-40 md:pb-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="gm-eyebrow text-green-100">
            ESG Applicability &amp; Readiness Assessment
          </p>
          <h1
            className="mt-4 font-display text-[clamp(30px,5vw,52px)] leading-[1.08] tracking-[-0.02em] text-white"
            style={{ textShadow: "0 2px 24px rgba(0, 0, 0, 0.35)" }}
          >
            Which ESG regulations apply to your business —{" "}
            <span className="text-green-500">and how ready are you?</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-white/85">
            A 6-minute assessment. Get an instant applicability check and a
            personalised readiness report.
          </p>
        </div>
      </Container>
    </section>
  );
}
