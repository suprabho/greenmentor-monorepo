"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Trash, UsersThree, Spinner } from "@phosphor-icons/react";
import { AdminTable } from "@/components/admin";
import { Card, Chip } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { deleteShareCard, updateShareCard, type SavedShareCardRow } from "@/lib/db/shareCards";
import { ASPECT_RATIOS } from "@/lib/share-cards/types";

function fmtDate(value: string) {
  try {
    return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

function ratioLabel(row: SavedShareCardRow): string {
  return ASPECT_RATIOS.find((ratio) => ratio.id === row.config?.ratio)?.label ?? "Card";
}

const openCls = "inline-flex items-center gap-1 rounded-pill bg-teal-900 px-3 py-1.5 text-[12px] font-semibold text-white";

function CardActions({ row, onChanged }: { row: SavedShareCardRow; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const shared = row.visibility === "shared";
  async function act(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      onChanged();
    } catch (error) {
      alert((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex justify-end gap-2">
      <Link href={"/share-cards?id=" + row.id} className={openCls}>Open <ArrowRight size={12} /></Link>
      <button type="button" onClick={() => void act(async () => { await updateShareCard(createClient(), row.id, { visibility: shared ? "personal" : "shared" }); })} disabled={busy} className="inline-flex items-center gap-1.5 rounded-pill border border-gray-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-gray-700 disabled:opacity-60">
        {busy ? <Spinner size={13} className="animate-spin" /> : <UsersThree size={13} />} {shared ? "Unshare" : "Share"}
      </button>
      <button type="button" onClick={() => { if (confirm('Delete "' + row.title + '"?')) void act(() => deleteShareCard(createClient(), row.id)); }} disabled={busy} className="rounded-pill border border-gray-200 px-2.5 py-1.5 text-gray-500 hover:text-danger disabled:opacity-60" aria-label="Delete">
        <Trash size={14} />
      </button>
    </div>
  );
}

function CardsTable({ rows, mine, published, onChanged }: { rows: SavedShareCardRow[]; mine: boolean; published: Set<string>; onChanged: () => void }) {
  return (
    <AdminTable
      rows={rows}
      rowKey={(row) => row.id}
      caption={mine ? "My share cards" : "Team share cards"}
      empty={mine ? "No saved share cards yet." : "No share cards shared with the team yet."}
      columns={[
        {
          key: "card",
          label: "Share card",
          render: (row) => <div><div className="truncate font-semibold text-ink">{row.title}</div><div className="mt-0.5 text-[11.5px] text-gray-500">{ratioLabel(row)} · {fmtDate(row.created_at)}</div></div>,
        },
        {
          key: "visibility",
          label: "Visibility",
          responsive: "secondary",
          render: (row) => (
            <div className="flex flex-wrap gap-1.5">
              <Chip tone={row.visibility === "shared" ? "green" : "neutral"}>{row.visibility === "shared" ? "Shared" : "Personal"}</Chip>
              {published.has(row.id) && <Chip tone="teal">Published</Chip>}
            </div>
          ),
        },
        {
          key: "updated",
          label: "Updated",
          responsive: "secondary",
          render: (row) => fmtDate(row.updated_at),
        },
        {
          key: "actions",
          label: "Actions",
          sticky: true,
          className: "w-64 text-right",
          render: (row) => mine ? <CardActions row={row} onChanged={onChanged} /> : <div className="flex justify-end"><Link href={"/share-cards?id=" + row.id} className={openCls}>Open <ArrowRight size={12} /></Link></div>,
        },
      ]}
    />
  );
}

export function ShareCardsLibraryView({ mine, shared, published = [] }: { mine: SavedShareCardRow[]; shared: SavedShareCardRow[]; published?: string[] }) {
  // An array prop (Sets don't cross the server→client boundary), a Set here.
  const publishedIds = new Set(published);
  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-gray-500">My share cards</h2>
        {mine.length === 0 ? (
          <Card className="p-6 text-[13px] text-gray-500">No saved share cards yet. Open the <Link href="/share-cards" className="font-semibold text-green-700">Share cards studio</Link> and hit <span className="font-semibold">Save</span>.</Card>
        ) : (
          <CardsTable rows={mine} mine published={publishedIds} onChanged={() => window.location.reload()} />
        )}
      </section>
      <section>
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-gray-500">Team library</h2>
        <CardsTable rows={shared} mine={false} published={publishedIds} onChanged={() => undefined} />
      </section>
    </div>
  );
}
