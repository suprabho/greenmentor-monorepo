"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowSquareOut,
  CaretDown,
  CloudArrowUp,
  CloudSlash,
  Spinner,
} from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { getPublicationForCard, type ShareCardPublicationRow } from "@/lib/db/shareCards";
import { publicFeedUrl } from "@/lib/share-link";

const controlBtn =
  "flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40";
const menuItem =
  "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs text-neutral-200 hover:bg-white/5";

/**
 * Publish the loaded card into the learner platform's News feed — renders
 * as an inline dark-toolbar control next to the Download menu.
 *
 * Publishing renders the SAVED config (the publish API reads the card row, not
 * the live composer state), so the control is disabled until the card is saved
 * and hints to hit Update first when there are newer edits. Published state is
 * read from the share_cards_public view — the same view the platform renders —
 * so what this shows is exactly what learners see.
 */
export function PublishControls({ cardId }: { cardId: string | null }) {
  const [pub, setPub] = useState<ShareCardPublicationRow | null>(null);
  const [busy, setBusy] = useState<"publish" | "unpublish" | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // Published state for the loaded card. The view predating the migration (or
  // any read hiccup) just reads as "not published" — the publish POST surfaces
  // the actionable error.
  useEffect(() => {
    setPub(null);
    setMsg(null);
    if (!cardId) return;
    let alive = true;
    void getPublicationForCard(createClient(), cardId)
      .then((row) => {
        if (alive) setPub(row);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [cardId]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function publish() {
    if (!cardId || busy) return;
    setBusy("publish");
    setMsg(null);
    try {
      const res = await fetch(`/api/share-cards/${cardId}/publish`, { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as {
        publication?: ShareCardPublicationRow;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Publish failed");
      setPub(json.publication ?? null);
      setMsg({ kind: "ok", text: "Published to the platform library ✓" });
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function unpublish() {
    if (!cardId || busy) return;
    setBusy("unpublish");
    setMsg(null);
    try {
      const res = await fetch(`/api/share-cards/${cardId}/publish`, { method: "DELETE" });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Unpublish failed");
      setPub(null);
      setMsg({ kind: "ok", text: "Unpublished ✓" });
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  const spinner = <Spinner size={14} className="animate-spin" />;

  return (
    <div ref={ref} className="relative">
      {pub === null ? (
        <button
          type="button"
          onClick={() => void publish()}
          disabled={!cardId || busy !== null}
          title={
            cardId
              ? "Publish the saved version of this card into the platform's News feed"
              : "Save the card first — publishing renders the saved version"
          }
          className={`${controlBtn} border border-green-500/40 font-semibold text-green-500 hover:bg-green-500/10`}
        >
          {busy === "publish" ? spinner : <CloudArrowUp size={14} weight="bold" />}
          {busy === "publish" ? "Publishing…" : "Publish"}
        </button>
      ) : (
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          disabled={busy !== null}
          onClick={() => setOpen((o) => !o)}
          className={`${controlBtn} border border-green-500/40 font-semibold text-green-500 hover:bg-green-500/10`}
        >
          {busy ? spinner : <CloudArrowUp size={14} weight="bold" />}
          {busy === "publish" ? "Publishing…" : busy === "unpublish" ? "Unpublishing…" : "Published"}
          <CaretDown
            size={11}
            weight="bold"
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      )}
      {open && pub !== null && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-white/10 bg-neutral-900 p-1 shadow-lift"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void publish();
            }}
            className={menuItem}
            title="Re-render the saved config and replace the published image"
          >
            <CloudArrowUp size={13} /> Republish
          </button>
          <a
            role="menuitem"
            href={publicFeedUrl()}
            target="_blank"
            rel="noreferrer"
            onClick={() => setOpen(false)}
            className={menuItem}
          >
            <ArrowSquareOut size={13} /> View on platform
          </a>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void unpublish();
            }}
            className={`${menuItem} text-red-400 hover:text-red-300`}
          >
            <CloudSlash size={13} /> Unpublish
          </button>
        </div>
      )}
      {/* Floats below the toolbar so the right cluster doesn't shift (same
          pattern as the Save bar's status message). */}
      {msg && (
        <span
          className={`pointer-events-none absolute right-0 top-full z-20 mt-2 max-w-[60vw] truncate rounded-md bg-neutral-900/95 px-2.5 py-1 text-[11px] ${
            msg.kind === "ok" ? "text-green-500" : "text-red-400"
          }`}
          title={msg.text}
        >
          {msg.text}
        </span>
      )}
    </div>
  );
}
