"use client";

/**
 * People sub-section, rendered inside a webinar's expanded row next to the polls
 * editor. Two lists over the same contact shape:
 *
 *   RSVPs     — name, email and phone each learner gave when they signed up
 *               (platform migration 0024; before it, only a user_id was kept, so
 *               older rows show what could be backfilled from their account).
 *   Attendees — who actually turned up, from two sources that merge onto one row
 *               per person: a join through the platform's embedded player, and
 *               Zoom's participant report uploaded here after the session.
 *
 * Export is done in the browser from the rows already loaded — no export route
 * to keep in sync, and the CSV always matches what's on screen, filter included.
 *
 * This lives inside the webinar <form> in webinars-panel, so every control is
 * type="button" and the search input swallows Enter — otherwise typing here would
 * submit the webinar.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { DownloadSimple, UploadSimple } from "@phosphor-icons/react/dist/ssr";
import type { WebinarAttendanceRow, WebinarRsvpRow } from "@/lib/db/webinar-people";

const inputCls =
  "rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[13px] text-ink placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500";

type Tab = "rsvps" | "attendees";

/** Flattened row for display + export, so both lists share one renderer. */
interface PersonRow {
  name: string;
  email: string;
  phone: string;
  /** Right-hand column: RSVP time, or how the attendee was seen. */
  detail: string;
  /** Second right-hand column: blank for RSVPs, watch time for attendees. */
  extra: string;
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

/**
 * Watch time: Zoom's own figure when we have it, otherwise the in-app window
 * between first join and last heartbeat. The heartbeat runs once a minute, so
 * the in-app figure is approximate and marked with a ~.
 */
function watchTime(row: WebinarAttendanceRow): string {
  if (row.zoom_duration_minutes != null) return `${row.zoom_duration_minutes} min`;
  if (!row.first_joined_at || !row.last_seen_at) return "—";
  const mins = Math.round(
    (new Date(row.last_seen_at).getTime() - new Date(row.first_joined_at).getTime()) / 60000
  );
  return mins <= 0 ? "<1 min" : `~${mins} min`;
}

function attendeeSource(row: WebinarAttendanceRow): string {
  if (row.joined_in_app && row.in_zoom_report) return "App + Zoom";
  if (row.joined_in_app) return row.join_count > 1 ? `App (${row.join_count} joins)` : "App";
  if (row.in_zoom_report) return "Zoom report";
  return "—";
}

function toCsv(rows: PersonRow[], headers: string[]): string {
  const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v);
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push([r.name, r.email, r.phone, r.detail, r.extra].map((v) => escape(v)).join(","));
  }
  return lines.join("\r\n");
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "webinar";
}

