"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Chip, PageHeader } from "@/components/ui";

interface Engagement {
  id: string;
  client_name: string;
  financial_year: string;
  framework: string[];
  status: string;
  created_at: string;
}

export default function EngagementsPage() {
  const router = useRouter();
  const [list, setList] = useState<Engagement[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [clientName, setClientName] = useState("");
  const [fy, setFy] = useState("FY2025-26");

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
      router.push(`/ai-hub/engagements/${json.engagement.id}`);
    } catch (e2) {
      setError(String(e2 instanceof Error ? e2.message : e2));
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="BRSR Engagements" sub="Run a full 8-phase ESG reporting engagement, end to end" />

      <Card className="space-y-3 p-5">
        <Chip tone="teal">New engagement</Chip>
        <form onSubmit={create} className="flex flex-wrap items-end gap-3">
          <label className="flex-1">
            <span className="mb-1 block text-[12px] font-semibold text-gray-600">Client / entity</span>
            <input
              required
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Acme Manufacturing Ltd"
              className="w-full rounded-[10px] border border-gray-200 bg-gray-50 px-3 py-2 text-[13.5px] outline-none focus:border-teal-700"
            />
          </label>
          <label className="w-40">
            <span className="mb-1 block text-[12px] font-semibold text-gray-600">Financial year</span>
            <input
              required
              value={fy}
              onChange={(e) => setFy(e.target.value)}
              className="w-full rounded-[10px] border border-gray-200 bg-gray-50 px-3 py-2 text-[13.5px] outline-none focus:border-teal-700"
            />
          </label>
          <button
            type="submit"
            disabled={creating}
            className="rounded-pill bg-teal-900 px-5 py-2.5 text-[13.5px] font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create"}
          </button>
        </form>
        {error && <p className="rounded-[10px] bg-red-50 px-3 py-2 text-[12.5px] text-danger">{error}</p>}
      </Card>

      <div className="space-y-2.5">
        {list === null ? (
          <p className="text-[13px] text-gray-500">Loading…</p>
        ) : list.length === 0 ? (
          <p className="text-[13px] text-gray-500">No engagements yet — create one above.</p>
        ) : (
          list.map((e) => (
            <Link key={e.id} href={`/ai-hub/engagements/${e.id}`}>
              <Card className="flex items-center justify-between p-4 transition-colors hover:border-gray-300">
                <div>
                  <div className="text-[15px] font-semibold text-ink">{e.client_name}</div>
                  <div className="text-[12.5px] text-gray-600">
                    {e.financial_year} · {(e.framework ?? []).join(", ")}
                  </div>
                </div>
                <Chip tone={e.status === "active" ? "green" : "neutral"}>{e.status}</Chip>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
