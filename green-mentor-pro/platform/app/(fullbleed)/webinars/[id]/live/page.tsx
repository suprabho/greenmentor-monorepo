import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { ZoomEmbed } from "@/components/webinars/zoom-embed";
import { WebinarPolls } from "@/components/webinars/webinar-polls";
import {
  fetchPollResults,
  fetchUserPollResponses,
  fetchWebinarById,
  fetchWebinarPolls,
} from "@/lib/webinars/repo";
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
// is prefix-based and would wrongly gate the public /webinars listing.
export default async function WebinarLivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/webinars/${id}/live`)}`);

  const webinar = await fetchWebinarById(id);
  if (!webinar) notFound();

  const polls = await fetchWebinarPolls(id);
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

      {/* Stage: Zoom fills the main cell, polls live in a scrollable rail */}
      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-h-0 overflow-hidden p-3 lg:p-4">
          <ZoomEmbed webinarId={id} />
        </div>
        <aside className="min-h-0 overflow-y-auto border-t border-white/10 bg-gray-50 p-4 lg:border-l lg:border-t-0">
          <WebinarPolls polls={polls} initialResponses={responses} initialResults={results} userId={user.id} />
        </aside>
      </div>
    </div>
  );
}
