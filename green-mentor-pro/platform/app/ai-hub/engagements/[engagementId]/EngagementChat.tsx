"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import DataRequestCard, { type DataRequestData } from "@/app/buddy/DataRequestCard";
import { Card } from "@/components/ui";

const ACCENT = "#1f8a5b";
const BORDER = "#e3e8e5";

// Compact render for the non-card engagement tools (captureRequirements,
// approvePhase, requestChanges, showArtifact, runPhase).
function ToolLine({ name, output }: { name: string; output: Record<string, unknown> }) {
  if (name === "tool-captureRequirements") return <Note>✓ Requirements saved</Note>;
  if (name === "tool-approvePhase") return <Note>{output.ok ? `✓ Approved ${output.approved}` : `⚠ ${output.error}`}</Note>;
  if (name === "tool-requestChanges") return <Note>{output.ok ? `↩ Sent back ${output.sent_back}` : `⚠ ${output.error}`}</Note>;
  if (name === "tool-showArtifact") return <Note>{output.found ? `${output.phase}: ${String(output.summary).slice(0, 240)}` : `No artifact yet for ${output.phase}`}</Note>;
  if (name === "tool-runPhase") {
    return (
      <Note>
        {output.runnable ? `▶ Ready to run ${output.label} — use the Run button on the board.` : `${output.label} isn't runnable yet (${output.reason}).`}
      </Note>
    );
  }
  return null;
}
const Note = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize: 12.5, color: "#5d6b64", background: "#f0f6f3", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "7px 11px" }}>{children}</div>
);

export function EngagementChat({ engagementId, onChange }: { engagementId: string; onChange: () => void }) {
  const { messages, sendMessage, status, setMessages } = useChat({
    transport: new DefaultChatTransport({ api: `/api/ai-hub/engagements/${engagementId}/chat` }),
  });
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const busy = status === "submitted" || status === "streaming";

  // Hydrate the persisted conversation.
  useEffect(() => {
    fetch(`/api/ai-hub/engagements/${engagementId}/chat`)
      .then((r) => r.json())
      .then((j) => { if (Array.isArray(j.messages) && j.messages.length) setMessages(j.messages); })
      .catch(() => {});
  }, [engagementId, setMessages]);

  // A finished assistant turn may have mutated engagement state → refresh the board.
  useEffect(() => { if (status === "ready") onChange(); }, [status, onChange]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, status]);

  const send = (t: string) => { const v = t.trim(); if (!v || busy) return; sendMessage({ text: v }); setInput(""); };

  return (
    <Card className="flex flex-col p-0" >
      <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
        <span style={{ width: 26, height: 26, borderRadius: 8, background: ACCENT, color: "#fff", display: "grid", placeItems: "center", fontSize: 14 }}>🌱</span>
        <span className="text-[13.5px] font-semibold text-ink">Report Copilot</span>
        <span className="text-[11.5px] text-gray-500">drives the pipeline by chat</span>
      </div>

      <div className="max-h-96 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <p className="text-[13px] text-gray-500">
            Ask me to capture requirements, run the next phase, summarize an artifact, or approve a gate.
          </p>
        )}
        {messages.map((m) => {
          const isUser = m.role === "user";
          return (
            <div key={m.id} style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: isUser ? "flex-end" : "flex-start" }}>
              {(m.parts as { type: string; text?: string; state?: string; output?: unknown }[]).map((part, i) => {
                if (part.type === "text" && part.text) {
                  return (
                    <div key={i} style={{ maxWidth: "85%", whiteSpace: "pre-wrap", lineHeight: 1.5, fontSize: 14, padding: "9px 12px", borderRadius: 13, background: isUser ? ACCENT : "#fff", color: isUser ? "#fff" : "#1a2420", border: isUser ? "none" : `1px solid ${BORDER}` }}>
                      {part.text}
                    </div>
                  );
                }
                if (part.type === "tool-draftDataRequest" && part.state === "output-available") {
                  return <DataRequestCard key={i} data={part.output as DataRequestData} />;
                }
                if (part.type?.startsWith("tool-") && part.state === "output-available") {
                  return <ToolLine key={i} name={part.type} output={(part.output ?? {}) as Record<string, unknown>} />;
                }
                return null;
              })}
            </div>
          );
        })}
        {status === "submitted" && <div className="text-[12.5px] text-gray-400">Copilot is thinking…</div>}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-end gap-2 border-t border-gray-100 p-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
          rows={1}
          placeholder="e.g. capture our frameworks as BRSR + GRI, then run kickoff"
          className="flex-1 resize-none rounded-[10px] border border-gray-200 bg-gray-50 px-3 py-2 text-[13.5px] outline-none focus:border-teal-700"
        />
        <button type="submit" disabled={busy || !input.trim()} className="rounded-pill bg-green-700 px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-40">
          {busy ? "…" : "Send"}
        </button>
      </form>
    </Card>
  );
}
