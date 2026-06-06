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
import { cn } from "@/lib/utils/cn";
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
 * The seven frameworks the curriculum aligns to — credibility signal (C-4).
 * Rendered as logos (in /public/brand/frameworks) inside uniform white tiles,
 * mirroring the "Backed by & built with" logo strip on the About section.
 */
const frameworks = [
  { name: "BRSR", logo: "/brand/frameworks/brsr.png" },
  { name: "GRI", logo: "/brand/frameworks/gri.png" },
  { name: "SASB", logo: "/brand/frameworks/sasb.png" },
  { name: "CDP", logo: "/brand/frameworks/cdp.png" },
  { name: "CBAM", logo: "/brand/frameworks/cbam.png" },
  { name: "TCFD", logo: "/brand/frameworks/tcfd.png" },
  { name: "DJSI", logo: "/brand/frameworks/djsi.png" },
];

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
          description="Every course here is included in your Plus Essential subscription, each with its own certificate of completion. Only live certifications like ISO 14064 and standalone workshops are available as paid add-ons."
          align="center"
          className="max-w-2xl"
        />

        {/* C-2 — included vs add-on legend, made visually distinct up front */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className="rounded-[16px] border border-green-100 bg-green-50 p-5">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-green-500" aria-hidden />
              <p className="gm-eyebrow text-green-700">
                Included in Plus Essential
              </p>
            </div>
            <p className="mt-2 text-[14px] leading-relaxed text-gray-700">
              Every course (foundational, self-paced and live) is part of your
              subscription, with a certificate of completion.
            </p>
          </div>
          <div className="rounded-[16px] border border-[#FFB020]/30 bg-[#FFB020]/10 p-5">
            <div className="flex items-center gap-2">
              <span
                className="size-2.5 rounded-full bg-[#FFB020]"
                aria-hidden
              />
              <p className="gm-eyebrow text-[#946200]">Available as add-ons</p>
            </div>
            <p className="mt-2 text-[14px] leading-relaxed text-gray-700">
              Live certifications like ISO 14064 &amp; standalone workshops,
              bought on top of the plan.
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                {/* C-1 — branded title banner (no placeholder imagery). The card
                    self-describes via category + icon on a forest-green field.
                    TODO[assets]: optionally drop real Learnyst banners behind
                    this once available. */}
                <div className="relative flex aspect-2/1 w-full flex-col justify-between overflow-hidden bg-linear-to-br from-teal-800 to-green-900 p-4">
                  <div className="flex items-start justify-between">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
                        course.included
                          ? "bg-green-500 text-teal-900"
                          : "bg-[#FFB020] text-teal-900",
                      )}
                    >
                      {course.included ? "Included" : "Add-on"}
                    </span>
                    <ArrowUpRight
                      size={14}
                      weight="bold"
                      className="text-white/70 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon
                      size={22}
                      weight="duotone"
                      className="shrink-0 text-green-500"
                      aria-hidden
                    />
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-green-100/85">
                      {course.framework}
                    </span>
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="text-[14px] font-bold leading-snug text-ink">
                    {course.title}
                  </h3>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-gray-600">
                    {course.outcome}
                  </p>
                  {course.standalonePrice !== null && (
                    <p className="mt-auto pt-3 text-[13px] font-semibold text-green-700">
                      {formatINR(course.standalonePrice)}{" "}
                      <span className="font-medium text-gray-500">
                        {course.included ? "standalone value" : "add-on"}
                      </span>
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        {/* C-4 — frameworks as credibility logos, not footnote text. Each logo
            sits in a uniform white tile so the differing badge/wordmark shapes
            read as one consistent strip (same treatment as the About strip). */}
        <div className="mt-10 rounded-[20px] border border-gray-200 bg-section-fade p-6 md:p-8">
          <p className="gm-section-label text-center text-[18px] text-green-700">
            Curriculum aligned with
          </p>
          <ul className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {frameworks.map((f) => (
              <li
                key={f.name}
                className="flex h-20 items-center justify-center rounded-[14px] border border-gray-200 bg-white px-4 py-3"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={f.logo}
                  alt={`${f.name} framework`}
                  title={f.name}
                  loading="lazy"
                  className="max-h-full max-w-full object-contain"
                />
              </li>
            ))}
          </ul>
          <p className="mt-4 text-center text-[14px] leading-relaxed text-gray-700">
            India&apos;s only ESG learning platform covering all 7 major
            frameworks in one subscription.
          </p>
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
            outcome, e.g. ESG Reporting Bundle, ESG Mastery Essentials.
          </span>
        </div>
      </Container>
    </section>
  );
}
