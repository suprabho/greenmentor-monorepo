"use client";

import { useMemo, useRef, useState } from "react";
import { registerPickerEditor, type PickerEditorProps } from "@vismay/viz-admin";
import type { ShareCardArticle, ShareCardData } from "./types";
import { cardDate, proxiedImage } from "./modules/shared";

/**
 * Domain pickers for the `gmcard:*` adminForm fields, registered into
 * viz-admin's picker registry by id (the engine owns only the field shape).
 * Each reads the live news-pipe data from the composer `ctx` the shell threads
 * through — mirrors footshorts' registerFootshortsPickers.
 */

export interface GmPickerCtx {
  data: ShareCardData;
}

function articlesFrom(ctx: unknown): ShareCardArticle[] {
  const d = (ctx as GmPickerCtx | undefined)?.data;
  return d?.articles ?? [];
}

const inputCls =
  "w-full rounded-md border border-white/10 bg-neutral-900 px-2.5 py-1.5 text-xs text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-white/30";

// ── gm:article — searchable news-pipe article list ───────────────────────────

function ArticlePicker({ value, onChange, ctx }: PickerEditorProps) {
  const articles = articlesFrom(ctx);
  const [query, setQuery] = useState("");
  const selected = typeof value === "string" ? value : "";

  const shown = useMemo(() => {
    // Token AND-match, not whole-phrase substring: "analysis uk newspapers"
    // should find "Analysis: What UK newspapers say about…".
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return articles;
    return articles.filter((a) => {
      const hay = `${a.title} ${a.source} ${a.entities.map((e) => e.name).join(" ")}`.toLowerCase();
      return tokens.every((t) => hay.includes(t));
    });
  }, [articles, query]);

  if (articles.length === 0) {
    return <p className="text-[11px] text-neutral-500">No articles in the pipeline yet.</p>;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <input
        type="text"
        value={query}
        placeholder="Search title / source / tag…"
        onChange={(e) => setQuery(e.target.value)}
        className={inputCls}
      />
      <div className="max-h-56 overflow-y-auto rounded-md border border-white/10">
        {shown.length === 0 && (
          <p className="px-2.5 py-2 text-[11px] text-neutral-500">
            No matches in the latest {articles.length} articles.
          </p>
        )}
        {shown.map((a) => {
          const active = a.id === selected;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => onChange(a.id)}
              className={`flex w-full items-start gap-2 border-b border-white/5 px-2.5 py-2 text-left last:border-b-0 ${
                active ? "bg-sky-500/15" : "hover:bg-white/5"
              }`}
            >
              {a.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={proxiedImage(a.image_url)}
                  alt=""
                  className="mt-0.5 h-9 w-9 shrink-0 rounded object-cover"
                />
              ) : (
                <span className="mt-0.5 h-9 w-9 shrink-0 rounded bg-white/5" />
              )}
              <span className="min-w-0">
                <span className="block truncate text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                  {a.source}
                  {a.published_at ? ` · ${cardDate(a.published_at)}` : ""}
                </span>
                <span
                  className={`block text-[11.5px] leading-snug ${active ? "text-sky-200" : "text-neutral-200"}`}
                >
                  {a.title}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── gm:image — article photo / URL / upload ──────────────────────────────────

/** Uploads are embedded in the snapshot as data URLs — cap them so a saved
 *  config row stays a sane size. */
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export function ImagePicker({ value, onChange, ctx }: PickerEditorProps) {
  const articles = articlesFrom(ctx).filter((a) => !!a.image_url);
  const [tab, setTab] = useState<"article" | "url" | "upload">("article");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const current = typeof value === "string" ? value : "";

  const pickFile = (file: File | undefined) => {
    setUploadError(null);
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError("Max 4 MB — resize the image first.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result ?? ""));
    reader.onerror = () => setUploadError("Could not read that file.");
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-1">
        {(
          [
            { id: "article", label: "Articles" },
            { id: "url", label: "URL" },
            { id: "upload", label: "Upload" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-md px-2 py-1 text-[11px] ${
              tab === t.id ? "bg-white/10 text-neutral-100" : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "article" &&
        (articles.length === 0 ? (
          <p className="text-[11px] text-neutral-500">No article images available.</p>
        ) : (
          <div className="grid max-h-48 grid-cols-3 gap-1.5 overflow-y-auto">
            {articles.map((a) => (
              <button
                key={a.id}
                type="button"
                title={a.title}
                onClick={() => onChange(a.image_url!)}
                className={`relative aspect-square overflow-hidden rounded ${
                  current === a.image_url ? "ring-2 ring-sky-400" : "hover:opacity-80"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={proxiedImage(a.image_url!)}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        ))}

      {tab === "url" && (
        <input
          type="text"
          value={current.startsWith("data:") ? "" : current}
          placeholder="https://…"
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
        />
      )}

      {tab === "upload" && (
        <div className="flex flex-col gap-1">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={(e) => pickFile(e.target.files?.[0])}
            className="text-[11px] text-neutral-400 file:mr-2 file:rounded-md file:border-0 file:bg-white/10 file:px-2 file:py-1 file:text-[11px] file:text-neutral-200"
          />
          {current.startsWith("data:") && (
            <p className="text-[11px] text-neutral-500">Uploaded image in use.</p>
          )}
          {uploadError && <p className="text-[11px] text-red-400">{uploadError}</p>}
        </div>
      )}
    </div>
  );
}

// ── registration ─────────────────────────────────────────────────────────────

/** Idempotent (the registry is a Map.set) — safe to call on every studio mount. */
export function registerGmPickers(): void {
  registerPickerEditor("gm:article", ArticlePicker);
  registerPickerEditor("gm:image", ImagePicker);
}
