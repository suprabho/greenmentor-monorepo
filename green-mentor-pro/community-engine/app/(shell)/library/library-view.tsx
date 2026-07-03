"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Trash, UsersThree, Spinner } from "@phosphor-icons/react";
import { Card, Chip } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { deleteHeader, updateHeader, type SavedHeaderRow } from "@/lib/db/headers";
import { sizeFor } from "@/lib/header/types";

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

const openCls =
  "flex items-center gap-1 rounded-pill bg-teal-900 px-3 py-1.5 text-[12px] font-semibold text-white";
const ghostCls =
  "flex items-center gap-1.5 rounded-pill border border-gray-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-gray-700 disabled:opacity-60";

function MineCard({ row, onChanged }: { row: SavedHeaderRow; onChanged: () => void }) {
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
      await updateHeader(supabase, row.id, {
        visibility: shared ? "personal" : "shared",
      });
    });

  const remove = () => {
    if (!confirm(`Delete “${row.title}”?`)) return;
    act(async () => {
      const supabase = createClient();
      await deleteHeader(supabase, row.id);
    });
  };

  return (
    <Card className="flex h-full flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[14px] font-semibold leading-snug text-ink">{row.title}</h3>
        <Chip tone={shared ? "green" : "neutral"}>{shared ? "Shared" : "Personal"}</Chip>
      </div>
      <p className="mt-1 text-[12px] text-gray-500">
        {sizeFor(row.config.sizeId).label} · {fmtDate(row.created_at)}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link href={`/header-studio?load=${row.id}`} className={openCls}>
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

function SharedCard({ row }: { row: SavedHeaderRow }) {
  return (
    <Card className="flex h-full flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[14px] font-semibold leading-snug text-ink">{row.title}</h3>
        <Chip tone="teal">Team</Chip>
      </div>
      <p className="mt-1 text-[12px] text-gray-500">
        {sizeFor(row.config.sizeId).label} · {fmtDate(row.created_at)}
      </p>
      <div className="mt-4">
        <Link href={`/header-studio?load=${row.id}`} className={openCls}>
          Open <ArrowRight size={12} />
        </Link>
      </div>
    </Card>
  );
}

export function LibraryView({
  mine,
  shared,
}: {
  mine: SavedHeaderRow[];
  shared: SavedHeaderRow[];
  userId: string;
}) {
  const router = useRouter();
  const refresh = () => router.refresh();

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-gray-500">
          My headers
        </h2>
        {mine.length === 0 ? (
          <Card className="p-6 text-[13px] text-gray-500">
            No saved headers yet. Open the{" "}
            <Link href="/header-studio" className="font-semibold text-green-700">
              Aura Header Studio
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
          <p className="text-[13px] text-gray-500">No headers shared with the team yet.</p>
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
