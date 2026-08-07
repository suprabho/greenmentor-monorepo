import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, VideoCamera } from "@phosphor-icons/react/dist/ssr";
import { ZoomJoinCard } from "@/components/webinars/zoom-join-card";
import { WebinarPolls } from "@/components/webinars/webinar-polls";
import { webinarHref } from "@/lib/share/href";
import {
  fetchPollResults,
  fetchUserPollResponses,
  fetchWebinarPolls,
  resolveWebinar,
} from "@/lib/webinars/repo";
import { fetchZoomJoin } from "@/lib/webinars/zoom-join";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function fmtWhen(iso: string | null): string {
  if (!iso) return "Live session";
  return new Date(iso).toLocaleString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

// The live room requires a signed-in user (any signed-in learner — no RSVP
// gate). Gated here in-page rather than via middleware PROTECTED_PATHS, which
// is prefix-based and would wrongly gate the public /webinars listing. The
// gate is also what makes it safe to render the meeting id + passcode here
// (fetchZoomJoin reads them with the service-role client).
//
// The session itself runs in Zoom — the stage is a hand-off card (Zoom app /
// browser web client), not the embedded SDK player it used to be.
//
// `slug` is a share slug ("scope-3-3f8a1c2e9d"), but resolveWebinar also takes
// a bare uuid so the /webinars/<uuid>/live links that predate slugs still work.
export default async function WebinarLivePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/webinars/${slug}/live`)}`);

  const webinar = await resolveWebinar(slug);
  if (!webinar) notFound();
  if (slug !== webinar.shareSlug) redirect(`${webinarHref(webinar)}/live`);

  const [polls, zoom] = await Promise.all([fetchWebinarPolls(webinar.id), fetchZoomJoin(webinar.id)]);
  const pollIds = polls.map((p) => p.id);
  const [responses, results] = await Promise.all([
    fetchUserPollResponses(pollIds),
    fetchPollResults(pollIds),
  ]);

  const speakers = webinar.instructors.map((i) => i.name).join(", ");

  return (
    <div className="flex h-dvh flex-col bg-ink">
      {/* Slim top bar: back button + session context */}
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-2.5 lg:px-6">
        <Link
          href="/webinars"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-pill bg-white/10 px-3.5 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-white/20"
        >
          <ArrowLeft size={14} weight="bold" /> All webinars
        </Link>
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-semibold text-white">{webinar.title}</div>
          <div className="truncate text-[11.5px] text-white/50">
            {[fmtWhen(webinar.scheduledAt), speakers].filter(Boolean).join(" · ") || "Live session"}
          </div>
        </div>
      </div>

      {/* Stage: the Zoom hand-off fills the main cell, polls live in a scrollable rail */}
      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-h-0 overflow-hidden p-3 lg:p-4">
          {zoom ? (
            /* Raw uuid — the /api/webinars/[id]/join ping is keyed by id, not slug. */
            <ZoomJoinCard webinarId={webinar.id} zoom={zoom} />
          ) : (
            <div className="flex h-full min-h-[420px] flex-col items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-gray-900 p-8 text-center lg:min-h-0">
              <VideoCamera size={30} className="text-white/80" weight="fill" />
              <p className="max-w-sm text-[13.5px] text-white/80">
                The host hasn&apos;t attached the Zoom meeting yet — check back closer to the
                session.
              </p>
            </div>
          )}
        </div>
        <aside className="min-h-0 overflow-y-auto border-t border-white/10 bg-gray-50 p-4 lg:border-l lg:border-t-0">
          <WebinarPolls polls={polls} initialResponses={responses} initialResults={results} userId={user.id} />
        </aside>
      </div>
    </div>
  );
}
