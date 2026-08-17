import Link from "next/link";
import { ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";
import { Card, Chip } from "@/components/ui";
import { ShareButton } from "@/components/share/share-button";
import { JoinButton } from "@/components/webinars/join-button";
import { RsvpButton } from "@/components/webinars/rsvp-button";
import { webinarHref } from "@/lib/share/href";
import type { RsvpContactDefaults } from "@/lib/webinars/contact";
import type { Webinar, WebinarInstructor } from "@/lib/webinars/repo";

export function fmtDate(iso: string | null): string {
  if (!iso) return "Date TBA";
  return new Date(iso).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
}

export function fmtTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

export function WebinarCard({
  webinar,
  attending,
  signedIn,
  contactDefaults,
}: {
  webinar: Webinar;
  attending: boolean;
  signedIn: boolean;
  /** Prefills the RSVP form — see fetchRsvpContactDefaults. */
  contactDefaults: RsvpContactDefaults;
}) {
  const href = webinarHref(webinar);

  return (
    <Card className="flex h-full flex-col p-5">
      {webinar.coverImageUrl && (
        <Link href={href} className="-mx-5 -mt-5 mb-4 block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={webinar.coverImageUrl}
            alt=""
            className="aspect-[1200/627] w-full max-w-none rounded-t-2xl object-cover"
          />
        </Link>
      )}
      <div className="flex items-center justify-between gap-2">
        <Chip tone="green">Free</Chip>
        <span className="text-[12px] font-semibold text-gray-600">
          {fmtDate(webinar.scheduledAt)}
          {webinar.scheduledAt ? ` · ${fmtTime(webinar.scheduledAt)} IST` : ""}
        </span>
      </div>
      <Link href={href} className="mt-3 block">
        <h3 className="text-[15.5px] font-semibold text-ink transition-colors hover:text-teal-700">
          {webinar.hook ?? webinar.title}
        </h3>
        {webinar.hook && <p className="mt-1 text-[12.5px] text-gray-500">{webinar.title}</p>}
      </Link>
      {webinar.instructors.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {webinar.instructors.map((instructor) => (
            <InstructorRow key={instructor.id} instructor={instructor} />
          ))}
        </div>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
        {signedIn && (
          <JoinButton
            shareSlug={webinar.shareSlug}
            scheduledAt={webinar.scheduledAt}
            durationMinutes={webinar.durationMinutes}
            serverNow={new Date().toISOString()}
          />
        )}
        <RsvpButton
          webinarId={webinar.id}
          webinarTitle={webinar.hook ?? webinar.title}
          shareSlug={webinar.shareSlug}
          initialAttending={attending}
          signedIn={signedIn}
          contactDefaults={contactDefaults}
        />
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
        <ShareButton path={href} title={webinar.hook ?? webinar.title} className="ml-auto" />
      </div>
    </Card>
  );
}

function InstructorRow({ instructor }: { instructor: WebinarInstructor }) {
  return (
    <div className="flex items-center gap-2.5">
      {instructor.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={instructor.photo} alt="" className="size-8 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-teal-900 text-[11px] font-semibold text-white">
          {instructor.initials}
        </span>
      )}
      <div className="min-w-0">
        <div className="truncate text-[12.5px] font-semibold text-ink">{instructor.name}</div>
        {(instructor.role || instructor.company) && (
          <div className="truncate text-[11.5px] text-gray-500">
            {[instructor.role, instructor.company].filter(Boolean).join(" · ")}
          </div>
        )}
      </div>
    </div>
  );
}
