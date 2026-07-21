import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/ui";
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
    <div>
      <Link
        href="/webinars"
        className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-gray-500 transition-colors hover:text-ink"
      >
        <ArrowLeft size={14} /> All webinars
      </Link>
      <PageHeader
        title={webinar.title}
        sub={[fmtWhen(webinar.scheduledAt), speakers].filter(Boolean).join(" · ") || "Live session"}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <ZoomEmbed webinarId={id} />
        <WebinarPolls polls={polls} initialResponses={responses} initialResults={results} userId={user.id} />
      </div>
    </div>
  );
}
