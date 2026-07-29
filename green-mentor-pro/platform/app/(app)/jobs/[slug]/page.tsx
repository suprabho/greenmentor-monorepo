import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowSquareOut,
  Briefcase,
  CalendarBlank,
  Clock,
  MapPin,
} from "@phosphor-icons/react/dist/ssr";
import { Card, Chip } from "@/components/ui";
import { ShareButton } from "@/components/share/share-button";
import { jobHref } from "@/lib/share/href";
import { resolveJob, type Job } from "@/lib/jobs/repo";
import { shareMetadata } from "@/lib/share/og";

// Shareable per-job page. Public — /jobs isn't in middleware's PROTECTED_PATHS
// and jobs_public grants select to anon, so recruiters can pass the link to
// candidates who have never signed in.
export const dynamic = "force-dynamic";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Format an ISO date ("2026-06-20") without timezone drift. */
function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "";
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

function whereLine(job: Job): string {
  return [job.company, job.location].filter(Boolean).join(" · ");
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const job = await resolveJob(slug);
  if (!job) return { title: "Job not found — Green Mentor Pro" };

  return shareMetadata({
    title: job.title,
    // Jobs have no artwork of their own, so this doubles as the generated
    // card's subtitle and the link-preview description.
    description: job.details || [whereLine(job), job.employmentType].filter(Boolean).join(" · "),
    path: jobHref(job),
    badge: "ESG Job",
    subtitle: [whereLine(job), job.employmentType].filter(Boolean).join(" · "),
  });
}

export default async function JobDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const job = await resolveJob(slug);
  if (!job) notFound();

  // Old links (a renamed role, or a bare uuid) still resolve — send them on to
  // the canonical URL so what people copy from the address bar is current.
  const href = jobHref(job);
  if (slug !== job.shareSlug) redirect(href);

  const applyHref = job.applyUrl ?? (job.applyEmail ? `mailto:${job.applyEmail}` : null);
  const meta = [
    job.location ? { icon: MapPin, text: job.location } : null,
    job.experience ? { icon: Clock, text: job.experience } : null,
    job.postedOn ? { icon: CalendarBlank, text: `Posted ${fmtDate(job.postedOn)}` } : null,
  ].filter((x): x is { icon: typeof MapPin; text: string } => x !== null);

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/jobs"
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-gray-500 transition-colors hover:text-gray-800"
      >
        <ArrowLeft size={14} weight="bold" /> All jobs
      </Link>

      <Card className="p-6">
        <div className="flex flex-wrap items-start gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-teal-900 text-[15px] font-bold text-green-500">
            {(job.company ?? job.title).replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "GM"}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[22px] font-semibold leading-tight tracking-tight text-ink">{job.title}</h1>
              <Chip tone="neutral">{job.employmentType}</Chip>
              {job.seniority && <Chip tone="teal">{job.seniority}</Chip>}
            </div>
            {job.company && <div className="mt-1 text-[14px] text-gray-700">{job.company}</div>}
            {meta.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] font-medium text-gray-600">
                {meta.map(({ icon: Icon, text }) => (
                  <span key={text} className="flex items-center gap-1.5">
                    <Icon size={14} /> {text}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {(job.salary || job.applicationDeadline) && (
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 rounded-xl bg-gray-50 px-4 py-3 text-[12.5px]">
            {job.salary && (
              <span>
                <span className="text-gray-500">Compensation</span>{" "}
                <span className="font-semibold text-teal-800">{job.salary}</span>
              </span>
            )}
            {job.applicationDeadline && (
              <span>
                <span className="text-gray-500">Apply by</span>{" "}
                <span className="font-semibold text-ink">{fmtDate(job.applicationDeadline)}</span>
              </span>
            )}
          </div>
        )}

        {/* The board card clamps `details` to two lines — this is the whole thing. */}
        {job.details && (
          <Section title="About the role">
            <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-gray-700">{job.details}</p>
          </Section>
        )}

        {job.preferred && (
          <Section title="Preferred qualifications">
            <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-gray-700">{job.preferred}</p>
          </Section>
        )}

        {job.tags.length > 0 && (
          <Section title="Skills">
            <div className="flex flex-wrap gap-1.5">
              {job.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-pill bg-green-50 px-2.5 py-0.5 text-[11.5px] font-semibold text-green-700"
                >
                  {tag}
                </span>
              ))}
            </div>
          </Section>
        )}

        <div className="mt-7 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-5">
          {applyHref ? (
            <a
              href={applyHref}
              target={job.applyUrl ? "_blank" : undefined}
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-pill bg-teal-900 px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-teal-800"
            >
              Apply now <ArrowSquareOut size={14} />
            </a>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-pill border border-gray-200 px-5 py-2.5 text-[13px] font-medium text-gray-400">
              <Briefcase size={14} /> No application link
            </span>
          )}
          <ShareButton path={href} title={job.title} variant="full" className="ml-auto" />
        </div>
      </Card>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-gray-500">{title}</h2>
      {children}
    </div>
  );
}
