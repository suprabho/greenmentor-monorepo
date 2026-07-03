"use client";

/**
 * Entities browser + curation for the Pipeline tab. Expands the flat kind
 * counts into the individual entities (tag chips with per-entity tagged-article
 * counts), filterable by kind tab and text, with an inline "Add entity" form
 * that POSTs to /api/pipeline/entities and refreshes the server page. Inline
 * feedback, no toasts — same conventions as WorkersPanel.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { Card, Chip } from "@/components/ui";
import type { PipelineEntity } from "@/lib/pipeline/stats";

const KIND_TONE: Record<string, "green" | "teal" | "neutral" | "warn"> = {
  framework: "teal",
  topic: "green",
  region: "warn",
  company: "neutral",
};

const KIND_TABS = [
  { key: "all", label: "All" },
  { key: "framework", label: "Frameworks" },
  { key: "topic", label: "Topics" },
  { key: "region", label: "Regions" },
  { key: "company", label: "Companies" },
] as const;

type KindKey = (typeof KIND_TABS)[number]["key"];
type Status = { type: "idle" | "ok" | "err" | "info"; msg?: string };

/** Mirror of the API's slugify so the form can preview the derived slug. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const inputCls =
  "rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[13px] text-ink placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500";

export function EntitiesPanel({ entities }: { entities: PipelineEntity[] }) {
  const router = useRouter();
  const [kind, setKind] = useState<KindKey>("all");
  const [filter, setFilter] = useState("");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [newKind, setNewKind] = useState<Exclude<KindKey, "all">>("topic");
  const [slugEdit, setSlugEdit] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status>({ type: "idle" });

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: entities.length };
    for (const e of entities) c[e.kind] = (c[e.kind] ?? 0) + 1;
    return c;
  }, [entities]);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return entities.filter(
      (e) =>
        (kind === "all" || e.kind === kind) &&
        (!q || e.name.toLowerCase().includes(q) || e.slug.includes(q))
    );
  }, [entities, kind, filter]);

  const slug = slugEdit ?? slugify(name);

  const openForm = () => {
    setAdding(true);
    setStatus({ type: "idle" });
    if (kind !== "all") setNewKind(kind);
  };

  const closeForm = () => {
    setAdding(false);
    setName("");
    setSlugEdit(null);
  };

  const save = async () => {
    setSaving(true);
    setStatus({ type: "idle" });
    try {
      const res = await fetch("/api/pipeline/entities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), kind: newKind, slug }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      if (body.mode === "unconfigured") {
        setStatus({
          type: "info",
          msg: "Adding entities needs SUPABASE_SERVICE_ROLE_KEY (the feed worker's write key) set server-side.",
        });
        return;
      }
      setStatus({ type: "ok", msg: `Added ${body.entity.name} (${body.entity.kind}) — the ingest worker can tag against it from the next run.` });
      closeForm();
      router.refresh();
    } catch (err) {
      setStatus({ type: "err", msg: err instanceof Error ? err.message : "Could not add entity" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">Entities</h2>
        <button
          type="button"
          onClick={adding ? closeForm : openForm}
          className="inline-flex items-center gap-1 rounded-pill bg-teal-900 px-3 py-1 text-[12px] font-medium text-white transition-colors hover:bg-teal-800"
        >
          {adding ? "Cancel" : (
            <>
              <Plus size={12} weight="bold" /> Add entity
            </>
          )}
        </button>
      </div>

      {status.type !== "idle" ? (
        <div
          className={`mb-2 rounded-lg px-3 py-2 text-[12px] ${
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

      <Card>
        {adding ? (
          <form
            className="flex flex-wrap items-end gap-3 border-b border-gray-100 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim() && slug) void save();
            }}
          >
            <label className="flex min-w-40 flex-1 flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
              Name
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. SBTi"
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
              Kind
              <select
                value={newKind}
                onChange={(e) => setNewKind(e.target.value as Exclude<KindKey, "all">)}
                className={inputCls}
              >
                <option value="framework">Framework</option>
                <option value="topic">Topic</option>
                <option value="region">Region</option>
                <option value="company">Company</option>
              </select>
            </label>
            <label className="flex min-w-48 flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
              Slug
              <input
                value={slug}
                onChange={(e) => setSlugEdit(e.target.value)}
                placeholder="auto from name"
                className={`${inputCls} font-mono text-[12px]`}
              />
            </label>
            <button
              type="submit"
              disabled={saving || !name.trim() || !slug}
              className="rounded-pill bg-teal-900 px-4 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-teal-800 disabled:opacity-40"
            >
              {saving ? "Adding…" : "Add"}
            </button>
          </form>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 p-5 pb-4">
          <div className="no-scrollbar flex gap-1 overflow-x-auto">
            {KIND_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setKind(t.key)}
                className={`shrink-0 rounded-pill px-3 py-1 text-[12px] font-medium transition-colors ${
                  kind === t.key ? "bg-teal-900 text-white" : "text-gray-600 hover:bg-gray-100 hover:text-ink"
                }`}
              >
                {t.label} <span className={kind === t.key ? "opacity-70" : "text-gray-400"}>{counts[t.key] ?? 0}</span>
              </button>
            ))}
          </div>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter…"
            className={`${inputCls} w-36 py-1`}
          />
        </div>

        <div className="flex flex-wrap gap-1.5 p-5">
          {visible.map((e) => (
            <Chip key={e.id} tone={KIND_TONE[e.kind] ?? "neutral"} className="gap-1.5" >
              {e.name}
              <span className="font-normal opacity-60" title={`${e.article_count} tagged article${e.article_count === 1 ? "" : "s"}`}>
                {e.article_count}
              </span>
            </Chip>
          ))}
          {visible.length === 0 ? (
            <p className="text-[13px] text-gray-500">
              {entities.length === 0 ? "No entities yet — trigger the ingest worker above." : "Nothing matches."}
            </p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
