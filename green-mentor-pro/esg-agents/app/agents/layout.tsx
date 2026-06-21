import Link from "next/link";
import { listAgents } from "@/lib/agents/packageIO";

export const dynamic = "force-dynamic"; // reads the filesystem per request

const ACCENT = "#1f8a5b";

export default function AgentsLayout({ children }: { children: React.ReactNode }) {
  const agents = listAgents();
  return (
    <div style={{ minHeight: "100vh", background: "#f6f8f7", color: "#1a2420", fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 24px 64px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
          <div style={{ width: 10, height: 10, borderRadius: 3, background: ACCENT }} />
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.3, color: ACCENT }}>GREENMENTOR · ESG-AGENTS</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 18 }}>
          <h1 style={{ fontSize: 23, margin: "6px 0 0", fontWeight: 750 }}>Agent Studio</h1>
          <Link href="/" style={{ fontSize: 13, color: ACCENT, fontWeight: 600, textDecoration: "none" }}>← Pipeline board</Link>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "290px 1fr", gap: 20, alignItems: "start" }}>
          {/* left rail */}
          <div style={{ background: "#fff", border: "1px solid #e3e8e5", borderRadius: 14, padding: 8 }}>
            <div style={{ padding: "10px 12px 6px", fontSize: 12, fontWeight: 700, color: "#5d6b64", letterSpacing: 0.4 }}>
              {agents.length} AGENT PACKAGES
            </div>
            {agents.map((a) => (
              <Link key={a.key} href={`/agents/${a.key}`} style={{ textDecoration: "none", color: "inherit" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 9, margin: "2px 2px" }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: a.phase === 0 ? "#eef1f0" : "#e9f2ec", color: a.phase === 0 ? "#5d6b64" : ACCENT, display: "grid", placeItems: "center", fontSize: 11.5, fontWeight: 700, flexShrink: 0 }}>
                    {a.phase === 0 ? "·" : a.phase}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.key}</div>
                    <div style={{ fontSize: 11, color: "#8a958f", fontFamily: "ui-monospace, Menlo, monospace" }}>{a.model.replace("claude-", "")}</div>
                  </div>
                  {a.enabled === false && <span style={{ fontSize: 10, color: "#8a958f" }}>stub</span>}
                </div>
              </Link>
            ))}
          </div>

          {/* detail / editor */}
          <div>{children}</div>
        </div>
      </div>
    </div>
  );
}
