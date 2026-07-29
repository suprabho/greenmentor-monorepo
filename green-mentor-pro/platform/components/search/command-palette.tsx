"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  ArrowSquareOut,
  Briefcase,
  GraduationCap,
  MagnifyingGlass,
  Newspaper,
  PlayCircle,
  SignIn,
  VideoCamera,
  type Icon,
} from "@phosphor-icons/react";
import { Highlight } from "@/components/ui";
import { NAV_DESTINATIONS } from "@/lib/app-nav";
import { MIN_QUERY_LENGTH, type SearchHit, type SearchKind, type SearchResults } from "@/lib/search/rank";

const DEBOUNCE_MS = 200;

const KIND_META: Record<SearchKind, { label: string; icon: Icon }> = {
  course: { label: "Courses", icon: GraduationCap },
  lesson: { label: "Lessons", icon: PlayCircle },
  job: { label: "Jobs", icon: Briefcase },
  webinar: { label: "Webinars", icon: VideoCamera },
  article: { label: "News", icon: Newspaper },
};

// Display order of result groups — mirrors the sidebar's Learn → Work → Grow
// ordering rather than the score order, so the palette's shape stays stable
// between queries.
const KIND_ORDER: SearchKind[] = ["course", "lesson", "job", "webinar", "article"];

function Row({
  icon: RowIcon,
  title,
  subtitle,
  q,
  external,
}: {
  icon: Icon;
  title: string;
  subtitle?: string | null;
  q: string;
  external?: boolean;
}) {
  return (
    <>
      <RowIcon size={17} className="shrink-0 text-gray-400" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] text-ink">
          <Highlight text={title} q={q} />
        </span>
        {subtitle && (
          <span className="block truncate text-[12px] text-gray-500">
            <Highlight text={subtitle} q={q} />
          </span>
        )}
      </span>
      {external && <ArrowSquareOut size={13} className="shrink-0 text-gray-400" />}
    </>
  );
}

