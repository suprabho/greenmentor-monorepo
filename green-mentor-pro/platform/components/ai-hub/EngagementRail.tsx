"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { Plus, X } from "@phosphor-icons/react";

export interface EngagementLite {
  id: string;
  client_name: string;
  financial_year: string;
  framework: string[];
  status: string;
}

/**
 * Left column of the Cowork engagement view: the list of engagements with an
 * inline "new engagement" form (reuses POST /api/ai-hub/engagements). The active
 * engagement is highlighted from the current route param.
 */
export function EngagementRail({ activeId }: { activeId?: string }) {
  const router = useRouter();
  const [list, setList] = useState<EngagementLite[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [clientName, setClientName] = useState("");
  const [fy, setFy] = useState("FY2025-26");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch("/api/ai-hub/engagements")
      .then((r) => (r.ok ? r.json() : r.json().then((j) => Promise.reject(j.error))))
      .then((j) => setList(j.engagements ?? []))
      .catch((e) => setError(String(e)));
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/ai-hub/engagements", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientName, financialYear: fy, framework: ["BRSR"] }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      router.push(`/ai-hub/cowork/${json.engagement.id}`);
    } catch (e2) {
      setError(String(e2 instanceof Error ? e2.message : e2));
      setCreating(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-3">
        <span className="text-[13.5px] font-semibold text-ink">Engagements</span>
        <button
          onClick={() => setShowNew((v) => !v)}
          className="grid size-7 place-items-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-ink"
          aria-label="New engagement"
        >
          {showNew ? <X size={16} /> : <Plus size={16} weight="bold" />}
        </button>
      </div>

      {showNew && (
        <form onSubmit={create} className="shrink-0 space-y-2 border-b border-gray-200 bg-gray-50 p-3">
          <input
            required
            autoFocus
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Client / entity"
            className="w-full rounded-[10px] border border-gray-200 bg-white px-2.5 py-1.5 text-[12.5px] outline-none focus:border-teal-700"
          />
          <input
            required
            value={fy}
            onChange={(e) => setFy(e.target.value)}
            placeholder="Financial year"
            className="w-full rounded-[10px] border border-gray-200 bg-white px-2.5 py-1.5 text-[12.5px] outline-none focus:border-teal-700"
          />
          <button
            type="submit"
            disabled={creating}
            className="w-full rounded-pill bg-teal-900 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create engagement"}
          </button>
        </form>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {error && <p className="px-2 py-1.5 text-[12px] text-danger">{error}</p>}
        {list === null ? (
          <p className="px-2 py-2 text-[12.5px] text-gray-500">Loading…</p>
        ) : list.length === 0 ? (
          <p className="px-2 py-2 text-[12.5px] text-gray-500">No engagements yet — create one above.</p>
        ) : (
          list.map((e) => (
            <Link
              key={e.id}
              href={`/ai-hub/cowork/${e.id}`}
              className={clsx(
                "block rounded-xl px-3 py-2.5 transition-colors",
                e.id === activeId ? "bg-teal-900/[0.06] ring-1 ring-teal-900/15" : "hover:bg-gray-50"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-[13px] font-semibold text-ink">{e.client_name}</span>
                {e.status === "active" ? (
                  <span className="size-1.5 shrink-0 rounded-full bg-green-500" />
                ) : null}
              </div>
              <div className="mt-0.5 truncate text-[11.5px] text-gray-500">
                {e.financial_year} · {(e.framework ?? []).join(", ")}
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
