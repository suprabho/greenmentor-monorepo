"use client";

const ACCENT = "#1f8a5b";

export default function ReportToolbar({ engagementId, empty }: { engagementId: string; empty: boolean }) {
  return (
    <div className="no-print" style={{ position: "sticky", top: 0, zIndex: 10, background: "#fff", borderBottom: "1px solid #e3e8e5", padding: "12px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <a href={`/engagements/${engagementId}`} style={{ fontSize: 13, color: ACCENT, fontWeight: 600, textDecoration: "none" }}>← Back to board</a>
      {!empty && (
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => window.print()} style={{ background: "#fff", color: "#5d6b64", border: "1px solid #e3e8e5", borderRadius: 8, padding: "7px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Print</button>
          <a href={`/api/report/${engagementId}/pdf`} style={{ background: ACCENT, color: "#fff", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 650, textDecoration: "none" }}>Download PDF</a>
        </div>
      )}
    </div>
  );
}
