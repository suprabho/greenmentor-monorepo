import type { CSSProperties } from "react";
import { Container } from "@/components/marketing/Container";
import { SectionHeader } from "@/components/marketing/SectionHeader";
import {
  topHiringCompanies,
  moreHiringCompanies,
  type HiringCompany,
} from "@/lib/data/hiring-companies";
import { cn } from "@/lib/utils/cn";

/** A single company logo on a white tile, rendered in its natural brand colours. */
function LogoTile({ company }: { company: HiringCompany }) {
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white px-5 py-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={company.logo}
        alt={company.name}
        loading="lazy"
        className={cn("h-7 w-auto object-contain md:h-8", company.className)}
      />
    </span>
  );
}

/**
 * One continuously-scrolling row of logos. The group is duplicated (the copy is
 * `aria-hidden`) so the CSS marquee loops seamlessly; it pauses on hover. The
 * `duration` controls speed and `reverse` flips the scroll direction.
 */
function MarqueeRow({
  companies,
  duration,
  reverse = false,
}: {
  companies: HiringCompany[];
  duration: number;
  reverse?: boolean;
}) {
  return (
    <div className="gm-marquee-mask overflow-hidden">
      <div
        className={cn("gm-marquee-track", reverse && "gm-marquee--reverse")}
        style={{ "--gm-marquee-duration": `${duration}s` } as CSSProperties}
      >
        {[0, 1].map((copy) => (
          <div key={copy} className="flex shrink-0 gap-2.5" aria-hidden={copy === 1}>
            {companies.map((co) => (
              <LogoTile key={co.name} company={co} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

const allHiringCompanies = [...topHiringCompanies, ...moreHiringCompanies];
const half = Math.ceil(allHiringCompanies.length / 2);
const rowOne = allHiringCompanies.slice(0, half);
const rowTwo = allHiringCompanies.slice(half);

/**
 * "Where our learners go" — the hiring companies presented as a pair of
 * continuously-scrolling, natural-colour logo carousels (opposite directions),
 * pausing on hover. Scoped to companies we hold a logo for (see
 * hiring-companies.ts).
 */
export function HiringCompanies() {
  return (
    <section className="bg-white py-24 md:py-28">
      <Container width="wide">
        <SectionHeader
          label="Where our learners go"
          title={
            <>
              Position yourself for ESG roles at{" "}
              <span className="text-green-700">
                India&apos;s leading organisations.
              </span>
            </>
          }
          description="The firms hiring through our community span Indian conglomerates, Big-4 advisories, and global energy & climate players."
        />

        <div className="mt-14 rounded-[20px] border border-gray-200 bg-section-fade p-6 md:p-8">
          <p className="gm-eyebrow text-green-700">Top hiring companies</p>
          <div className="mt-5 flex flex-col gap-2.5">
            <MarqueeRow companies={rowOne} duration={38} />
            <MarqueeRow companies={rowTwo} duration={46} reverse />
          </div>
        </div>
      </Container>
    </section>
  );
}
