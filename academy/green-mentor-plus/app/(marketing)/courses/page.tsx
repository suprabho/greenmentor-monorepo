import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Clock } from "@phosphor-icons/react/dist/ssr";
import { Container } from "@/components/marketing/Container";
import { Eyebrow, Badge } from "@/components/ui/Badge";
import { FinalCta } from "@/components/marketing/FinalCta";
import { courses } from "@/lib/data/courses";

export const metadata: Metadata = {
  title: "Course Library",
  description:
    "Every framework worth knowing — GRI, BRSR, CDP, TCFD, SASB, DJSI, CBAM — taught end-to-end.",
};

export default function CoursesPage() {
  return (
    <>
      <Container width="wide" className="pt-16 pb-16 md:pt-24">
        <div className="max-w-3xl">
          <Eyebrow tone="white">Course Library</Eyebrow>
          <h1 className="font-display mt-8 text-[clamp(40px,6vw,72px)] leading-tight tracking-[-0.02em] text-ink">
            The full ESG curriculum, in one place.
          </h1>
          <p className="mt-6 text-[18px] leading-relaxed text-gray-700 md:text-[20px]">
            Built around the frameworks corporations actually file under and
            the assurance bar Big-4 advisors apply. Pick a track and start.
          </p>
        </div>

        {/* Aligned-with-frameworks lockup from the deck */}
        <div className="mt-12 flex flex-col items-start gap-4 rounded-[20px] border border-gray-200 bg-section-fade p-6 md:flex-row md:items-center md:gap-6 md:p-8">
          <span className="gm-eyebrow shrink-0 bg-white px-[18px] py-[10px] text-green-700 border border-black/[0.06]">
            Aligned With
          </span>
          <p className="text-[15px] font-medium text-ink md:text-[17px]">
            BRSR · GRI · SASB · CDP · CBAM · TCFD · DJSI
          </p>
        </div>

        <div className="mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <Link
              key={course.id}
              href={course.learnystUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col rounded-[8px] border border-gray-200 bg-white p-7 transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-green-700 hover:shadow-tile"
            >
              <div className="flex items-center justify-between">
                <Badge tone="mint">{course.framework}</Badge>
                <span className="inline-flex items-center gap-1 text-[13px] text-gray-500">
                  <Clock size={14} /> {course.duration}
                </span>
              </div>

              <h3 className="mt-6 text-[20px] font-bold leading-snug text-ink">
                {course.title}
              </h3>
              <p className="mt-3 flex-1 text-[15px] leading-relaxed text-gray-700">
                {course.description}
              </p>

              <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-4">
                <span className="gm-eyebrow text-gray-500">{course.level}</span>
                <ArrowUpRight
                  size={16}
                  weight="bold"
                  className="text-green-700 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </div>
            </Link>
          ))}
        </div>
      </Container>

      <FinalCta />
    </>
  );
}
