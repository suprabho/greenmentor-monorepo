// Maker–checker actions on a Submitted entry (shown only to admins/managers).
// Approve → POST review {Accepted}; Reject → open a feedback modal → {Rejected}.
"use client";

import { useState } from "react";
import { Check, X } from "@phosphor-icons/react";
import { Button, Textarea } from "@/components/esg/ui";

export function ApprovalActions({
  kind,
  id,
  onDone,
}: {
  kind: "fuel" | "electricity";
  id: string;
  onDone: () => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function review(decision: "Accepted" | "Rejected") {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/energy/${kind}/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, feedback: decision === "Rejected" ? feedback : undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Review failed");
      setRejecting(false);
      setFeedback("");
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Review failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <Button variant="ghost" className="px-2 py-1 text-green-700" title="Approve" disabled={busy} onClick={() => review("Accepted")}>
        <Check size={15} weight="bold" />
      </Button>
      <Button variant="ghost" className="px-2 py-1 text-danger" title="Reject" disabled={busy} onClick={() => setRejecting(true)}>
        <X size={15} weight="bold" />
      </Button>

      {rejecting && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={() => setRejecting(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[15px] font-semibold text-ink">Reject entry</h3>
            <p className="mb-3 mt-1 text-[12.5px] text-gray-600">Tell the submitter what needs fixing.</p>
            <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Reason for rejection…" autoFocus />
            {err && <p className="mt-2 text-[12px] text-danger">{err}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setRejecting(false)}>Cancel</Button>
              <Button variant="danger" disabled={busy || !feedback.trim()} onClick={() => review("Rejected")}>
                {busy ? "Rejecting…" : "Reject"}
              </Button>
            </div>
          </div>
        </div>
      )}
      {err && !rejecting && <span className="text-[11px] text-danger">{err}</span>}
    </div>
  );
}
