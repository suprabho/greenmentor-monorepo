import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { Container } from "@/components/marketing/Container";
import { SectionHeader } from "@/components/marketing/SectionHeader";
import { painPoints } from "@/lib/data/pain-points";

/**
 * "How we solve it" (G-3) — closes the loop the Problem section opens. Each of
 * the four traps is paired with the concrete mechanism in the membership that
 * answers it, so the visitor sees the solution before they reach pricing.
 *
 * Reads its problem→answer pairs straight from `painPoints` so the two sections
 * can never drift out of sync.
 */
export function SolutionSection() {
  return (
    <section className="bg-section-fade py-24 md:py-28">
      <Container width="wide">
        <SectionHeader
          label="How we solve it"
          title={
            <>
              The problem, <span className="text-green-700">answered.</span>
            </>
          }
          description="Every trap above has a deliberate fix built into the membership. Not a promise, a mechanism."
          align="center"
          className="text-center"
        />

        <ul className="mx-auto mt-14 max-w-4xl space-y-4">
          {painPoints.map((p) => {
            const Icon = p.icon;
            return (
              <li
                key={p.id}
                className="grid items-center gap-4 rounded-[20px] border border-gray-200 bg-white p-6 md:grid-cols-[1fr_auto_1.4fr] md:gap-6 md:p-7"
              >
                <div className="flex items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-green-100">
                    <Icon
                      size={20}
                      weight="duotone"
                      className="text-green-700"
                      aria-hidden
                    />
                  </span>
                  <div>
                    <p className="gm-eyebrow text-gray-500">The problem</p>
                    <p className="mt-1 text-[16px] font-bold text-ink">
                      {p.title}
                    </p>
                  </div>
                </div>

                <ArrowRight
                  size={20}
                  weight="bold"
                  className="mx-auto hidden text-green-500 md:block"
                  aria-hidden
                />

                <div className="border-t border-gray-100 pt-4 md:border-t-0 md:border-l md:pt-0 md:pl-6">
                  <p className="gm-eyebrow text-green-700">
                    The GreenMentor answer
                  </p>
                  <p className="mt-1 text-[15px] leading-relaxed text-gray-700">
                    {p.solution}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}
