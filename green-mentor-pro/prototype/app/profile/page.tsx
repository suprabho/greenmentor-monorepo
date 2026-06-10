import Link from "next/link";
import {
  Lightning,
  Fire,
  Coins,
  Medal,
  Certificate,
  ShareNetwork,
  Lock,
  CheckCircle,
  Briefcase,
  ArrowRight,
} from "@phosphor-icons/react/dist/ssr";
import { Card, Chip, PageHeader, ProgressBar, Stat } from "@/components/ui";
import { me, profileSkills, credentials } from "@/lib/data";

export default function ProfilePage() {
  return (
    <div>
      <PageHeader
        title="Green Learning Profile"
        sub="Your portable record of everything you've learned and built. Share it publicly, attach it to job applications."
        action={
          <button className="flex items-center gap-1.5 rounded-pill bg-teal-900 px-4 py-2 text-[12.5px] font-semibold text-white">
            <ShareNetwork size={15} /> Share public profile
          </button>
        }
      />

      {/* Identity band */}
      <Card className="mb-6 overflow-hidden">
        <div className="bg-stat-band p-6 text-white md:p-8">
          <div className="flex flex-wrap items-center gap-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={me.avatar}
              alt={me.name}
              className="size-16 rounded-2xl object-cover ring-2 ring-white/40"
            />
            <div className="min-w-0 flex-1">
              <h2 className="text-[20px] font-semibold tracking-tight">{me.name}</h2>
              <p className="text-[13px] text-green-100/90">{me.headline} · {me.handle}</p>
              <p className="mt-0.5 text-[12px] text-green-100/70">greenmentor.pro/p/supro</p>
            </div>
            <div className="flex gap-6">
              <div className="text-center">
                <div className="flex items-center gap-1 text-[20px] font-bold"><Lightning size={17} weight="fill" className="text-green-100" />{me.xp.toLocaleString()}</div>
                <div className="text-[11px] uppercase tracking-wide text-green-100/80">XP</div>
              </div>
              <div className="text-center">
                <div className="flex items-center gap-1 text-[20px] font-bold"><Fire size={17} weight="fill" className="text-green-100" />{me.streak}</div>
                <div className="text-[11px] uppercase tracking-wide text-green-100/80">Streak</div>
              </div>
              <div className="text-center">
                <div className="flex items-center gap-1 text-[20px] font-bold"><Coins size={17} weight="fill" className="text-green-100" />{me.credits.toLocaleString()}</div>
                <div className="text-[11px] uppercase tracking-wide text-green-100/80">Credits</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5 p-6 sm:grid-cols-4">
          <Stat label="Courses" value="1" sub="ESG Fundamentals · 43%" />
          <Stat label="Lessons done" value="24" sub="this month: 11" />
          <Stat label="Quiz accuracy" value="88%" sub="10 perfect quizzes" />
          <Stat label="Webinars" value="4" sub="+200 credits earned" />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Skills graph */}
        <Card className="p-6">
          <h3 className="text-[15px] font-semibold text-ink">Skills graph</h3>
          <p className="mt-1 text-[12.5px] text-gray-600">Built from lesson tags as you learn. Jobs use this for match scores.</p>
          <div className="mt-5 space-y-4">
            {profileSkills.map((s) => (
              <div key={s.name}>
                <div className="mb-1.5 flex justify-between text-[13px]">
                  <span className="font-medium text-ink">{s.name}</span>
                  <span className="font-semibold text-gray-600">{s.level}</span>
                </div>
                <ProgressBar value={s.level} />
              </div>
            ))}
          </div>
          <Link href="/jobs" className="mt-5 flex items-center gap-1.5 text-[13px] font-semibold text-green-700">
            <Briefcase size={15} /> See jobs that match this graph <ArrowRight size={13} />
          </Link>
        </Card>

        {/* Credentials */}
        <Card className="p-6">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <Certificate size={18} className="text-green-700" /> Credentials & badges
          </h3>
          <div className="mt-4 space-y-3">
            {credentials.map((c) => (
              <div key={c.title} className="flex items-center gap-3 rounded-xl border border-gray-100 p-3.5">
                <span
                  className={
                    "grid size-9 shrink-0 place-items-center rounded-xl " +
                    (c.state === "earned" ? "bg-green-50 text-green-700" : c.state === "locked" ? "bg-[#FFF4E0] text-[#B25E00]" : "bg-gray-100 text-gray-400")
                  }
                >
                  {c.state === "earned" ? <CheckCircle size={18} weight="fill" /> : c.state === "locked" ? <Lock size={17} /> : <Medal size={18} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold text-ink">{c.title}</div>
                  <div className="text-[12px] text-gray-600">{c.status}</div>
                </div>
                <span className="text-[11.5px] font-medium text-gray-500">{c.date}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {me.badges.map((b) => (
              <Chip key={b} tone="green"><Medal size={11} weight="fill" /> {b}</Chip>
            ))}
          </div>
        </Card>

        {/* Portfolio */}
        <Card className="p-6 lg:col-span-2">
          <h3 className="text-[15px] font-semibold text-ink">Portfolio — assessment artifacts</h3>
          <p className="mt-1 text-[12.5px] text-gray-600">Work produced in Longsite Lite during assessments appears here, verifiable by recruiters.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-dashed border-gray-300 p-5 text-center">
              <div className="text-[13px] font-semibold text-gray-700">Emissions baseline — Verdant Mills</div>
              <div className="mt-1 text-[12px] text-gray-500">Unlocks when you submit the ESG Fundamentals final assessment</div>
              <Link href="/academy/assessment" className="mt-2 inline-block text-[12.5px] font-semibold text-green-700">View brief →</Link>
            </div>
            <div className="rounded-xl border border-dashed border-gray-300 p-5 text-center">
              <div className="text-[13px] font-semibold text-gray-700">Your next artifact</div>
              <div className="mt-1 text-[12px] text-gray-500">Each completed course adds a verified work sample</div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
