"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Trash, UsersThree, Spinner } from "@phosphor-icons/react";
import { AdminTable } from "@/components/admin";
import { Card, Chip } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { deleteHeader, updateHeader, type SavedHeaderRow } from "@/lib/db/headers";
import { sizeFor } from "@/lib/header/types";

function fmtDate(value: string) {
  try {
    return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

const openCls = "inline-flex items-center gap-1 rounded-pill bg-teal-900 px-3 py-1.5 text-[12px] font-semibold text-white";
const ghostCls = "inline-flex items-center gap-1.5 rounded-pill border border-gray-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-gray-700 disabled:opacity-60";

function HeaderActions({ row, onChanged }: { row: SavedHeaderRow; onChanged: () => void }) {
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
      <Link href={"/header-studio?load=" + row.id} className={openCls}>Open <ArrowRight size={12} /></Link>
      <button type="button" onClick={() => void act(async () => { await updateHeader(createClient(), row.id, { visibility: shared ? "personal" : "shared" }); })} disabled={busy} className={ghostCls}>
        {busy ? <Spinner size={13} className="animate-spin" /> : <UsersThree size={13} />}
        {shared ? "Unshare" : "Share"}
      </button>
      <button type="button" onClick={() => { if (confirm('Delete "' + row.title + '"?')) void act(() => deleteHeader(createClient(), row.id)); }} disabled={busy} className="rounded-pill border border-gray-200 px-2.5 py-1.5 text-gray-500 hover:text-danger disabled:opacity-60" aria-label="Delete">
        <Trash size={14} />
      </button>
    </div>
  );
}

function HeaderTable({ rows, mine, onChanged }: { rows: SavedHeaderRow[]; mine: boolean; onChanged: () => void }) {
  return (
    <AdminTable
      rows={rows}
      rowKey={(row) => row.id}
      caption={mine ? "My headers" : "Team headers"}
      empty={mine ? "No saved headers yet." : "No headers shared with the team yet."}
      columns={[
        {
          key: "header",
          label: "Header",
          render: (row) => (
            <div className="min-w-0">
              <div className="truncate font-semibold text-ink">{row.title}</div>
              <div className="mt-0.5 text-[11.5px] text-gray-500">{sizeFor(row.config.sizeId).label} · {fmtDate(row.created_at)}</div>
            </div>
          ),
        },
        {
          key: "visibility",
          label: "Visibility",
          responsive: "secondary",
          render: (row) => <Chip tone={row.visibility === "shared" ? "green" : "neutral"}>{row.visibility === "shared" ? "Shared" : "Personal"}</Chip>,
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
          render: (row) => mine ? <HeaderActions row={row} onChanged={onChanged} /> : <div className="flex justify-end"><Link href={"/header-studio?load=" + row.id} className={openCls}>Open <ArrowRight size={12} /></Link></div>,
        },
      ]}
    />
  );
}

export function LibraryView({ mine, shared }: { mine: SavedHeaderRow[]; shared: SavedHeaderRow[]; userId: string }) {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-gray-500">My headers</h2>
        {mine.length === 0 ? (
          <Card className="p-6 text-[13px] text-gray-500">
            No saved headers yet. Open the <Link href="/header-studio" className="font-semibold text-green-700">Aura Header Studio</Link> and hit <span className="font-semibold">Save</span>.
          </Card>
        ) : (
          <HeaderTable rows={mine} mine onChanged={() => window.location.reload()} />
        )}
      </section>
      <section>
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-gray-500">Team library</h2>
        <HeaderTable rows={shared} mine={false} onChanged={() => undefined} />
      </section>
    </div>
  );
}
