"use client";

import { useState } from "react";
import { createEngagementAction, logoutAction } from "./actions";

const ACCENT = "#1f8a5b";
const BORDER = "#e3e8e5";

export interface HomeEngagement {
  id: string;
  clientName: string;
  financialYear: string;
  framework: string[];
  status: string;
}

export default function EngagementsHome({
  orgName, email, financialYear, engagements,
}: {
  orgName: string; email: string; financialYear: string; engagements: HomeEngagement[];
}) {
  const [showNew, setShowNew] = useState(engagements.length === 0);

  return (
    <div style={{ minHeight: "100vh", background: "#f6f8f7", color: "#1a2420", fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto" }}>
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "32px 24px 64px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: ACCENT }} />
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.3, color: ACCENT }}>GREENMENTOR · ESG-AGENTS</span>
          </div>
          <form action={logoutAction}>
            <button type="submit" style={{ background: "none", border: "none", color: "#5d6b64", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>{email} · Sign out</button>
          </form>
        </div>
        <h1 style={{ fontSize: 26, margin: "8px 0 2px", fontWeight: 750 }}>{orgName}</h1>
        <div style={{ color: "#5d6b64", fontSize: 14, marginBottom: 22 }}>BRSR & ESG reporting engagements</div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#5d6b64" }}>{engagements.length} engagement{engagements.length === 1 ? "" : "s"}</div>
          <button onClick={() => setShowNew((v) => !v)} style={{ background: ACCENT, color: "#fff", border: "none", borderRadius: 9, padding: "8px 14px", fontSize: 13.5, fontWeight: 650, cursor: "pointer" }}>+ New engagement</button>
        </div>

        {showNew && (
          <form action={createEngagementAction} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 18, marginBottom: 18 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Client / entity name"><input name="client_name" defaultValue={orgName} style={inp} required /></Field>
              <Field label="Reporting year"><input name="financial_year" defaultValue={financialYear} style={inp} required /></Field>
            </div>
            <Field label="Frameworks (comma-separated)"><input name="frameworks" defaultValue="BRSR, GRI" style={inp} /></Field>
            <button type="submit" style={{ marginTop: 12, background: ACCENT, color: "#fff", border: "none", borderRadius: 9, padding: "10px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Create engagement →</button>
          </form>
        )}

        <div style={{ display: "grid", gap: 10 }}>
          {engagements.map((e) => (
            <a key={e.id} href={`/engagements/${e.id}`} style={{ textDecoration: "none", color: "inherit" }}>
              <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "16px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15.5 }}>{e.clientName}</div>
                  <div style={{ fontSize: 12.5, color: "#5d6b64", marginTop: 2 }}>{e.financialYear} · {e.framework.join(", ")}</div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#5d6b64", background: "#f0f6f3", padding: "4px 10px", borderRadius: 999 }}>{e.status}</span>
              </div>
            </a>
          ))}
          {engagements.length === 0 && !showNew && (
            <div style={{ color: "#9aa6a0", fontSize: 13.5, padding: "20px 0" }}>No engagements yet — create one to start a BRSR report.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block", marginTop: 8 }}>
      <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#5d6b64", marginBottom: 5 }}>{label}</span>
      {children}
    </label>
  );
}

const inp: React.CSSProperties = { width: "100%", boxSizing: "border-box", border: `1px solid ${BORDER}`, borderRadius: 9, padding: "9px 11px", fontSize: 14, outline: "none", background: "#fff", color: "#1a2420" };
