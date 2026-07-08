import Link from "next/link";
import { Card, Chip, PageHeader } from "@/components/ui";
import { fetchCourseCatalog } from "@/lib/academy/repo";

export const metadata = { title: "Academy — Green Mentor Pro" };

export default async function AcademyPage() {
  const courses = await fetchCourseCatalog();

  return (
    <div>
      <PageHeader
        title="Academy"
        sub="Bite-sized ESG courses — short videos, a quick check after every module, and real credentials."
      />

      {courses.length === 0 ? (
        <Card className="p-6 text-[13.5px] text-gray-600">No published courses yet — check back soon.</Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <Link key={course.id} href={`/academy/${course.slug}`}>
              <Card className="h-full p-5 transition-shadow hover:shadow-md">
                <div className="flex items-center justify-between gap-2">
                  <Chip tone={course.priceCredits === 0 ? "green" : "neutral"}>
                    {course.priceCredits === 0 ? "Free" : `${course.priceCredits} cr`}
                  </Chip>
                  <Chip tone="teal">{course.level}</Chip>
                </div>
                <h2 className="mt-3 text-[15.5px] font-semibold text-ink">{course.title}</h2>
                {course.description && <p className="mt-1.5 text-[12.5px] text-gray-600">{course.description}</p>}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
