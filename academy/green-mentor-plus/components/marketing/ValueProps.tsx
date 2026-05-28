import { Container } from "@/components/marketing/Container";
import { SectionHeader } from "@/components/marketing/SectionHeader";
import { valueProps } from "@/lib/data/value-props";

/**
 * "What else is included" — the non-course inclusions in the Plus Essential
 * subscription. Sits beneath the course grid so the value-of-membership
 * argument runs courses → live + community → career.
 *
 * (File is still named `ValueProps` for backwards-compat with the marketing
 * route imports. Conceptually this is now the ecosystem features section.)
 */
export function ValueProps() {
  return (
    <section className="bg-section-fade py-24 md:py-28">
      <Container width="wide">
        <SectionHeader
          label="What else is included"
          title={
            <>
              More than courses.{" "}
              <span className="text-green-700">A full ecosystem.</span>
            </>
          }
          description="The subscription bundles the things that actually move careers — live sessions, the peer community, weekly insights, and the jobs feed."
        />

        <ul className="mt-14 grid gap-px overflow-hidden rounded-[20px] border border-gray-200 bg-gray-200 sm:grid-cols-2 lg:grid-cols-3">
          {valueProps.map((vp) => {
            const Icon = vp.icon;
            return (
              <li
                key={vp.id}
                className="bg-white p-8 transition-colors hover:bg-gray-50"
              >
                <div className="grid size-11 place-items-center rounded-full border-[2.5px] border-green-500 bg-white">
                  <Icon
                    size={20}
                    weight="duotone"
                    className="text-green-700"
                    aria-hidden
                  />
                </div>
                <h3 className="mt-6 text-[18px] font-bold leading-tight text-ink">
                  {vp.title}
                </h3>
                <p className="mt-2 text-[15px] leading-relaxed text-gray-700">
                  {vp.description}
                </p>
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}
