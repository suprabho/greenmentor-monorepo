"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FloppyDisk, UsersThree, ArrowClockwise, Spinner } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { insertShareCard, updateShareCard } from "@/lib/db/shareCards";
import type { Visibility } from "@/lib/db/headers";
import type { ShareCardSnapshotV1 } from "@/lib/share-cards/types";

const controlBtn =
  "flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40";

/**
 * Save the current card config to Supabase — personal or shared team library.
 * When the studio was opened from a saved card the user owns, also offers an
 * in-place Update. Renders as inline dark-toolbar controls — the studio places
 * them in the centered (Figma-style) cluster of its toolbar.
 */
export function SaveControls({
  snapshot,
  defaultTitle,
  loadedId,
  loadedOwned,
  onSaved,
}: {
  snapshot: ShareCardSnapshotV1;
  defaultTitle: string;
  loadedId: string | null;
  loadedOwned: boolean;
  onSaved: (id: string) => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const effectiveTitle = () => title.trim() || defaultTitle.trim() || "Untitled card";

  async function withBusy(fn: () => Promise<string>) {
    setBusy(true);
    setMsg(null);
    try {
      const text = await fn();
      setMsg({ kind: "ok", text });
      router.refresh();
    } catch (e) {
      let text = (e as Error).message;
      if (/community_share_cards/i.test(text)) {
        text +=
          " — the table is missing: apply supabase/migrations/0002_community_share_cards.sql in the Supabase SQL editor.";
      }
      setMsg({ kind: "err", text });
    } finally {
      setBusy(false);
    }
  }

  const save = (visibility: Visibility) =>
    withBusy(async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("You're signed out — refresh and sign in again.");
      const row = await insertShareCard(supabase, {
        title: effectiveTitle(),
        config: snapshot,
        visibility,
      });
      onSaved(row.id);
      return visibility === "shared" ? "Saved to the team library ✓" : "Saved to your library ✓";
    });

  const update = () =>
    withBusy(async () => {
      if (!loadedId) throw new Error("Nothing loaded to update.");
      const supabase = createClient();
      await updateShareCard(supabase, loadedId, { title: effectiveTitle(), config: snapshot });
      return "Updated ✓";
    });

  return (
    <>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={`Name (defaults to “${defaultTitle.slice(0, 32)}${defaultTitle.length > 32 ? "…" : ""}”)`}
        className="w-44 rounded-md border border-white/10 bg-neutral-900 px-2.5 py-1.5 text-xs text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-white/30 md:w-60"
      />
      {loadedOwned && loadedId && (
        <button
          onClick={update}
          disabled={busy}
          className={`${controlBtn} border border-white/10 text-neutral-200 hover:bg-white/5`}
        >
          {busy ? <Spinner size={14} className="animate-spin" /> : <ArrowClockwise size={14} />}
          Update
        </button>
      )}
      <button
        onClick={() => save("personal")}
        disabled={busy}
        title="Save to my library"
        className={`${controlBtn} bg-green-700 font-semibold text-white hover:brightness-110`}
      >
        {busy ? <Spinner size={14} className="animate-spin" /> : <FloppyDisk size={14} weight="bold" />}
        Save
      </button>
      <button
        onClick={() => save("shared")}
        disabled={busy}
        title="Save a shared copy for the whole team"
        className={`${controlBtn} border border-green-500/40 font-semibold text-green-500 hover:bg-green-500/10`}
      >
        <UsersThree size={14} weight="bold" />
        Save to team
      </button>
      {/* Floats below the toolbar (the parent cluster is `relative`) so the
          centered controls don't shift when it appears. */}
      {msg && (
        <span
          className={`pointer-events-none absolute left-1/2 top-full z-20 mt-2 max-w-[80vw] -translate-x-1/2 truncate rounded-md bg-neutral-900/95 px-2.5 py-1 text-[11px] ${
            msg.kind === "ok" ? "text-green-500" : "text-red-400"
          }`}
          title={msg.text}
        >
          {msg.text}
        </span>
      )}
    </>
  );
}
