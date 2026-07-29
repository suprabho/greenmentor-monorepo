import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowSquareOut, CalendarBlank, Clock } from "@phosphor-icons/react/dist/ssr";
import { Card, Chip } from "@/components/ui";
import { ShareButton } from "@/components/share/share-button";
import { JoinButton } from "@/components/webinars/join-button";
import { RsvpButton } from "@/components/webinars/rsvp-button";
import { fmtDate, fmtTime } from "@/components/webinars/webinar-card";
import { shareMetadata } from "@/lib/share/og";
import { webinarHref } from "@/lib/share/href";
import { fetchUserRsvpIds, resolveWebinar, type Webinar } from "@/lib/webinars/repo";
import { getWebinarPhase } from "@/lib/webinars/status";
import { createClient } from "@/lib/supabase/server";

// Shareable per-webinar page. Public on purpose — /webinars isn't in
// middleware's PROTECTED_PATHS, and webinars_public grants select to anon — so
// a link sent to someone who has never signed in still renders. The live room
// at /webinars/:slug/live is the part that gates.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const webinar = await resolveWebinar(slug);
  if (!webinar) return { title: "Webinar not found — Green Mentor Pro" };

  return shareMetadata({
    title: webinar.hook ?? webinar.title,
    description: webinar.hook ? webinar.title : whenLine(webinar),
    path: webinarHref(webinar),
    // Cover images are already public 1200×627 CDN URLs from the Aura Header
    // pipeline, so they make a better card than anything generated.
    image: webinar.coverImageUrl,
    badge: "Webinar",
    subtitle: whenLine(webinar),
  });
}

function whenLine(webinar: Webinar): string {
  if (!webinar.scheduledAt) return "Date to be announced";
  const duration = webinar.durationMinutes ? ` · ${webinar.durationMinutes} min` : "";
  return `${fmtDate(webinar.scheduledAt)} · ${fmtTime(webinar.scheduledAt)} IST${duration}`;
}

export default async function WebinarDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const webinar = await resolveWebinar(slug);
  if (!webinar) notFound();

  // Old links (a renamed webinar, or a bare uuid) still resolve — send them on
  // to the canonical URL so what people copy from the address bar is current.
  const href = webinarHref(webinar);
  if (slug !== webinar.shareSlug) redirect(href);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const rsvpIds = user ? await fetchUserRsvpIds(user.id) : new Set<string>();

  const phase = getWebinarPhase(webinar);
  const speakers = webinar.instructors;

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/webinars"
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-gray-500 transition-colors hover:text-gray-800"
      >
        <ArrowLeft size={14} weight="bold" /> All webinars
      </Link>

      <Card className="overflow-hidden">
        {webinar.coverImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- Supabase storage host isn't in images.remotePatterns
          <img
            src={webinar.coverImageUrl}
            alt=""
            className="aspect-[1200/627] w-full object-cover"
          />
        )}

        <div className="p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="green">Free</Chip>
            {phase === "ended" ? (
              <Chip tone="neutral">Past session</Chip>
            ) : phase === "joinable" ? (
              <Chip tone="warn">Live now</Chip>
            ) : null}
          </div>

          <h1 className="mt-3 text-[24px] font-semibold leading-tight tracking-tight text-ink">
            {webinar.hook ?? webinar.title}
          </h1>
          {webinar.hook && <p className="mt-1.5 text-[14px] text-gray-600">{webinar.title}</p>}

          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] font-medium text-gray-600">
            <span className="flex items-center gap-1.5">
              <CalendarBlank size={14} />
              {webinar.scheduledAt ? `${fmtDate(webinar.scheduledAt)} · ${fmtTime(webinar.scheduledAt)} IST` : "Date TBA"}
            </span>
            {webinar.durationMinutes && (
              <span className="flex items-center gap-1.5">
                <Clock size={14} /> {webinar.durationMinutes} min
              </span>
            )}
          </div>

          {speakers.length > 0 && (
            <div className="mt-6">
              <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-gray-500">
                {speakers.length === 1 ? "Speaker" : "Speakers"}
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {speakers.map((instructor) => (
                  <div key={instructor.id} className="flex items-center gap-3">
                    {instructor.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={instructor.photo} alt="" className="size-11 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-teal-900 text-[13px] font-semibold text-white">
                        {instructor.initials}
                      </span>
                    )}
                    <div className="min-w-0">
                      <div className="truncate text-[13.5px] font-semibold text-ink">{instructor.name}</div>
                      {(instructor.role || instructor.company) && (
                        <div className="truncate text-[12px] text-gray-500">
                          {[instructor.role, instructor.company].filter(Boolean).join(" · ")}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-7 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-5">
            {user && (
              <JoinButton
                shareSlug={webinar.shareSlug}
                scheduledAt={webinar.scheduledAt}
                durationMinutes={webinar.durationMinutes}
                serverNow={new Date().toISOString()}
              />
            )}
            {phase !== "ended" && (
              <RsvpButton
                webinarId={webinar.id}
                initialAttending={rsvpIds.has(webinar.id)}
                signedIn={Boolean(user)}
              />
            )}
            {webinar.registrationUrl && (
              <a
                href={webinar.registrationUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3.5 py-1.5 text-[12.5px] font-semibold text-gray-700 transition-colors hover:bg-gray-50"
              >
                Register <ArrowSquareOut size={13} />
              </a>
            )}
            <ShareButton path={href} title={webinar.hook ?? webinar.title} variant="full" className="ml-auto" />
          </div>
        </div>
      </Card>
    </div>
  );
}
