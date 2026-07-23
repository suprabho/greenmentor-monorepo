import Link from "next/link";
import { ArrowRight, SignIn, VideoCamera } from "@phosphor-icons/react/dist/ssr";
import { Card } from "@/components/ui";
import { AgendaCard } from "@/components/home/agenda-card";
import { FeedPreview, type FeedPreviewArticle } from "@/components/home/feed-preview";
import { WebinarCard } from "@/components/webinars/webinar-card";
import { buildAgenda } from "@/lib/home/agenda";
import { fetchJobs } from "@/lib/jobs/repo";
import { fetchUpcomingWebinars, fetchUserRsvpIds } from "@/lib/webinars/repo";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Home — Green Mentor Pro" };
export const dynamic = "force-dynamic";

function greeting(now = new Date()): string {
  const hour = Number(
    now.toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" })
  );
  if (hour < 5) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// Home is public like the feed — signed-out visitors get the same dashboard
// with a sign-in prompt instead of a personal greeting.
export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [webinars, jobs, { data: articles }, profileRes, rsvpIds] = await Promise.all([
    fetchUpcomingWebinars(),
    fetchJobs(),
    supabase
      .from("articles")
      .select("id, source, title, url, image_url, published_at")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(5),
    user
      ? supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    user ? fetchUserRsvpIds(user.id) : Promise.resolve(new Set<string>()),
  ]);

  const agenda = buildAgenda(webinars, jobs);
  const nextWebinars = webinars.slice(0, 2);
  const firstName = profileRes.data?.display_name?.split(" ")[0] ?? user?.email?.split("@")[0] ?? null;

  return (
    <div className="mx-auto max-w-6xl">
      {/* Greeting */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-ink">
            {firstName ? `${greeting()}, ${firstName}` : "Welcome to Green Mentor Pro"}
          </h1>
          <p className="mt-1 text-[13.5px] text-gray-700">Here&rsquo;s what&rsquo;s coming up.</p>
        </div>
        {!user && (
          <Link
            href="/login?next=/home"
            className="inline-flex items-center gap-1.5 rounded-pill bg-teal-900 px-4 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-teal-800"
          >
            <SignIn size={14} weight="bold" /> Sign in
          </Link>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        {/* Main column */}
        <div className="order-2 space-y-6 lg:order-1 lg:col-span-2">
          <section>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-gray-500">
                Happening soon
              </h2>
              <Link href="/webinars" className="text-[12px] font-semibold text-green-700 hover:underline">
                All webinars &amp; events <ArrowRight size={11} className="inline" />
              </Link>
            </div>
            {nextWebinars.length === 0 ? (
              <Card className="flex items-center gap-3 p-5 text-[13.5px] text-gray-600">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-green-50 text-green-700">
                  <VideoCamera size={20} />
                </span>
                No upcoming webinars right now — new sessions are announced every week.
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {nextWebinars.map((w) => (
                  <WebinarCard key={w.id} webinar={w} attending={rsvpIds.has(w.id)} signedIn={Boolean(user)} />
                ))}
              </div>
            )}
          </section>

          <FeedPreview articles={(articles ?? []) as FeedPreviewArticle[]} />
        </div>

        {/* Agenda rail — first on mobile, sticky on desktop */}
        <div className="order-1 lg:order-2 lg:sticky lg:top-8">
          <AgendaCard items={agenda} />
        </div>
      </div>
    </div>
  );
}
