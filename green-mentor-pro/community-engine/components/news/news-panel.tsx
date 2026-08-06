"use client";

/**
 * News image editor. The RSS worker fills image_url for most articles — from
 * the feed item, or failing that the article page's og:image — but regulators
 * and a lot of wire copy publish no picture at all, and those cards fall back
 * to a plain gradient on the platform. This is where an editor fixes them.
 *
 * Image-only by design: everything else about an article (title, summary, tags)
 * is owned by the worker and would be overwritten on the next run.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowSquareOut, Check, ImageBroken, Spinner } from "@phosphor-icons/react/dist/ssr";
import { Card, Chip } from "@/components/ui";
import { PhotoField, fieldInputCls } from "@/components/photo-field";
import type { NewsRow } from "@/lib/db/news";

type Status = { type: "idle" | "ok" | "err" | "info"; msg?: string };

function when(iso: string | null): string {
  if (!iso) return "undated";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

/** Row thumbnail — mirrors what the platform card will show for this article. */
function Preview({ src, source }: { src: string | null; source: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- arbitrary publisher hosts
    return <img src={src} alt="" className="h-14 w-24 shrink-0 rounded-lg bg-gray-100 object-cover" />;
  }
  return (
    <span
      title="No image — the platform shows a gradient with the publisher name"
      className="grid h-14 w-24 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-teal-900 via-teal-800 to-green-700 text-green-100/70"
    >
      <ImageBroken size={18} />
    </span>
  );
}

export function NewsPanel({
  initialArticles,
  configured,
}: {
  initialArticles: NewsRow[];
  configured: boolean;
}) {
  const router = useRouter();
  const [articles, setArticles] = useState<NewsRow[]>(initialArticles);
  const [query, setQuery] = useState("");
  const [missingOnly, setMissingOnly] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ type: "idle" });

  const missingCount = articles.filter((a) => !a.image_url).length;

  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () =>
      articles.filter(
        (a) =>
          (!missingOnly || !a.image_url) &&
          (!q || a.title.toLowerCase().includes(q) || a.source.toLowerCase().includes(q)),
      ),
    [articles, missingOnly, q],
  );

  const draftFor = (a: NewsRow) => drafts[a.id] ?? a.image_url ?? "";

  const save = async (a: NewsRow) => {
    const next = draftFor(a).trim() || null;
    setBusyId(a.id);
    setStatus({ type: "idle" });
    try {
      const res = await fetch(`/api/news/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: next }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({ type: "err", msg: body.error ?? `HTTP ${res.status}` });
        return;
      }
      if (body.mode === "unconfigured") {
        setStatus({ type: "info", msg: "Saving needs SUPABASE_SERVICE_ROLE_KEY set server-side." });
        return;
      }
      setArticles((prev) => prev.map((x) => (x.id === a.id ? { ...x, image_url: next } : x)));
      setDrafts(({ [a.id]: _dropped, ...rest }) => rest);
      setStatus({ type: "ok", msg: next ? `Image set for "${a.title.slice(0, 48)}…"` : "Image cleared." });
      router.refresh();
    } catch (e) {
      setStatus({ type: "err", msg: e instanceof Error ? e.message : "Could not save" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      {!configured ? (
        <p className="mb-4 rounded-lg bg-[#FFF4E0] px-3 py-2 text-[12px] text-[#B25E00]">
          News needs SUPABASE_SERVICE_ROLE_KEY set server-side — shown empty until then.
        </p>
      ) : null}

      {status.type !== "idle" ? (
        <div
          className={`mb-4 rounded-lg px-3 py-2 text-[12px] ${
            status.type === "err"
              ? "bg-red-50 text-danger"
              : status.type === "info"
                ? "bg-[#FFF4E0] text-[#B25E00]"
                : "bg-green-50 text-green-700"
          }`}
        >
          {status.msg}
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by headline or source…"
          className={`${fieldInputCls} min-w-[16rem] flex-1`}
        />
        <label className="flex items-center gap-2 text-[12.5px] text-gray-700">
          <input type="checkbox" checked={missingOnly} onChange={(e) => setMissingOnly(e.target.checked)} />
          Missing an image only
        </label>
        <span className="text-[12px] text-gray-500">
          {missingCount} of {articles.length} recent articles have no image
        </span>
      </div>

      {shown.length === 0 ? (
        <Card className="p-6 text-center text-[13px] text-gray-600">
          {missingOnly && !q
            ? "Every recent article has an image. Nothing to fix."
            : "No articles match that search."}
        </Card>
      ) : (
        <ul className="space-y-3">
          {shown.map((a) => {
            const draft = draftFor(a);
            const dirty = (draft.trim() || null) !== (a.image_url ?? null);
            return (
              <li key={a.id}>
                <Card className="flex flex-col gap-3 p-4 lg:flex-row lg:items-start">
                  <Preview src={draft.trim() || null} source={a.source} />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-gray-500">
                      <Chip tone={a.region === "india" ? "green" : "neutral"}>{a.source}</Chip>
                      <span>{when(a.published_at)}</span>
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-green-700 hover:underline"
                      >
                        Open original <ArrowSquareOut size={11} />
                      </a>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[13.5px] font-semibold leading-snug text-ink">{a.title}</p>

                    <div className="mt-2 flex flex-wrap items-end gap-2">
                      <PhotoField
                        folder="news"
                        label="Image URL"
                        placeholder="Upload, or paste https://…"
                        value={draft}
                        onChange={(v) => setDrafts((d) => ({ ...d, [a.id]: v }))}
                        className="min-w-[18rem] flex-1"
                      />
                      <button
                        type="button"
                        disabled={!dirty || busyId === a.id}
                        onClick={() => void save(a)}
                        className="flex h-[34px] shrink-0 items-center gap-1.5 rounded-lg bg-teal-900 px-3.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-teal-800 disabled:opacity-40"
                      >
                        {busyId === a.id ? <Spinner size={13} className="animate-spin" /> : <Check size={13} />}
                        Save
                      </button>
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
