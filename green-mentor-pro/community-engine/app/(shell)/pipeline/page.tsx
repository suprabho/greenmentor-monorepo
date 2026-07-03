import { FlowArrow, ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";
import { Card, Chip, PageHeader, Stat } from "@/components/ui";
import { WorkersPanel } from "@/components/pipeline/workers-panel";
import { EntitiesPanel } from "@/components/pipeline/entities-panel";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { fetchPipelineStats, type PipelineDayPoint, type SourceStat } from "@/lib/pipeline/stats";

export const metadata = { title: "Pipeline — GreenMentor Community" };
export const dynamic = "force-dynamic";

type EntityRef = { slug: string; name: string; kind: string };
type ArticleRow = {
  id: string;
  source: string;
  title: string;
  url: string;
  summary: string | null;
  published_at: string | null;
  created_at: string;
  article_entities: { entities: EntityRef | null }[] | null;
};

const KIND_TONE: Record<string, "green" | "teal" | "neutral" | "warn"> = {
  framework: "teal",
  topic: "green",
  region: "warn",
  company: "neutral",
};

const RECENT_LIMIT = 12;

function ago(iso: string | null): string {
  if (!iso) return "—";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

const fmtDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const fmtDay = (day: string): string =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });

const entitiesOf = (a: ArticleRow): EntityRef[] =>
  (a.article_entities ?? []).map((ae) => ae.entities).filter((e): e is EntityRef => !!e);

const pct = (part: number, total: number): string => (total > 0 ? `${Math.round((part / total) * 100)}%` : "—");

/** Ingest is daily (06:30 UTC) — warn once we're a full cycle plus slack behind. */
function freshnessTone(mins: number | null): "default" | "ok" | "warn" {
  if (mins == null) return "default";
  return mins > 30 * 60 ? "warn" : "ok";
}

function SectionHeading({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <div className="mb-2 flex items-baseline justify-between">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">{children}</h2>
      {note && <span className="text-[12px] text-gray-500">{note}</span>}
    </div>
  );
}

/**
 * 14-day ingest volume as a single-series bar chart: brand green bars (one
 * series → one hue, no legend), rounded data-ends on the baseline, CSS-only
 * per-bar hover tooltip, sparse day-of-month labels in text tokens.
 */