function download(filename: string, csv: string): void {
  // Leading BOM so Excel opens it as UTF-8 — attendee names carry accents.
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function WebinarPeople({ webinarId, webinarTitle }: { webinarId: string; webinarTitle: string }) {
  const [rsvps, setRsvps] = useState<WebinarRsvpRow[]>([]);
  const [attendance, setAttendance] = useState<WebinarAttendanceRow[]>([]);
  const [tab, setTab] = useState<Tab>("rsvps");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async (signal?: { cancelled: boolean }) => {
    try {
      const res = await fetch(`/api/webinars/${webinarId}/people`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      if (signal?.cancelled) return;
      setRsvps((body.rsvps as WebinarRsvpRow[]) ?? []);
      setAttendance((body.attendance as WebinarAttendanceRow[]) ?? []);
    } catch (err) {
      if (!signal?.cancelled) setError(err instanceof Error ? err.message : "Could not load people");
    } finally {
      if (!signal?.cancelled) setLoading(false);
    }
  };

  useEffect(() => {
    const signal = { cancelled: false };
    void load(signal);
    return () => {
      signal.cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webinarId]);

  const rsvpRows: PersonRow[] = useMemo(
    () =>
      rsvps.map((r) => ({
        name: r.full_name ?? "—",
        email: r.email ?? "—",
        phone: r.phone ?? "—",
        detail: fmtDateTime(r.created_at),
        extra: "",
      })),
    [rsvps]
  );

  const attendeeRows: PersonRow[] = useMemo(
    () =>
      attendance.map((r) => ({
        name: r.full_name ?? "—",
        email: r.email ?? "—",
        phone: r.phone ?? "—",
        detail: attendeeSource(r),
        extra: watchTime(r),
      })),
    [attendance]
  );

  const q = query.trim().toLowerCase();
  const all = tab === "rsvps" ? rsvpRows : attendeeRows;
  const shown = useMemo(
    () =>
      !q
        ? all
        : all.filter(
            (r) =>
              r.name.toLowerCase().includes(q) ||
              r.email.toLowerCase().includes(q) ||
              r.phone.replace(/\s/g, "").includes(q.replace(/\s/g, ""))
          ),
    [all, q]
  );

  const withPhone = (tab === "rsvps" ? rsvps : attendance).filter((r) => r.phone).length;

  const exportCsv = () => {
    const headers =
      tab === "rsvps"
        ? ["Name", "Email", "Phone", "RSVP'd at"]
        : ["Name", "Email", "Phone", "Seen via", "Watch time"];
    download(`${slugify(webinarTitle)}-${tab}.csv`, toCsv(shown, headers));
  };

  const importCsv = async (file: File) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const csv = await file.text();
      const res = await fetch(`/api/webinars/${webinarId}/attendance/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      if (body.mode === "unconfigured") {
        setError("Importing attendance needs SUPABASE_SERVICE_ROLE_KEY set server-side.");
        return;
      }
      const parts = [
        `Imported ${body.imported} participant${body.imported === 1 ? "" : "s"}`,
        `${body.matched} matched an existing attendee`,
        `${body.created} new`,
      ];
      const warnings = (body.warnings as string[] | undefined) ?? [];
      setNotice([parts.join(" · "), ...warnings].join(" "));
      setTab("attendees");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not import that file");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = ""; // let the same file be re-picked
    }
  };

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: "rsvps", label: "RSVPs", count: rsvps.length },
    { key: "attendees", label: "Attendees", count: attendance.length },
  ];

  return (
    <div className="mt-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">People</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-pill border border-gray-200 px-2.5 py-1 text-[12px] font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
          >
            <UploadSimple size={12} weight="bold" /> {busy ? "Importing…" : "Import Zoom report"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importCsv(file);
            }}
          />
          <button
            type="button"
            onClick={exportCsv}
            disabled={shown.length === 0}
            className="inline-flex items-center gap-1 rounded-pill border border-gray-200 px-2.5 py-1 text-[12px] font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
          >
            <DownloadSimple size={12} weight="bold" /> Export CSV
          </button>
        </div>
      </div>

      {error ? <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-danger">{error}</p> : null}
      {notice ? <p className="mb-2 rounded-lg bg-green-50 px-3 py-2 text-[12px] text-green-700">{notice}</p> : null}

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`rounded-pill px-3 py-1 text-[12px] font-medium transition-colors ${
                tab === t.key ? "bg-teal-900 text-white" : "text-gray-600 hover:bg-gray-100 hover:text-ink"
              }`}
            >
              {t.label} <span className={tab === t.key ? "opacity-70" : "text-gray-400"}>{t.count}</span>
            </button>
          ))}
        </div>
        {all.length > 0 ? (
          <div className="flex items-center gap-2">
            <span className="text-[11.5px] text-gray-500">
              {withPhone} of {all.length} with a phone number
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                // Inside the webinar <form> — Enter must not submit it.
                if (e.key === "Enter") e.preventDefault();
              }}
              placeholder="Search name, email, phone…"
              className={`${inputCls} w-52`}
            />
          </div>
        ) : null}
      </div>

      {loading ? (
        <p className="text-[12px] text-gray-500">Loading people…</p>
      ) : shown.length === 0 ? (
        <p className="text-[12px] text-gray-500">
          {all.length > 0
            ? `No ${tab === "rsvps" ? "RSVPs" : "attendees"} match "${query.trim()}".`
            : tab === "rsvps"
              ? "No RSVPs yet. Learners who RSVP on the platform appear here with their contact details."
              : "No attendees recorded yet. Rows appear when learners join through the platform, or import Zoom's participant report after the session."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full min-w-[640px] border-collapse text-[12.5px]">
            <thead>
              <tr className="border-b border-gray-100 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-500">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">{tab === "rsvps" ? "RSVP'd" : "Seen via"}</th>
                {tab === "attendees" ? <th className="px-3 py-2">Watch time</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {shown.map((r, i) => (
                <tr key={`${r.email}-${r.name}-${i}`} className="text-gray-700">
                  <td className="px-3 py-2 font-medium text-ink">{r.name}</td>
                  <td className="px-3 py-2">
                    {r.email === "—" ? (
                      r.email
                    ) : (
                      <a href={`mailto:${r.email}`} className="text-teal-900 hover:underline">
                        {r.email}
                      </a>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {r.phone === "—" ? (
                      <span className="text-gray-400">—</span>
                    ) : (
                      <a href={`tel:${r.phone}`} className="text-teal-900 hover:underline">
                        {r.phone}
                      </a>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{r.detail}</td>
                  {tab === "attendees" ? <td className="px-3 py-2 text-gray-600">{r.extra}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
