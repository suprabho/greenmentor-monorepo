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
 * TODO[data]: PLACEHOLDER figures — replace with verified numbers before
 * publishing (WL-1 / WL-2). Each is an unverified claim; the UI shows a
 * "pending verification" note so it can't ship unnoticed.
 */
const PLACEMENT = {
  countLast12mo: "200+", // PLACEHOLDER — verify against member LinkedIn data
  avgCtc: "₹8–18L", // PLACEHOLDER — verify
  demandMultiple: "3×", // PLACEHOLDER — verify
};

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
          align="center"
          title={
            <>
              Our members have gone on to ESG roles at{" "}
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

        {/* WL-1 — placement claim (figures are placeholders, see PLACEMENT) */}
        <div className="mt-8 rounded-[16px] border border-green-100 bg-green-50 p-6 text-center md:p-8">
          <p className="text-[18px] font-semibold leading-relaxed text-ink md:text-[20px]">
            In the last 12 months,{" "}
            <span className="text-green-700">{PLACEMENT.countLast12mo}</span>{" "}
            community members moved into sustainability roles at India&apos;s top
            companies.<sup>*</sup>
          </p>
          <p className="mt-2 text-[12px] text-gray-500">
            *Based on LinkedIn activity reported by members.{" "}
            <span className="italic text-[#946200]">
              Figure pending verification.
            </span>
          </p>
        </div>

        {/* WL-2 — career-context stat strip (figures are placeholders) */}
        <div className="mt-6 grid gap-px overflow-hidden rounded-[16px] border border-gray-200 bg-gray-200 sm:grid-cols-3">
          {[
            {
              stat: PLACEMENT.avgCtc,
              label: "avg. starting CTC for sustainability roles",
            },
            {
              stat: "Weekly",
              label: "ESG roles posted in our community jobs feed",
            },
            {
              stat: PLACEMENT.demandMultiple,
              label: "demand vs. supply for certified professionals",
            },
          ].map((item) => (
            <div key={item.label} className="bg-white p-6 text-center">
              <p className="font-numeral text-[32px] leading-none text-green-700">
                {item.stat}
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-gray-600">
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
