import Link from "next/link";
import {
  ThumbsUp,
  ThumbsDown,
  ChatCircle,
  ShareNetwork,
  CalendarDots,
  Trophy,
  Books,
  Fire,
  ArrowRight,
} from "@phosphor-icons/react/dist/ssr";
import { Avatar, Card, Chip, PageHeader } from "@/components/ui";
import { feedItems, webinars, esgTasks, avatarFor, me } from "@/lib/data";

const filters = ["All", "Regulation", "Climate", "Reporting", "Careers", "Webinars", "India", "Global"];

export default function FeedPage() {
  return (
    <div>
      <PageHeader
        title="Feed"
        sub="Open global feed of news and updates from the ESG world. Free to read — sign in to react and join the conversation."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        {/* Feed column */}
        <div className="min-w-0">
          <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
            {filters.map((f, i) => (
              <button
                key={f}
                className={
                  i === 0
                    ? "shrink-0 rounded-pill bg-teal-900 px-3.5 py-1.5 text-[12.5px] font-semibold text-white"
                    : "shrink-0 rounded-pill border border-gray-200 bg-white px-3.5 py-1.5 text-[12.5px] font-medium text-gray-700 hover:border-gray-300"
                }
              >
                {f}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {feedItems.map((item) => (
              <Card key={item.id} className="p-5">
                <div className="flex items-center gap-2 text-[12px] text-gray-600">
                  <span className="grid size-6 place-items-center rounded-md bg-teal-900 text-[10px] font-bold text-green-500">
                    {item.source.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="font-semibold text-gray-800">{item.source}</span>
                  <span>·</span>
                  <span>{item.time}</span>
                  <Chip tone={item.tag === "Regulation" ? "teal" : item.tag === "Webinar" ? "green" : "neutral"} className="ml-auto">
                    {item.tag}
                  </Chip>
                </div>
                <h2 className="mt-3 text-[16.5px] font-semibold leading-snug tracking-tight text-ink">
                  {item.title}
                </h2>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-gray-700">{item.summary}</p>
                {item.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.image}
                    alt=""
                    className="mt-3 h-48 w-full rounded-xl object-cover sm:h-56"
                  />
                )}

                <div className="mt-4 flex items-center gap-1 border-t border-gray-100 pt-3 text-[12.5px] font-medium text-gray-600">
                  <button className="flex items-center gap-1.5 rounded-pill px-2.5 py-1.5 hover:bg-green-50 hover:text-green-700">
                    <ThumbsUp size={16} /> {item.likes}
                  </button>
                  <button className="flex items-center gap-1.5 rounded-pill px-2.5 py-1.5 hover:bg-gray-100">
                    <ThumbsDown size={16} /> {item.dislikes}
                  </button>
                  <button className="flex items-center gap-1.5 rounded-pill px-2.5 py-1.5 hover:bg-gray-100">
                    <ChatCircle size={16} /> {item.comments.length}
                  </button>
                  <button className="ml-auto flex items-center gap-1.5 rounded-pill px-2.5 py-1.5 hover:bg-gray-100">
                    <ShareNetwork size={16} /> Share
                  </button>
                </div>

                {item.comments.length > 0 && (
                  <div className="mt-3 space-y-2.5 rounded-xl bg-gray-50 p-3.5">
                    {item.comments.map((c, i) => (
                      <div key={i} className="flex gap-2.5">
                        <Avatar src={avatarFor(c.author)} name={c.author} size={28} />
                        <p className="text-[12.5px] leading-relaxed text-gray-800">
                          <span className="font-semibold">{c.author}</span> {c.text}
                        </p>
                      </div>
                    ))}
                    <div className="flex items-center gap-2.5 pt-1">
                      <Avatar src={me.avatar} name={me.name} size={28} />
                      <div className="flex-1 rounded-pill border border-gray-200 bg-white px-3.5 py-1.5 text-[12.5px] text-gray-400">
                        Add a comment…
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>

        {/* Right rail */}
        <aside className="min-w-0 space-y-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
                <CalendarDots size={17} className="text-green-700" /> This week
              </h3>
              <Link href="/feed/calendar" className="flex items-center gap-1 text-[12px] font-semibold text-green-700">
                Calendar <ArrowRight size={12} />
              </Link>
            </div>
            <div className="mt-3 space-y-2.5">
              {webinars.slice(0, 2).map((w) => (
                <div key={w.id} className="rounded-xl bg-gray-50 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-green-700">
                    {w.date} · {w.time}
                  </div>
                  <div className="mt-0.5 text-[12.5px] font-semibold leading-snug text-ink">{w.title}</div>
                </div>
              ))}
              {esgTasks.slice(0, 2).map((t) => (
                <div key={t.id} className="rounded-xl border border-gray-100 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    {t.date} · {t.type}
                  </div>
                  <div className="mt-0.5 text-[12.5px] font-semibold leading-snug text-ink">{t.title}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
                <Trophy size={17} className="text-green-700" /> Weekly board
              </h3>
              <Link href="/feed/leaderboards" className="flex items-center gap-1 text-[12px] font-semibold text-green-700">
                All <ArrowRight size={12} />
              </Link>
            </div>
            <div className="mt-3 space-y-2">
              {["Ananya Iyer", "Rohan Gupta", "Meera Krishnan"].map((n, i) => (
                <div key={n} className="flex items-center gap-2.5 text-[12.5px]">
                  <span className="w-4 text-right font-bold text-gray-500">{i + 1}</span>
                  <Avatar src={avatarFor(n)} name={n} size={28} />
                  <span className="font-medium text-ink">{n}</span>
                  <span className="ml-auto flex items-center gap-1 text-[11.5px] font-semibold text-gray-600">
                    <Fire size={12} weight="fill" className="text-[#FF8A00]" />
                    {[41, 28, 35][i]}d
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="bg-teal-900 p-4 text-white">
            <h3 className="flex items-center gap-2 text-[13.5px] font-semibold">
              <Books size={17} className="text-green-500" /> Content library
            </h3>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-green-100/80">
              Recordings, guides, templates and datasets — free items plus premium picks.
            </p>
            <Link
              href="/feed/library"
              className="mt-3 inline-flex items-center gap-1.5 rounded-pill bg-green-500 px-3.5 py-1.5 text-[12.5px] font-semibold text-teal-900"
            >
              Browse library <ArrowRight size={13} weight="bold" />
            </Link>
          </Card>
        </aside>
      </div>
    </div>
  );
}
