import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, Chip, PageHeader } from "@/components/ui";

export const metadata = { title: "Feed — Green Mentor Pro" };

type EntityRef = { slug: string; name: string; kind: string };
type ArticleRow = {
  id: string;
  source: string;
  title: string;
  url: string;
  summary: string | null;
  published_at: string | null;
  article_entities: { entities: EntityRef | null }[] | null;
};

const KIND_TONE: Record<string, "green" | "teal" | "neutral" | "warn"> = {
  framework: "teal",
  topic: "green",
  region: "warn",
  company: "neutral",
};

function ago(iso: string | null): string {
  if (!iso) return "";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string }>;
}) {
  const { entity: activeSlug } = await searchParams;
  const supabase = await createClient();

  const [{ data: entities }, { data: articles }] = await Promise.all([
    supabase.from("entities").select("slug, name, kind").order("kind"),
    supabase
      .from("articles")
      .select("id, source, title, url, summary, published_at, article_entities(entities(slug, name, kind))")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(50),
  ]);

  const rows = (articles ?? []) as unknown as ArticleRow[];
  const filtered = activeSlug
    ? rows.filter((a) => (a.article_entities ?? []).some((ae) => ae.entities?.slug === activeSlug))
    : rows;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="Open Global ESG Feed" sub="AI-summarized regulatory & sustainability news · anonymous read" />

      {/* follow-graph filter chips */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/feed"
          className={
            "rounded-pill border px-3 py-1.5 text-[12.5px] font-semibold " +
            (!activeSlug ? "border-teal-900 bg-teal-900 text-white" : "border-gray-200 bg-white text-gray-700 hover:border-gray-300")
          }
        >
          All
        </Link>
        {(entities ?? []).map((e) => (
          <Link
            key={e.slug}
            href={`/feed?entity=${e.slug}`}
            className={
              "rounded-pill border px-3 py-1.5 text-[12.5px] font-semibold " +
              (activeSlug === e.slug ? "border-teal-900 bg-teal-900 text-white" : "border-gray-200 bg-white text-gray-700 hover:border-gray-300")
            }
          >
            {e.name}
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card className="p-6 text-center text-[13.5px] text-gray-600">
          No articles yet. Run the ingestion worker (<code className="rounded bg-gray-100 px-1.5 py-0.5 text-[12px]">scripts/ingest-feed.ts</code>)
          or apply the 0003_feed.sql seed.
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => (
            <Card key={a.id} className="space-y-2.5 p-5">
              <div className="flex items-center gap-2 text-[12px] text-gray-500">
                <span className="font-semibold text-gray-700">{a.source}</span>
                <span>·</span>
                <span>{ago(a.published_at)}</span>
              </div>
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="block">
                <h2 className="text-[16px] font-semibold leading-snug text-ink hover:text-teal-700">{a.title}</h2>
              </a>
              {a.summary && <p className="text-[13.5px] leading-relaxed text-gray-700">{a.summary}</p>}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {(a.article_entities ?? [])
                  .map((ae) => ae.entities)
                  .filter((e): e is EntityRef => !!e)
                  .map((e) => (
                    <Link key={e.slug} href={`/feed?entity=${e.slug}`}>
                      <Chip tone={KIND_TONE[e.kind] ?? "neutral"}>{e.name}</Chip>
                    </Link>
                  ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
