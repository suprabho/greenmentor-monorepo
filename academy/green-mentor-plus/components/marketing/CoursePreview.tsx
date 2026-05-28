"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  FileText,
  ChartBar,
  Cloud,
  Target,
  Recycle,
  Globe,
  ArrowsLeftRight,
  Wrench,
  Stack,
  Tag,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { Container } from "@/components/marketing/Container";
import { SectionHeader } from "@/components/marketing/SectionHeader";
import { Button } from "@/components/ui/Button";
import { courses, certificationAddOns } from "@/lib/data/courses";
import { track } from "@/lib/utils/analytics";

/**
 * Pick the right Phosphor icon for each course. Map keyed by course id so
 * the order in `courses.ts` can change without breaking the assignment.
 */
const courseIcons: Record<string, Icon> = {
  "fundamentals-esg-brsr": FileText,
  "esg-readiness": ChartBar,
  "ghg-accounting-mastery": Cloud,
  "materiality-assessment-mastery": Target,
  "lca-mastery": Recycle,
  "cbam-mastery": Globe,
  "circularity-mastery": ArrowsLeftRight,
  "esg-software-tool-training": Wrench,
};

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function CoursePreview() {
  return (
    <section id="courses" className="bg-white py-24 md:py-28">
      <Container width="wide">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
          <SectionHeader
            label="Courses included"
            title={
              <>
                Every course you need.{" "}
                <span className="text-green-700">One subscription.</span>
              </>
            }
            description="All courses below are included in your Plus Essential subscription. Bundles are curated paths combining multiple courses for a specific outcome."
            className="max-w-2xl"
          />
          <Button asChild variant="outline" size="md">
            <Link href="/courses">See full library</Link>
          </Button>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {courses.map((course) => {
            const Icon = courseIcons[course.id] ?? FileText;
            const meta =
              course.standalonePrice !== null
                ? `${course.lessons} lessons · ${formatINR(course.standalonePrice)} standalone`
                : "Included with subscription";
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
                className="group flex flex-col rounded-[14px] border border-gray-200 bg-white p-5 transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-green-700 hover:shadow-soft"
              >
                <div className="flex items-start justify-between">
                  <Icon
                    size={20}
                    weight="duotone"
                    className="text-green-700"
                    aria-hidden
                  />
                  <ArrowUpRight
                    size={14}
                    weight="bold"
                    className="text-gray-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-green-700"
                  />
                </div>
                <h3 className="mt-5 text-[14px] font-bold leading-snug text-ink">
                  {course.title}
                </h3>
                <p className="mt-2 text-[12px] text-gray-500">{meta}</p>
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
            outcome — e.g. ESG Reporting Bundle, ESG Mastery Essentials. All
            included in your subscription.
          </span>
        </div>

        {/* Paid certifications/workshops sit outside the subscription — call
            this out so users don't bounce when they see a 35k SKU later */}
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-[14px] border border-gray-200 bg-white px-4 py-3 text-[13px] text-gray-700">
          <Tag
            size={16}
            className="flex-shrink-0 text-[#BA7517]"
            aria-hidden
          />
          <span>
            Certifications & workshops available as separate add-ons —{" "}
            {certificationAddOns
              .map((a) => `${a.title} (${formatINR(a.price)})`)
              .join(", ")}
            .
          </span>
        </div>
      </Container>
    </section>
  );
}