const ITEM_CLASS =
  "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 data-[selected=true]:bg-green-50";

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = query.trim();
  const isSearching = trimmed.length >= MIN_QUERY_LENGTH;

  // Nav destinations are a short static list, so they filter locally — no
  // round trip to offer "go to Jobs".
  const navMatches = useMemo(() => {
    if (!trimmed) return NAV_DESTINATIONS;
    const needle = trimmed.toLowerCase();
    return NAV_DESTINATIONS.filter(
      (d) => d.label.toLowerCase().includes(needle) || d.parent?.toLowerCase().includes(needle)
    );
  }, [trimmed]);

  // Reset when the palette closes so the next ⌘K opens clean rather than on
  // the previous query's stale results.
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults(null);
      setError(null);
      setLoading(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !isSearching) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    // One AbortController per in-flight request, aborted by this effect's
    // cleanup on the next keystroke. Without it a slow early response can land
    // after a fast later one and leave the list showing results for a query
    // the user has already moved on from.
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error ?? `Search failed (${res.status})`);
        setResults(body as SearchResults);
      } catch (e) {
        if ((e as Error).name === "AbortError") return; // superseded, not a failure
        setError(e instanceof Error ? e.message : "Search failed");
        setResults(null);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, isSearching, trimmed]);

  const go = (href: string, external?: boolean) => {
    onOpenChange(false);
    if (external) window.open(href, "_blank", "noopener,noreferrer");
    else router.push(href);
  };

  const grouped = useMemo(() => {
    const by = new Map<SearchKind, SearchHit[]>();
    for (const hit of results?.hits ?? []) {
      const list = by.get(hit.kind);
      if (list) list.push(hit);
      else by.set(hit.kind, [hit]);
    }
    return KIND_ORDER.map((kind) => ({ kind, hits: by.get(kind) ?? [] })).filter(
      (g) => g.hits.length > 0
    );
  }, [results]);

  const hasResults = grouped.length > 0;
  const showEmpty = isSearching && !loading && !error && !hasResults;

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Search Green Mentor Pro"
      shouldFilter={false} // results arrive pre-ranked from the server; cmdk's
      // own filter would re-filter them and drop hits whose match lives in a
      // field we don't render (a job's details, an article's summary).
      overlayClassName="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px]"
      contentClassName="fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
    >
      <div className="flex items-center gap-2.5 border-b border-gray-200 px-4">
        <MagnifyingGlass size={17} className="shrink-0 text-gray-400" />
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder="Search courses, jobs, webinars…"
          className="w-full bg-transparent py-3.5 text-[14px] text-ink outline-none placeholder:text-gray-400"
        />
        {loading && (
          <span className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-gray-200 border-t-green-500" />
        )}
      </div>

      <Command.List className="max-h-[min(60vh,26rem)] overflow-y-auto overscroll-contain p-2">
        {navMatches.length > 0 && (
          <Command.Group
            heading="Go to"
            className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-1.5 [&_[cmdk-group-heading]]:text-[10.5px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.14em] [&_[cmdk-group-heading]]:text-gray-400"
          >
            {navMatches.map((d) => (
              <Command.Item
                key={d.href}
                value={`nav-${d.href}`}
                onSelect={() => go(d.href)}
                className={ITEM_CLASS}
              >
                <Row
                  icon={d.icon}
                  title={d.label}
                  subtitle={d.parent ? `in ${d.parent}` : null}
                  q={trimmed}
                />
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {grouped.map(({ kind, hits }) => (
          <Command.Group
            key={kind}
            heading={KIND_META[kind].label}
            className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[10.5px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.14em] [&_[cmdk-group-heading]]:text-gray-400"
          >
            {hits.map((hit) => (
              <Command.Item
                key={`${hit.kind}-${hit.id}`}
                value={`${hit.kind}-${hit.id}`}
                onSelect={() => go(hit.href, hit.external)}
                className={ITEM_CLASS}
              >
                <Row
                  icon={KIND_META[hit.kind].icon}
                  title={hit.title}
                  subtitle={hit.subtitle}
                  q={trimmed}
                  external={hit.external}
                />
              </Command.Item>
            ))}
          </Command.Group>
        ))}

        {/* Skeletons rather than swapping the list for a spinner — keeps the
            panel height steady while typing instead of jumping per keystroke. */}
        {loading && !hasResults && (
          <div className="space-y-1.5 px-2.5 py-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-2.5">
                <span className="size-4 shrink-0 animate-pulse rounded bg-gray-100" />
                <span
                  className="h-3.5 animate-pulse rounded bg-gray-100"
                  style={{ width: `${70 - i * 15}%` }}
                />
              </div>
            ))}
          </div>
        )}

        {error && (
          <p className="px-2.5 py-6 text-center text-[13px] text-danger">
            {error}
          </p>
        )}

        {showEmpty && (
          <p className="px-2.5 py-6 text-center text-[13px] text-gray-500">
            No matches for “{trimmed}”.
          </p>
        )}

      </Command.List>

      {/* Signed out, courses and lessons are invisible to Postgres itself — say
          so rather than letting the gap read as "nothing exists". Pinned
          outside the scroll area: buried under a long result list it would
          never be seen by the people it is for. */}
      {isSearching && !loading && results?.limitedBySignIn && (
        <button
          type="button"
          onClick={() => go("/login")}
          className="flex w-full items-center gap-2 border-t border-gray-200 px-4 py-2.5 text-left text-[12.5px] text-gray-600 transition-colors hover:bg-green-50 hover:text-ink"
        >
          <SignIn size={15} className="shrink-0 text-gray-400" />
          Sign in to search courses and lessons
        </button>
      )}

      <div className="flex items-center gap-3 border-t border-gray-200 bg-gray-50 px-4 py-2 text-[11px] text-gray-500">
        <span>
          <kbd className="font-sans font-semibold">↑↓</kbd> navigate
        </span>
        <span>
          <kbd className="font-sans font-semibold">↵</kbd> open
        </span>
        <span>
          <kbd className="font-sans font-semibold">esc</kbd> close
        </span>
      </div>
    </Command.Dialog>
  );
}
