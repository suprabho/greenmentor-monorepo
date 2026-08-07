import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { ZoomEmbed } from "@/components/webinars/zoom-embed";
import { webinarHref } from "@/lib/share/href";
import { resolveWebinar } from "@/lib/webinars/repo";
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

      {/* Stage: Zoom fills everything below the top bar (polls happen in-meeting via Zoom) */}
      <div className="min-h-0 flex-1 overflow-hidden p-3 lg:p-4">
        {/* Raw uuid — /api/webinars/[id]/zoom-signature is keyed by id, not slug. */}
        <ZoomEmbed webinarId={webinar.id} />
      </div>
    </div>
  );
}
