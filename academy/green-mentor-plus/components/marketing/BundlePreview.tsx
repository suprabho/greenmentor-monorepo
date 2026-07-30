"use client";

import Link from "next/link";
import { ArrowUpRight, CheckCircle, Stack, Target } from "@phosphor-icons/react/dist/ssr";
import { Container } from "@/components/marketing/Container";
import { SectionHeader } from "@/components/marketing/SectionHeader";
import { bundles, type CatalogBundle } from "@/lib/data/courses.generated";
import { track } from "@/lib/utils/analytics";

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

/** "8 courses · 173 lessons · 101 hours" — advertised count wins over the resolved list. */
function meta(bundle: CatalogBundle): string {
  const count = bundle.courseCount ?? (bundle.courses.length || null);
  return [
    count ? `${count} ${count === 1 ? "course" : "courses"}` : null,
    bundle.lessonCount ? `${bundle.lessonCount} lessons` : null,
    bundle.durationLabel,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Curated multi-course paths, sold standalone on Learnyst. Distinct from the
 * course grid above it: bundles are outcome-led, so the outcome and the member
 * course list carry the card rather than the framework badge.
 */
export function BundlePreview() {
  if (bundles.length === 0) return null;

  return (
    <section id="bundles" className="bg-section-fade py-24 md:py-28">
      <Container width="wide">
        <SectionHeader
          label="Bundles"
          title={
            <>
              Curated paths.{" "}
              <span className="text-green-700">One outcome each.</span>
            </>
          }
          description="Bundles group courses into a single learning path with a defined outcome, priced together and bought standalone."
          align="center"
          className="max-w-2xl"
        />

        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {bundles.map((bundle) => {
            const hidden = bundle.courseCount != null ? bundle.courseCount - bundle.courses.length : 0;
            return (
              <Link
                key={bundle.slug}
                href={bundle.courseUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track("bundle_card_clicked", { id: bundle.slug })}
                className="group flex flex-col overflow-hidden rounded-[14px] border border-gray-200 bg-white transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-green-700 hover:shadow-soft"
              >
                <div className="flex items-center justify-between bg-linear-to-br from-teal-800 to-green-900 p-5">
                  <div className="flex items-center gap-2.5">
                    <Stack size={22} weight="duotone" className="shrink-0 text-green-500" aria-hidden />
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-green-100/85">
                      {meta(bundle)}
                    </span>
                  </div>
                  <ArrowUpRight
                    size={14}
                    weight="bold"
                    className="text-white/70 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white"
                  />
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <h3 className="text-[15px] font-bold leading-snug text-ink">{bundle.title}</h3>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-gray-600">{bundle.description}</p>

                  {bundle.outcome && (
                    <div className="mt-3 flex items-start gap-2 rounded-[12px] bg-green-50 p-3">
                      <Target size={15} weight="duotone" className="mt-0.5 shrink-0 text-green-700" aria-hidden />
                      <p className="text-[12px] leading-relaxed text-green-700">{bundle.outcome}</p>
                    </div>
                  )}

                  {bundle.courses.length > 0 && (
                    <ul className="mt-4 space-y-1.5">
                      {bundle.courses.map((c) => (
                        <li key={c.slug} className="flex items-start gap-2">
                          <CheckCircle size={15} weight="fill" className="mt-0.5 shrink-0 text-green-500" />
                          <span className="text-[12.5px] text-gray-700">{c.title}</span>
                        </li>
                      ))}
                      {hidden > 0 && (
                        <li className="pl-[23px] text-[12px] text-gray-500">
                          + {hidden} more {hidden === 1 ? "course" : "courses"}
                        </li>
                      )}
                    </ul>
                  )}

                  {bundle.priceInr != null && bundle.priceInr > 0 && (
                    <p className="mt-auto pt-4 text-[15px] font-bold text-green-700">
                      {formatINR(bundle.priceInr)}{" "}
                      <span className="text-[12.5px] font-medium text-gray-500">bundle price</span>
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
