import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { fetchStories, storyHref } from "@/lib/stories/repo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Stories — Green Mentor Pro",
  description: "Scrollytelling briefings from the GreenMentor desk.",
};

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * Published scrollytelling stories, newest first. Public like /webinars and
 * /jobs; each card opens the fullbleed reader.
 */
export default async function StoriesPage() {
  const stories = await fetchStories();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Stories"
        sub="Scroll-driven briefings from the GreenMentor desk — data, frameworks and takeaways in one sitting."
      />

      {stories.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-[14px] text-gray-500">
          No stories published yet — check back soon.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {stories.map((story) => (
            <Link
              key={story.id}
              href={storyHref(story)}
              className="group flex flex-col justify-between rounded-2xl border border-gray-200 bg-[#0e0e0c] p-6 transition-shadow hover:shadow-lg"
            >
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#5cb870]">
                  {story.byline ?? "GreenMentor"}
                </div>
                <h2 className="mt-3 font-display text-[19px] font-bold leading-snug text-white group-hover:underline">
                  {story.title}
                </h2>
                {story.subtitle ? (
                  <p className="mt-2 line-clamp-3 font-serif text-[13.5px] italic leading-relaxed text-white/60">
                    {story.subtitle}
                  </p>
                ) : null}
              </div>
              <div className="mt-6 flex items-center justify-between border-t border-white/15 pt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-white/50">
                <span>{dateFmt.format(new Date(story.publishedAt))}</span>
                <span className="text-[#5cb870]">Read →</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
