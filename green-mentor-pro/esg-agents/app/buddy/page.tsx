"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";
import DataRequestCard, { type DataRequestData } from "./DataRequestCard";

const ACCENT = "#1f8a5b";
const BORDER = "#e3e8e5";

const SUGGESTIONS = [
  "Explain BRSR Principle 6 in plain terms",
  "What's the difference between Scope 1, 2 and 3 emissions?",
  "What goes into a materiality assessment?",
  "Which GreenMentor agent drafts a supplier data request?",
];

export default function BuddyPage() {
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const send = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    sendMessage({ text: t });
    setInput("");
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f6f8f7", color: "#1a2420", fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 20px 0", display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: ACCENT, color: "#fff", display: "grid", placeItems: "center", fontSize: 18 }}>🌱</div>
            <div>
              <div style={{ fontWeight: 750, fontSize: 17 }}>ESG Buddy</div>
              <div style={{ fontSize: 12, color: "#5d6b64" }}>ESG &amp; BRSR assistant · Claude Sonnet via Vercel AI Gateway</div>
            </div>
          </div>
          <a href="/" style={{ fontSize: 13, color: ACCENT, fontWeight: 600, textDecoration: "none" }}>← Pipeline</a>
        </div>

        {/* messages */}
        <div style={{ flex: 1, overflowY: "auto", paddingBottom: 8 }}>
          {messages.length === 0 ? (
            <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 22, marginTop: 8 }}>
              <div style={{ fontWeight: 650, fontSize: 15, marginBottom: 4 }}>Ask me anything about ESG reporting</div>
              <div style={{ fontSize: 13.5, color: "#5d6b64", marginBottom: 16, lineHeight: 1.5 }}>
                I explain frameworks (BRSR, GRI, ISSB, ESRS, TCFD), emissions accounting, and the GreenMentor agent pipeline.
                I won&apos;t invent numbers — for exact factors I point you to the Calculation agent.
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} style={chip}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 8 }}>
              {messages.map((m) => {
                const isUser = m.role === "user";
                return (
                  <div key={m.id} style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: isUser ? "flex-end" : "flex-start" }}>
                    {(m.parts as { type: string; text?: string; state?: string; input?: unknown; output?: unknown; errorText?: string }[]).map((part, i) => {
                      if (part.type === "text") {
                        if (!part.text) return null;
                        return (
                          <div key={i} style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", width: "100%" }}>
                            <div
                              style={{
                                maxWidth: "82%", whiteSpace: "pre-wrap", lineHeight: 1.55, fontSize: 14.5,
                                padding: "11px 14px", borderRadius: 14,
                                background: isUser ? ACCENT : "#fff",
                                color: isUser ? "#fff" : "#1a2420",
                                border: isUser ? "none" : `1px solid ${BORDER}`,
                                borderBottomRightRadius: isUser ? 4 : 14,
                                borderBottomLeftRadius: isUser ? 14 : 4,
                              }}
                            >
                              {part.text}
                            </div>
                          </div>
                        );
                      }
                      // Generative UI: render the draftDataRequest tool as a card.
                      if (part.type === "tool-draftDataRequest") {
                        switch (part.state) {
                          case "input-streaming":
                          case "input-available":
                            return <DataRequestCard key={i} data={(part.input as DataRequestData) ?? {}} loading />;
                          case "output-available":
                            return <DataRequestCard key={i} data={part.output as DataRequestData} />;
                          case "output-error":
                            return <div key={i} style={{ fontSize: 13, color: "#c2410c" }}>Couldn&apos;t draft the request: {part.errorText}</div>;
                          default:
                            return null;
                        }
                      }
                      return null;
                    })}
                  </div>
                );
              })}
              {status === "submitted" && (
                <div style={{ fontSize: 13, color: "#8a958f", paddingLeft: 4 }}>ESG Buddy is thinking…</div>
              )}
            </div>
          )}

          {error && (
            <div style={{ fontSize: 13, fontWeight: 600, color: "#c2410c", background: "#fde8de", padding: "10px 12px", borderRadius: 10, marginTop: 12 }}>
              {error.message || "Something went wrong."}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* composer */}
        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          style={{ position: "sticky", bottom: 0, background: "#f6f8f7", paddingBottom: 16, paddingTop: 8 }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 8 }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
              }}
              placeholder="Ask about BRSR, Scope 3, materiality…"
              rows={1}
              style={{ flex: 1, resize: "none", border: "none", outline: "none", fontSize: 14.5, fontFamily: "inherit", padding: "8px 8px", maxHeight: 140, background: "transparent", color: "#1a2420" }}
            />
            <button type="submit" disabled={busy || !input.trim()} style={{ ...sendBtn, opacity: busy || !input.trim() ? 0.45 : 1, cursor: busy || !input.trim() ? "not-allowed" : "pointer" }}>
              {busy ? "…" : "Send"}
            </button>
          </div>
          <div style={{ fontSize: 11, color: "#9aa6a0", textAlign: "center", marginTop: 7 }}>
            Routed through the Vercel AI Gateway · ESG Buddy can be wrong — verify figures with the Calculation agent.
          </div>
        </form>
      </div>
    </div>
  );
}

const chip: React.CSSProperties = {
  background: "#f0f6f3", color: "#1a2420", border: `1px solid ${ACCENT}33`, borderRadius: 10,
  padding: "8px 12px", fontSize: 13, fontWeight: 550, cursor: "pointer", textAlign: "left",
};
const sendBtn: React.CSSProperties = {
  background: ACCENT, color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", fontSize: 14, fontWeight: 650,
};
