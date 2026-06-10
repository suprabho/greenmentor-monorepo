import { VideoCamera, Coins, CheckCircle, PlayCircle } from "@phosphor-icons/react/dist/ssr";
import { Card, Chip, PageHeader } from "@/components/ui";
import { webinars, libraryItems } from "@/lib/data";

export default function WebinarsPage() {
  const recordings = libraryItems.filter((l) => l.type === "Recording");

  return (
    <div>
      <PageHeader
        title="Webinars"
        sub="Live practitioner sessions every week. Attending earns +50 credits; recordings land in the Content Library."
      />

      <h2 className="mb-3 text-[15px] font-semibold text-ink">Upcoming</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {webinars.map((w) => (
          <Card key={w.id} className="p-5">
            <div className="flex items-start gap-4">
              <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-teal-900 text-center text-white">
                <div>
                  <div className="text-[10px] font-bold uppercase text-green-500">{w.date.split(" ")[0]}</div>
                  <div className="text-[18px] font-semibold leading-none">{w.date.split(" ")[1]}</div>
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-[15px] font-semibold leading-snug text-ink">{w.title}</h3>
                <p className="mt-1 text-[12.5px] text-gray-600">{w.time} · {w.speaker}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Chip tone="green"><Coins size={11} weight="fill" /> +{w.credits} credits</Chip>
                  {w.rsvp ? (
                    <Chip tone="teal"><CheckCircle size={11} weight="fill" /> RSVP&apos;d</Chip>
                  ) : (
                    <button className="rounded-pill bg-teal-900 px-4 py-1 text-[12px] font-semibold text-white">RSVP free</button>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <h2 className="mb-3 mt-8 text-[15px] font-semibold text-ink">Recent recordings</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {recordings.map((r) => (
          <Card key={r.id} className="flex items-center gap-4 p-5">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-green-50 text-green-700">
              <PlayCircle size={24} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-semibold leading-snug text-ink">{r.title}</div>
              <div className="text-[12px] text-gray-600">{r.meta}</div>
            </div>
            {r.price === 0 ? (
              <Chip tone="green">Free</Chip>
            ) : (
              <Chip tone="warn"><Coins size={11} weight="fill" /> {r.price} cr</Chip>
            )}
          </Card>
        ))}
        <Card className="flex items-center justify-center gap-2 border-dashed p-5 text-[13px] font-semibold text-gray-500">
          <VideoCamera size={18} /> Full archive lives in the Content Library
        </Card>
      </div>
    </div>
  );
}
