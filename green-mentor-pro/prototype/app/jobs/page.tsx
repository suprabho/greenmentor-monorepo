import Link from "next/link";
import {
  MapPin,
  CurrencyInr,
  CheckCircle,
  XCircle,
  FileMagnifyingGlass,
  Microphone,
  ArrowRight,
  Briefcase,
} from "@phosphor-icons/react/dist/ssr";
import { Card, Chip, PageHeader } from "@/components/ui";
import { jobs } from "@/lib/data";

export default function JobsPage() {
  return (
    <div>
      <PageHeader
        title="Jobs"
        sub="Unlimited browsing of ESG roles, matched against your Green Learning Profile. Apply with your profile in two clicks."
        action={<Chip tone="warn">3 of 5 free applications left</Chip>}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {["All roles", "Analyst", "Reporting", "Consulting", "Remote", "Internship"].map((f, i) => (
              <button
                key={f}
                className={
                  i === 0
                    ? "rounded-pill bg-teal-900 px-3.5 py-1.5 text-[12.5px] font-semibold text-white"
                    : "rounded-pill border border-gray-200 bg-white px-3.5 py-1.5 text-[12.5px] font-medium text-gray-700"
                }
              >
                {f}
              </button>
            ))}
          </div>

          {jobs.map((j) => (
            <Card key={j.id} className="p-5">
              <div className="flex flex-wrap items-start gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-teal-900 text-[13px] font-bold text-green-500">
                  {j.company.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[16px] font-semibold tracking-tight text-ink">{j.role}</h2>
                    <Chip tone="neutral">{j.type}</Chip>
                  </div>
                  <div className="mt-0.5 text-[13px] text-gray-700">{j.company}</div>
                  <div className="mt-1.5 flex flex-wrap gap-3 text-[12px] font-medium text-gray-600">
                    <span className="flex items-center gap-1"><MapPin size={13} /> {j.location}</span>
                    <span className="flex items-center gap-1"><CurrencyInr size={13} /> {j.salary}</span>
                    <span>{j.posted}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {j.skills.map((s) => (
                      <span
                        key={s.name}
                        className={
                          "flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-[11.5px] font-semibold " +
                          (s.have ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500")
                        }
                      >
                        {s.have ? <CheckCircle size={11} weight="fill" /> : <XCircle size={11} />}
                        {s.name}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex w-full shrink-0 flex-row items-center justify-between gap-3 sm:w-auto sm:flex-col sm:items-end">
                  <div className="text-right">
                    <div className={"text-[20px] font-bold " + (j.match >= 80 ? "text-green-700" : j.match >= 70 ? "text-teal-800" : "text-gray-600")}>
                      {j.match}%
                    </div>
                    <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">match</div>
                  </div>
                  <button className="rounded-pill bg-teal-900 px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-teal-800">
                    Apply with profile
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <aside className="space-y-4">
          <Card className="p-5">
            <h3 className="flex items-center gap-2 text-[14px] font-semibold text-ink">
              <FileMagnifyingGlass size={18} className="text-green-700" /> Screen your CV
            </h3>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-gray-700">
              ATS check + skill-gap analysis against a target role. First screen is free.
            </p>
            <Link href="/jobs/screen-cv" className="mt-3 flex items-center justify-center gap-1.5 rounded-pill bg-teal-900 py-2 text-[12.5px] font-semibold text-white">
              Screen my CV <ArrowRight size={13} />
            </Link>
          </Card>

          <Card className="p-5">
            <h3 className="flex items-center gap-2 text-[14px] font-semibold text-ink">
              <Microphone size={18} className="text-green-700" /> Mock interviews
            </h3>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-gray-700">
              Practice role-specific questions with AI feedback. Free taster question included.
            </p>
            <Link href="/jobs/mock-interview" className="mt-3 flex items-center justify-center gap-1.5 rounded-pill border border-teal-900 py-2 text-[12.5px] font-semibold text-teal-900 hover:bg-teal-900 hover:text-white">
              Start practicing <ArrowRight size={13} />
            </Link>
          </Card>

          <Card className="bg-teal-900 p-5 text-white">
            <h3 className="flex items-center gap-2 text-[13.5px] font-semibold">
              <Briefcase size={17} className="text-green-500" /> Application pack
            </h3>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-green-100/80">
              Used your 5 free applications? Get 10 more for 300 credits.
            </p>
            <button className="mt-3 w-full rounded-pill bg-green-500 py-2 text-[12.5px] font-bold text-teal-900">
              Get application pack
            </button>
          </Card>
        </aside>
      </div>
    </div>
  );
}
