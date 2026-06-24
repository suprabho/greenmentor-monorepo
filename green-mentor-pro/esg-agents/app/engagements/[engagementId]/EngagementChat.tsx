"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const ACCENT = "#1f8a5b";
const BORDER = "#e3e8e5";

interface RunCard { phase_key: string; agent_key: string; label: string; runnable: boolean; reason?: string | null }

/**
 * Engagement-scoped copilot panel (co-equal with the board). Streams against the
 * engagement chat route, persists history, supports document upload, and its tool
 * actions write the same Supabase state the board uses — a refresh keeps both in sync.
 * The runPhase tool renders a confirmation card whose button dispatches to the run
 * route (long agent runs don't block the chat stream).
 */
export default function EngagementChat({ engagementId, initialMessages }: { engagementId: string; initialMessages: UIMessage[] }) {
  const router = useRouter();
  const { messages, sendMessage, status } = useChat({
    messages: initialMessages,
    transport: new DefaultChatTransport({ api: `/api/engagements/${engagementId}/chat` }),
  });
  const [input, setInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [running, setRunning] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const prevStatus = useRef(status);
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, status]);
  useEffect(() => {
    if (prevStatus.current === "streaming" && status === "ready") router.refresh();
    prevStatus.current = status;
  }, [status, router]);

  const send = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    sendMessage({ text: t });
    setInput("");
  };

  const runFromCard = async (card: RunCard) => {
    setRunning(true); setNote(null);
    try {
      const res = await fetch(`/api/agents/${card.agent_key}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engagementId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setNote(`${card.label} ran — review it on the board.`);
      router.refresh();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "run failed");
    } finally {
      setRunning(false);
    }
  };

  const upload = async (file: File) => {
    setUploading(true); setNote(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/engagements/${engagementId}/upload`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "upload failed");
      setNote(`Uploaded ${file.name}.`);
      sendMessage({ text: `I uploaded a document: ${file.name}. Please use it for data collection.` });
    } catch (e) {
      setNote(e instanceof Error ? e.message : "upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div style={{ borderLeft: `1px solid ${BORDER}`, background: "#fff", display: "flex", flexDirection: "column", height: "100vh", position: "sticky", top: 0 }}>
      <div style={{ padding: "14px 16px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 9 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: ACCENT, color: "#fff", display: "grid", placeItems: "center", fontSize: 15 }}>🌱</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14.5 }}>Report Copilot</div>
          <div style={{ fontSize: 11.5, color: "#5d6b64" }}>Requirements · documents · run phases</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
        {messages.length === 0 ? (
          <div style={{ fontSize: 13, color: "#5d6b64", lineHeight: 1.55 }}>
            Tell me about this report — company, frameworks, reporting year, sites — or drop a utility bill / policy below.
            I can run pipeline phases and surface drafts for your review here, in step with the board.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.map((m) => {
              const isUser = m.role === "user";
              const text = (m.parts as { type: string; text?: string }[]).filter((p) => p.type === "text" && p.text).map((p) => p.text).join("");
              const runCards = (m.parts as { type: string; state?: string; output?: unknown }[])
                .filter((p) => p.type === "tool-runPhase" && p.state === "output-available")
                .map((p) => p.output as RunCard);
              return (
                <div key={m.id} style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: isUser ? "flex-end" : "flex-start" }}>
                  {text && (
                    <div style={{ maxWidth: "88%", whiteSpace: "pre-wrap", lineHeight: 1.5, fontSize: 13.5, padding: "9px 12px", borderRadius: 12, background: isUser ? ACCENT : "#f6f8f7", color: isUser ? "#fff" : "#1a2420", border: isUser ? "none" : `1px solid ${BORDER}` }}>
                      {text}
                    </div>
                  )}
                  {runCards.map((card, i) => (
                    <div key={i} style={{ width: "88%", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 12, background: "#fff" }}>
                      <div style={{ fontWeight: 650, fontSize: 13.5 }}>{card.label}</div>
                      {card.runnable ? (
                        <button disabled={running} onClick={() => runFromCard(card)} style={{ marginTop: 8, background: "#2848b8", color: "#fff", border: "none", borderRadius: 8, padding: "7px 13px", fontSize: 13, fontWeight: 650, cursor: running ? "wait" : "pointer", opacity: running ? 0.6 : 1 }}>
                          {running ? "Running…" : "▸ Run this phase"}
                        </button>
                      ) : (
                        <div style={{ fontSize: 12.5, color: "#b8860b", marginTop: 6 }}>{card.reason ?? "Not runnable yet."}</div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
            {status === "submitted" && <div style={{ fontSize: 12.5, color: "#8a958f" }}>Copilot is thinking…</div>}
          </div>
        )}
        {note && <div style={{ fontSize: 12, color: "#5d6b64", background: "#f0f6f3", padding: "7px 9px", borderRadius: 8, marginTop: 10 }}>{note}</div>}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(input); }} style={{ borderTop: `1px solid ${BORDER}`, padding: 10 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "flex-end", background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 6 }}>
          <button type="button" title="Upload document" onClick={() => fileRef.current?.click()} disabled={uploading} style={{ background: "#f0f6f3", border: "none", borderRadius: 8, padding: "8px 10px", cursor: "pointer", fontSize: 15 }}>{uploading ? "…" : "📎"}</button>
          <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.csv" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
          <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }} placeholder="Message the copilot…" rows={1} style={{ flex: 1, resize: "none", border: "none", outline: "none", fontSize: 13.5, fontFamily: "inherit", padding: "7px 4px", maxHeight: 120, background: "transparent" }} />
          <button type="submit" disabled={busy || !input.trim()} style={{ background: ACCENT, color: "#fff", border: "none", borderRadius: 8, padding: "8px 13px", fontSize: 13, fontWeight: 650, cursor: busy ? "wait" : "pointer", opacity: busy || !input.trim() ? 0.5 : 1 }}>{busy ? "…" : "Send"}</button>
        </div>
      </form>
    </div>
  );
}
