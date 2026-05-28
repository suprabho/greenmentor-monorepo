import { Container } from "@/components/marketing/Container";
import { SectionHeader } from "@/components/marketing/SectionHeader";
import { painPoints } from "@/lib/data/pain-points";

/**
 * "The problem" — four pain cards that frame why the subscription exists.
 * Sits above the courses section so the value-prop lands in context.
 */
export function ProblemSection() {
  return (
    <section className="bg-white py-24 md:py-28">
      <Container width="wide">
        <SectionHeader
          label="The problem"
          title={
            <>
              Most ESG learners are stuck — not because they lack effort, but
              because they lack the{" "}
              <span className="text-green-700">right structure.</span>
            </>
          }
          description="Four traps that turn motivated learners into half-finished tabs."
        />

        <ul className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {painPoints.map((p) => {
            const Icon = p.icon;
            return (
              <li
                key={p.id}
                className="rounded-[20px] border border-gray-200 bg-white p-7 transition-colors hover:border-green-500/60"
              >
                <Icon
                  size={24}
                  weight="duotone"
                  className="text-green-700"
                  aria-hidden
                />
                <h3 className="mt-5 text-[18px] font-bold leading-snug text-ink">
                  {p.title}
                </h3>
                <p className="mt-2 text-[15px] leading-relaxed text-gray-700">
                  {p.description}
                </p>
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}
