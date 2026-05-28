"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  FileText,
  ChartBar,
  Cloud,
  Broadcast,
  Certificate,
  Stack,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { Container } from "@/components/marketing/Container";
import { SectionHeader } from "@/components/marketing/SectionHeader";
import { courses } from "@/lib/data/courses";
import { track } from "@/lib/utils/analytics";

/** Standalone INR price, e.g. "₹6,999" — matches the en-IN formatting used in pricing. */
function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

/**
 * Pick the right Phosphor icon for each course. Map keyed by course id so
 * the order in `courses.ts` can change without breaking the assignment.
 */
const courseIcons: Record<string, Icon> = {
  "fundamentals-esg-brsr": FileText,
  "ghg-accounting-mastery": Cloud,
  "esg-readiness": ChartBar,
  "live-lca-training": Broadcast,
  "esg-reporting-pro": Certificate,
};

export function CoursePreview() {
  return (
    <section id="courses" className="bg-white py-24 md:py-28">
      <Container width="wide">
        <SectionHeader
          label="Courses included"
          title={
            <>
              Every course you need.{" "}
              <span className="text-green-700">One subscription.</span>
            </>
          }
          description="Foundational courses are included in your Plus Essential subscription; the live and pro programs are available as paid add-ons. Bundles are curated paths combining several courses for a specific outcome."
          className="max-w-2xl"
        />

        {/* Aligned-with-frameworks lockup from the deck */}
        <div className="mt-10 flex flex-col items-start gap-4 rounded-[20px] border border-gray-200 bg-section-fade p-6 md:flex-row md:items-center md:gap-6 md:p-8">
          <span className="gm-eyebrow shrink-0 border border-black/[0.06] bg-white px-[18px] py-[10px] text-green-700">
            Aligned With
          </span>
          <p className="text-[15px] font-medium text-ink md:text-[17px]">
            BRSR · GRI · SASB · CDP · CBAM · TCFD · DJSI
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {courses.map((course) => {
            const Icon = courseIcons[course.id] ?? FileText;
            return (
              <Link
                key={course.id}
                href={course.learnystUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  track("course_card_clicked", {
                    id: course.id,
                    framework: course.framework,
                  })
                }
                className="group flex flex-col overflow-hidden rounded-[14px] border border-gray-200 bg-white transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-green-700 hover:shadow-soft"
              >
                {/* TODO[assets]: swap the placeholder banners in /public/courses
                    for real Learnyst thumbnails (keep the same file paths) */}
                <div className="relative aspect-2/1 w-full overflow-hidden bg-green-900">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={course.image}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                  <ArrowUpRight
                    size={14}
                    weight="bold"
                    className="absolute right-3 top-3 text-white/70 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white"
                  />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <Icon
                    size={20}
                    weight="duotone"
                    className="text-green-700"
                    aria-hidden
                  />
                  <h3 className="mt-3 text-[14px] font-bold leading-snug text-ink">
                    {course.title}
                  </h3>
                  {course.standalonePrice !== null && (
                    <p className="mt-auto pt-3 text-[13px] font-semibold text-green-700">
                      {formatINR(course.standalonePrice)}{" "}
                      <span className="font-medium text-gray-500">
                        standalone value
                      </span>
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        {/* Bundle callout — explains the curated paths that group courses */}
        <div className="mt-5 flex items-start gap-3 rounded-[14px] bg-green-100 p-4 text-[14px] text-green-700">
          <Stack
            size={20}
            weight="duotone"
            className="mt-0.5 flex-shrink-0"
            aria-hidden
          />
          <span>
            <strong className="font-semibold">Bundles</strong> are curated
            combinations of these courses with a clear learning path and
            outcome — e.g. ESG Reporting Bundle, ESG Mastery Essentials.
          </span>
        </div>
      </Container>
    </section>
  );
}
