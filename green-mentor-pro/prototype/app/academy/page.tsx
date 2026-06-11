import Link from "next/link";
import { Star, Clock, Users, ArrowRight, Sparkle, VideoCamera, Trophy } from "@phosphor-icons/react/dist/ssr";
import { Card, Chip, PageHeader, ProgressBar } from "@/components/ui";
import { courses } from "@/lib/data";

export default function AcademyPage() {
  const fundamental = courses[0];
  const paid = courses.slice(1);

  return (
    <div>
      <PageHeader
        title="Academy"
        sub="Bite-sized, gamified ESG learning. Start free, certify when you're ready."
        action={
          <div className="flex gap-2">
            <Link href="/academy/webinars" className="flex items-center gap-1.5 rounded-pill border border-gray-200 bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-gray-800">
              <VideoCamera size={14} /> Webinars
            </Link>
            <Link href="/feed/leaderboards" className="flex items-center gap-1.5 rounded-pill border border-gray-200 bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-gray-800">
              <Trophy size={14} /> Leaderboard
            </Link>
          </div>
        }
      />

      {/* Fundamental hero */}
      <Card className="mb-8 overflow-hidden">
        <div className="grid md:grid-cols-[1.4fr_1fr]">
          <div className="p-6 md:p-8">
            <div className="flex flex-wrap gap-2">
              <Chip tone="green">Free with limitations</Chip>
              <Chip tone="neutral">Beginner</Chip>
            </div>
            <h2 className="mt-3 text-[24px] font-semibold tracking-tight text-ink">{fundamental.title}</h2>
            <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-gray-700">{fundamental.blurb}</p>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-[12.5px] font-medium text-gray-600">
              <span className="flex items-center gap-1.5"><Star size={14} weight="fill" className="text-[#E8B400]" /> {fundamental.rating}</span>
              <span className="flex items-center gap-1.5"><Clock size={14} /> {fundamental.duration}</span>
              <span className="flex items-center gap-1.5"><Users size={14} /> {fundamental.learners.toLocaleString()} learners</span>
              <span>{fundamental.modules} modules</span>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-4">
              <Link href="/academy/lesson" className="flex items-center gap-2 rounded-pill bg-teal-900 px-5 py-2.5 text-[13.5px] font-semibold text-white hover:bg-teal-800">
                Continue learning <ArrowRight size={15} weight="bold" />
              </Link>
              <div className="flex-1 max-w-44">
                <div className="mb-1 flex justify-between text-[11.5px] font-semibold text-gray-600">
                  <span>Your progress</span><span>43%</span>
                </div>
                <ProgressBar value={43} />
              </div>
            </div>
          </div>
          <div className="relative hidden items-center justify-center overflow-hidden p-8 md:flex">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fundamental.image}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-teal-900/85 via-teal-900/60 to-teal-900/40" />
            <div className="relative text-center text-white">
              <Sparkle size={34} weight="fill" className="mx-auto text-green-100" />
              <div className="mt-3 text-[15px] font-semibold leading-snug">Finish to unlock your<br />Green Learning Profile boost</div>
              <div className="mt-1 text-[12px] text-green-100/90">+100 bonus credits on completion</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Paid catalog */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-[17px] font-semibold tracking-tight text-ink">Courses & certifications</h2>
        <div className="flex flex-wrap gap-2">
          {["All", "Beginner", "Intermediate", "Advanced"].map((f, i) => (
            <button
              key={f}
              className={
                i === 0
                  ? "rounded-pill bg-teal-900 px-3 py-1 text-[11.5px] font-semibold text-white"
                  : "rounded-pill border border-gray-200 bg-white px-3 py-1 text-[11.5px] font-medium text-gray-700"
              }
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {paid.map((c) => (
          <Card key={c.id} className="flex flex-col overflow-hidden">
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.image} alt="" className="h-36 w-full object-cover" />
              <span className="absolute left-3 top-3 rounded-pill bg-white/90 px-2.5 py-0.5 text-[11.5px] font-semibold text-gray-800 backdrop-blur">
                {c.level}
              </span>
              <span className="absolute right-3 top-3 rounded-pill bg-teal-900/90 px-2.5 py-0.5 text-[12px] font-bold text-white backdrop-blur">
                ₹{c.price.toLocaleString()}
              </span>
            </div>
            <div className="flex flex-1 flex-col p-5 pt-4">
            <h3 className="text-[16px] font-semibold tracking-tight text-ink">{c.title}</h3>
            <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-gray-700">{c.blurb}</p>
            <div className="mt-3 flex items-center gap-3 text-[12px] font-medium text-gray-600">
              <span className="flex items-center gap-1"><Star size={13} weight="fill" className="text-[#E8B400]" /> {c.rating}</span>
              <span className="flex items-center gap-1"><Clock size={13} /> {c.duration}</span>
              <span>{c.modules} modules</span>
            </div>
            <Link
              href="/academy/course"
              className="mt-4 flex items-center justify-center gap-1.5 rounded-pill border border-teal-900 py-2 text-[12.5px] font-semibold text-teal-900 hover:bg-teal-900 hover:text-white"
            >
              View course <ArrowRight size={13} />
            </Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
