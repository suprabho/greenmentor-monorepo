import { FlowArrow, ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";
import { Card, Chip, PageHeader, Stat } from "@/components/ui";
import { AdminTabs, type AdminTab } from "@/components/admin-tabs";
import { requireAdmin } from "@/lib/auth/admin";
import { ADMIN_SECTIONS } from "@/lib/admin/sections";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Pipeline — GreenMentor Community" };

/** Tab strip derived from the section registry — soon sections show muted. */
const tabs: AdminTab[] = ADMIN_SECTIONS.map((s) => ({
  href: s.href,
  label: s.name,
  exact: s.href === "/pipeline",
  soon: s.status === "soon",
}));

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

const entitiesOf = (a: ArticleRow): EntityRef[] =>
  (a.article_entities ?? []).map((ae) => ae.entities).filter((e): e is EntityRef => !!e);

export default async function PipelinePage() {
  await requireAdmin();
  const supabase = await createClient();

  const [articlesRes, articleCountRes, entityCountRes] = await Promise.all([
    supabase
      .from("articles")
      .select("id, source, title, url, summary, published_at, created_at, article_entities(entities(slug, name, kind))")
      .order("created_at", { ascending: false })
      .limit(60),
    supabase.from("articles").select("id", { count: "exact", head: true }),
    supabase.from("entities").select("id", { count: "exact", head: true }),
  ]);

  const articles = (articlesRes.data ?? []) as unknown as ArticleRow[];
  const totalArticles = articleCountRes.count ?? articles.length;
  const totalEntities = entityCountRes.count ?? 0;
  const sources = [...new Set(articles.map((a) => a.source))];
  const lastIngested = articles[0]?.created_at ?? null;

  return (
    <div>
      <PageHeader
        title="Pipeline"
        sub="Content ingested into the Open Global ESG Feed — AI-summarized regulatory & sustainability news."
        action={
          <span className="hidden text-[12.5px] text-gray-500 sm:block">
            Last ingested <span className="font-semibold text-gray-700">{ago(lastIngested)}</span>
          </span>
        }
      />
      <div className="mb-6">
        <AdminTabs tabs={tabs} />
      </div>

      {/* run summary */}
      <Card className="mb-6 grid grid-cols-2 gap-y-5 p-5 sm:grid-cols-4">
        <Stat label="Articles" value={String(totalArticles)} sub="in the feed" />
        <Stat label="Entities" value={String(totalEntities)} sub="frameworks · topics · regions" />
        <Stat label="Sources" value={String(sources.length)} sub={sources.slice(0, 3).join(" · ") || "—"} />
        <Stat label="Last ingest" value={ago(lastIngested)} sub={fmtDate(lastIngested)} />
      </Card>

      <p className="mb-4 text-[12.5px] leading-relaxed text-gray-500">
        Ingested automatically each day by the feed worker
        (<code className="rounded bg-gray-100 px-1.5 py-0.5 text-[12px]">.github/workflows/feed-ingest.yml</code>).
        Run on demand with <code className="rounded bg-gray-100 px-1.5 py-0.5 text-[12px]">pnpm --filter @gm/platform feed:ingest</code>.
      </p>

      {articles.length === 0 ? (
        <Card className="grid place-items-center p-12 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-green-50 text-green-700">
            <FlowArrow size={24} />
          </span>
          <h3 className="mt-4 text-[15px] font-semibold text-ink">No articles ingested yet</h3>
          <p className="mt-1 max-w-md text-[13px] leading-relaxed text-gray-600">
            Trigger the “ESG feed — daily ingest” workflow from the Actions tab, or run{" "}
            <code className="rounded bg-gray-100 px-1.5 py-0.5 text-[12px]">pnpm --filter @gm/platform feed:ingest</code>{" "}
            locally to pull the latest news.
          </p>
        </Card>
      ) : (
        <Card className="divide-y divide-gray-100">
          {articles.map((a) => (
            <article key={a.id} className="space-y-2 p-5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-gray-500">
                <span className="font-semibold text-gray-700">{a.source}</span>
                <span>·</span>
                <span>published {fmtDate(a.published_at)}</span>
                <span>·</span>
                <span>ingested {ago(a.created_at)}</span>
              </div>
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-start gap-1.5"
              >
                <h3 className="text-[15px] font-semibold leading-snug text-ink group-hover:text-teal-700">
                  {a.title}
                </h3>
                <ArrowSquareOut size={14} className="mt-1 shrink-0 text-gray-400 group-hover:text-teal-700" />
              </a>
              {a.summary && <p className="text-[13px] leading-relaxed text-gray-700">{a.summary}</p>}
              {entitiesOf(a).length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {entitiesOf(a).map((e) => (
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
