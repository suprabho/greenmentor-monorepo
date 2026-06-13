"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FloppyDisk, UsersThree, ArrowClockwise, Spinner } from "@phosphor-icons/react";
import { Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { insertHeader, updateHeader, type Visibility } from "@/lib/db/headers";
import type { HeaderConfig } from "@/lib/header/types";

/**
 * Save the current studio config to Supabase — to the signed-in user's personal
 * library or the shared team library. When the studio was opened from an
 * existing header the user owns, also offers an in-place Update.
 */
export function SaveBar({
  config,
  loadedId,
  loadedOwned,
}: {
  config: HeaderConfig;
  loadedId: string | null;
  loadedOwned: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const effectiveTitle = () =>
    title.trim() || config.title.trim() || "Untitled header";

  async function withBusy(fn: () => Promise<string>) {
    setBusy(true);
    setMsg(null);
    try {
      const text = await fn();
      setMsg({ kind: "ok", text });
      router.refresh();
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
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
      await insertHeader(supabase, { title: effectiveTitle(), config, visibility });
      return visibility === "shared"
        ? "Saved to the team library ✓"
        : "Saved to your library ✓";
    });

  const update = () =>
    withBusy(async () => {
      if (!loadedId) throw new Error("Nothing loaded to update.");
      const supabase = createClient();
      await updateHeader(supabase, loadedId, { title: effectiveTitle(), config });
      return "Updated ✓";
    });

  return (
    <Card className="mb-6 flex flex-wrap items-center gap-3 p-4">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={`Name (defaults to “${config.title.slice(0, 40)}${config.title.length > 40 ? "…" : ""}”)`}
        className="min-w-[200px] flex-1 rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-[13px] text-ink outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
      />
      {loadedOwned && (
        <button
          onClick={update}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-pill border border-gray-200 bg-white px-3.5 py-2 text-[12.5px] font-semibold text-gray-700 disabled:opacity-60"
        >
          {busy ? <Spinner size={14} className="animate-spin" /> : <ArrowClockwise size={14} />}
          Update
        </button>
      )}
      <button
        onClick={() => save("personal")}
        disabled={busy}
        className="flex items-center gap-1.5 rounded-pill bg-teal-900 px-4 py-2 text-[12.5px] font-semibold text-white disabled:opacity-60"
      >
        {busy ? <Spinner size={14} className="animate-spin" /> : <FloppyDisk size={14} weight="bold" />}
        Save to my library
      </button>
      <button
        onClick={() => save("shared")}
        disabled={busy}
        className="flex items-center gap-1.5 rounded-pill border border-green-200 bg-green-50 px-4 py-2 text-[12.5px] font-semibold text-green-700 disabled:opacity-60"
      >
        <UsersThree size={14} weight="bold" />
        Save to team
      </button>
      {msg && (
        <span
          className={`w-full text-[12px] ${msg.kind === "ok" ? "text-green-700" : "text-danger"}`}
        >
          {msg.text}
        </span>
      )}
    </Card>
  );
}
