"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Trash, UsersThree, Spinner } from "@phosphor-icons/react";
import { Card, Chip } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { deleteShareCard, updateShareCard, type SavedShareCardRow } from "@/lib/db/shareCards";
import { ASPECT_RATIOS } from "@/lib/share-cards/types";

function fmtDate(s: string) {
  try {
    return new Date(s).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function ratioLabel(row: SavedShareCardRow): string {
  return ASPECT_RATIOS.find((r) => r.id === row.config?.ratio)?.label ?? "Card";
}

const openCls =
  "flex items-center gap-1 rounded-pill bg-teal-900 px-3 py-1.5 text-[12px] font-semibold text-white";
const ghostCls =
  "flex items-center gap-1.5 rounded-pill border border-gray-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-gray-700 disabled:opacity-60";

function MineCard({ row, onChanged }: { row: SavedShareCardRow; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const shared = row.visibility === "shared";

  async function act(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      onChanged();
    } catch (e) {
      alert((e as Error).message);
      setBusy(false);
    }
  }

  const toggleShare = () =>
    act(async () => {
      const supabase = createClient();
      await updateShareCard(supabase, row.id, {
        visibility: shared ? "personal" : "shared",
      });
    });

  const remove = () => {
    if (!confirm(`Delete “${row.title}”?`)) return;
    act(async () => {
      const supabase = createClient();
      await deleteShareCard(supabase, row.id);
    });
  };

  return (
    <Card className="flex h-full flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[14px] font-semibold leading-snug text-ink">{row.title}</h3>
        <Chip tone={shared ? "green" : "neutral"}>{shared ? "Shared" : "Personal"}</Chip>
      </div>
      <p className="mt-1 text-[12px] text-gray-500">
        {ratioLabel(row)} · {fmtDate(row.created_at)}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link href={`/share-cards?id=${row.id}`} className={openCls}>
          Open <ArrowRight size={12} />
        </Link>
        <button onClick={toggleShare} disabled={busy} className={ghostCls}>
          {busy ? <Spinner size={13} className="animate-spin" /> : <UsersThree size={13} />}
          {shared ? "Unshare" : "Share to team"}
        </button>
        <button
          onClick={remove}
          disabled={busy}
          aria-label="Delete"
          className="ml-auto rounded-pill border border-gray-200 bg-white px-2.5 py-1.5 text-gray-500 hover:text-danger disabled:opacity-60"
        >
          <Trash size={14} />
        </button>
      </div>
    </Card>
  );
}

function SharedCard({ row }: { row: SavedShareCardRow }) {
  return (
    <Card className="flex h-full flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[14px] font-semibold leading-snug text-ink">{row.title}</h3>
        <Chip tone="teal">Team</Chip>
      </div>
      <p className="mt-1 text-[12px] text-gray-500">
        {ratioLabel(row)} · {fmtDate(row.created_at)}
      </p>
      <div className="mt-4">
        <Link href={`/share-cards?id=${row.id}`} className={openCls}>
          Open <ArrowRight size={12} />
        </Link>
      </div>
    </Card>
  );
}

export function ShareCardsLibraryView({
  mine,
  shared,
}: {
  mine: SavedShareCardRow[];
  shared: SavedShareCardRow[];
}) {
  const router = useRouter();
  const refresh = () => router.refresh();

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-gray-500">
          My share cards
        </h2>
        {mine.length === 0 ? (
          <Card className="p-6 text-[13px] text-gray-500">
            No saved share cards yet. Open the{" "}
            <Link href="/share-cards" className="font-semibold text-green-700">
              Share cards studio
            </Link>{" "}
            and hit <span className="font-semibold">Save</span>.
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mine.map((r) => (
              <MineCard key={r.id} row={r} onChanged={refresh} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-gray-500">
          Team library
        </h2>
        {shared.length === 0 ? (
          <p className="text-[13px] text-gray-500">No share cards shared with the team yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shared.map((r) => (
              <SharedCard key={r.id} row={r} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
