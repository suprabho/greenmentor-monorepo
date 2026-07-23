import Link from "next/link";
import { ArrowSquareOut, VideoCamera } from "@phosphor-icons/react/dist/ssr";
import { Card, Chip } from "@/components/ui";
import { RsvpButton } from "@/components/webinars/rsvp-button";
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
}: {
  webinar: Webinar;
  attending: boolean;
  signedIn: boolean;
}) {
  return (
    <Card className="flex h-full flex-col p-5">
      {webinar.coverImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={webinar.coverImageUrl}
          alt=""
          className="-mx-5 -mt-5 mb-4 aspect-[1200/627] w-[calc(100%+2.5rem)] max-w-none rounded-t-2xl object-cover"
        />
      )}
      <div className="flex items-center justify-between gap-2">
        <Chip tone="green">Free</Chip>
        <span className="text-[12px] font-semibold text-gray-600">
          {fmtDate(webinar.scheduledAt)}
          {webinar.scheduledAt ? ` · ${fmtTime(webinar.scheduledAt)} IST` : ""}
        </span>
      </div>
      <h3 className="mt-3 text-[15.5px] font-semibold text-ink">{webinar.hook ?? webinar.title}</h3>
      {webinar.hook && <p className="mt-1 text-[12.5px] text-gray-500">{webinar.title}</p>}
      {webinar.instructors.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {webinar.instructors.map((instructor) => (
            <InstructorRow key={instructor.id} instructor={instructor} />
          ))}
        </div>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
        {signedIn && (
          <Link
            href={`/webinars/${webinar.id}/live`}
            className="inline-flex items-center gap-1.5 rounded-full bg-teal-900 px-3.5 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-teal-800"
          >
            <VideoCamera size={14} weight="fill" /> Join
          </Link>
        )}
        <RsvpButton webinarId={webinar.id} initialAttending={attending} signedIn={signedIn} />
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