function IngestByDay({ data }: { data: PipelineDayPoint[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex items-end gap-1.5 pt-8">
      {data.map((d, i) => {
        const h = d.count > 0 ? Math.max(6, Math.round((d.count / max) * 80)) : 2;
        return (
          <div key={d.day} className="group relative flex flex-1 flex-col items-center">
            <span
              className="pointer-events-none absolute -top-7 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-teal-900 px-2 py-0.5 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100"
              role="tooltip"
            >
              {fmtDay(d.day)} · {d.count} article{d.count === 1 ? "" : "s"}
            </span>
            <div
              className={d.count > 0 ? "w-full max-w-3 rounded-t-[4px] bg-green-700" : "w-full max-w-3 rounded-t-[4px] bg-gray-200"}
              style={{ height: h }}
            />
            <span className="mt-1 text-[10px] tabular-nums text-gray-400">
              {i % 2 === 0 ? d.day.slice(8) : " "}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SourceRow({ s }: { s: SourceStat }) {
  const missing = s.total - s.summarized;
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 p-5">
      <div className="flex items-baseline gap-2">
        <span className="text-[14px] font-semibold text-ink">{s.source}</span>
        <span className="text-[12px] text-gray-500">
          {s.total} article{s.total === 1 ? "" : "s"}
        </span>
      </div>
      <div className="flex gap-4 text-[12px] text-gray-500">
        <span>
          Summarized{" "}
          <span className={missing > 0 ? "font-semibold text-[#B25E00]" : "font-semibold text-ink"}>
            {pct(s.summarized, s.total)}
          </span>
        </span>
        <span>
          Image <span className="font-semibold text-ink">{pct(s.withImage, s.total)}</span>
        </span>
        <span>
          Tagged <span className="font-semibold text-ink">{pct(s.withTags, s.total)}</span>
        </span>
      </div>
    </div>
  );
}

export default async function PipelinePage() {
  await requireAdmin();
  const supabase = await createClient();

  const [stats, articlesRes] = await Promise.all([
    fetchPipelineStats(),
    supabase
      .from("articles")
      .select("id, source, title, url, summary, published_at, created_at, article_entities(entities(slug, name, kind))")
      .order("created_at", { ascending: false })
      .limit(RECENT_LIMIT),
  ]);

  const articles = (articlesRes.data ?? []) as unknown as ArticleRow[];
  const { articles: a, freshness, bySource, byDay, entityList } = stats;
  const missingSummary = a.total - a.summarized;
  const ingested14d = byDay.reduce((sum, d) => sum + d.count, 0);

  return (
    <div>
      <PageHeader
        title="Pipeline"
        sub="Content ingested into the Open Global ESG Feed — AI-summarized regulatory & sustainability news."
        action={
          <span className="hidden text-[12.5px] text-gray-500 sm:block">
            Last ingested <span className="font-semibold text-gray-700">{ago(freshness.latestIngestedAt)}</span>
          </span>
        }
      />

      {/* workers + manual triggers */}
      <div className="mb-6">
        <WorkersPanel />
      </div>

      <SectionHeading>Freshness</SectionHeading>
      <Card className="mb-6 grid grid-cols-2 gap-y-5 p-5 sm:grid-cols-4">
        <Stat
          label="Last ingest"
          value={ago(freshness.latestIngestedAt)}
          sub={fmtDate(freshness.latestIngestedAt)}
          tone={freshnessTone(freshness.minutesSinceLatest)}
        />
        <Stat label="Articles" value={String(a.total)} sub="in the feed" />
        <Stat label="Sources" value={String(bySource.length)} sub={bySource.slice(0, 3).map((s) => s.source).join(" · ") || "—"} />
        <Stat label="Last 14 days" value={String(ingested14d)} sub="articles ingested" />
      </Card>

      <SectionHeading>Articles</SectionHeading>
      <Card className="mb-6 grid grid-cols-2 gap-y-5 p-5 sm:grid-cols-4">
        <Stat label="Summarized" value={String(a.summarized)} sub={pct(a.summarized, a.total)} tone="ok" />
        <Stat
          label="Missing summary"
          value={String(missingSummary)}
          sub={missingSummary > 0 ? "needs a re-run" : "all clear"}
          tone={missingSummary > 0 ? "warn" : "default"}
        />
        <Stat label="With image" value={pct(a.withImage, a.total)} sub={`${a.withImage} articles`} />
        <Stat label="Tagged" value={pct(a.withTags, a.total)} sub={`${a.withTags} articles`} />
      </Card>

      <div className="mb-6">
        <EntitiesPanel entities={entityList} />
      </div>

      <SectionHeading note={`${ingested14d} total`}>Ingested · last 14 days</SectionHeading>
      <Card className="mb-6 p-5">
        <IngestByDay data={byDay} />
      </Card>

      <SectionHeading>By source</SectionHeading>
      <Card className="mb-6 divide-y divide-gray-100">
        {bySource.map((s) => (
          <SourceRow key={s.source} s={s} />
        ))}
        {bySource.length === 0 && <p className="p-5 text-[13px] text-gray-500">No sources yet.</p>}
      </Card>

      <SectionHeading note={articles.length < a.total ? `latest ${articles.length} of ${a.total}` : undefined}>
        Recent articles
      </SectionHeading>
      {articles.length === 0 ? (
        <Card className="grid place-items-center p-12 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-green-50 text-green-700">
            <FlowArrow size={24} />
          </span>
          <h3 className="mt-4 text-[15px] font-semibold text-ink">No articles ingested yet</h3>
          <p className="mt-1 max-w-md text-[13px] leading-relaxed text-gray-600">
            Hit <span className="font-semibold">Trigger</span> on the ESG feed ingest worker above, or run{" "}
            <code className="rounded bg-gray-100 px-1.5 py-0.5 text-[12px]">pnpm --filter @gm/platform feed:ingest</code>{" "}
            locally to pull the latest news.
          </p>
        </Card>
      ) : (
        <Card className="divide-y divide-gray-100">
          {articles.map((art) => (
            <article key={art.id} className="space-y-2 p-5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-gray-500">
                <span className="font-semibold text-gray-700">{art.source}</span>
                <span>·</span>
                <span>published {fmtDate(art.published_at)}</span>
                <span>·</span>
                <span>ingested {ago(art.created_at)}</span>
              </div>
              <a
                href={art.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-start gap-1.5"
              >
                <h3 className="text-[15px] font-semibold leading-snug text-ink group-hover:text-teal-700">
                  {art.title}
                </h3>
                <ArrowSquareOut size={14} className="mt-1 shrink-0 text-gray-400 group-hover:text-teal-700" />
              </a>
              {art.summary && <p className="text-[13px] leading-relaxed text-gray-700">{art.summary}</p>}
              {entitiesOf(art).length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {entitiesOf(art).map((e) => (
                    <Chip key={e.slug} tone={KIND_TONE[e.kind] ?? "neutral"}>
                      {e.name}
                    </Chip>
                  ))}
                </div>
              )}
            </article>
          ))}
        </Card>
      )}
    </div>
  );
}
