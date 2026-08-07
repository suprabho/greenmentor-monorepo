import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { ZoomEmbed } from "@/components/webinars/zoom-embed";
import { shareMetadata } from "@/lib/share/og";
import { webinarHref } from "@/lib/share/href";
import { resolveWebinar, type Webinar } from "@/lib/webinars/repo";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const webinar = await resolveWebinar(slug);
  if (!webinar) return { title: "Webinar not found — Green Mentor Pro" };

  return shareMetadata({
    title: webinar.hook ?? webinar.title,
    description: sessionLine(webinar),
    path: `${webinarHref(webinar)}/live`,
    // Cover images are already public 1200×627 CDN URLs from the Aura Header
    // pipeline, so they make a better card than anything generated.
    image: webinar.coverImageUrl,
    badge: "Live webinar",
    subtitle: fmtWhen(webinar.scheduledAt),
  });
}

/** When + speakers — the same line the live room's top bar shows. */
function sessionLine(webinar: Webinar): string {
  const speakers = webinar.instructors.map((i) => i.name).join(", ");
  return [fmtWhen(webinar.scheduledAt), speakers].filter(Boolean).join(" · ") || "Live session";
}

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
// Signed-out visitors get a rendered sign-in gate, not a redirect: social
// crawlers are always signed out, and a 307 to /login would hide the share
// metadata above from every link preview.
//
// `slug` is a share slug ("scope-3-3f8a1c2e9d"), but resolveWebinar also takes
// a bare uuid so the /webinars/<uuid>/live links that predate slugs still work.
export default async function WebinarLivePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const webinar = await resolveWebinar(slug);
  if (!webinar) notFound();
  if (slug !== webinar.shareSlug) redirect(`${webinarHref(webinar)}/live`);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <SignInGate webinar={webinar} />;

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
          <div className="truncate text-[11.5px] text-white/50">{sessionLine(webinar)}</div>
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

function SignInGate({ webinar }: { webinar: Webinar }) {
  const loginHref = `/login?next=${encodeURIComponent(`${webinarHref(webinar)}/live`)}`;

  return (
    <div className="grid min-h-dvh place-items-center bg-ink px-6 py-10">
      <div className="w-full max-w-md text-center">
        {webinar.coverImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- Supabase storage host isn't in images.remotePatterns
          <img
            src={webinar.coverImageUrl}
            alt=""
            className="mb-6 aspect-[1200/627] w-full rounded-lg object-cover"
          />
        )}
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-green-500">
          Live session
        </div>
        <h1 className="mt-2 text-[21px] font-semibold leading-tight tracking-tight text-white">
          {webinar.hook ?? webinar.title}
        </h1>
        <p className="mt-1.5 text-[13px] text-white/50">{sessionLine(webinar)}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Link
            href={loginHref}
            className="rounded-pill bg-white px-5 py-2.5 text-[13px] font-semibold text-ink transition-opacity hover:opacity-85"
          >
            Sign in to join
          </Link>
          <Link
            href={webinarHref(webinar)}
            className="rounded-pill bg-white/10 px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-white/20"
          >
            Webinar details
          </Link>
        </div>
      </div>
    </div>
  );
}
