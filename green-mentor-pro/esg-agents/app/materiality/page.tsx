import Link from "next/link";
import MaterialityWizard from "./MaterialityWizard";

export const metadata = { title: "Materiality Long List — GreenMentor" };

const ACCENT = "#1f8a5b";

/**
 * The Materiality Long List orchestrator page — chains nic-framework-materiality
 * and peer-research (parallel), a human peer-selection gate,
 * peer-material-topics-extraction and the materiality-long-list distiller.
 * All state is client-side; the wizard itself lives in MaterialityWizard.tsx.
 */
export default function MaterialityPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#f6f8f7", color: "#1a2420", fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto" }}>
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "24px 24px 64px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
          <div style={{ width: 10, height: 10, borderRadius: 3, background: ACCENT }} />
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.3, color: ACCENT }}>GREENMENTOR · ESG-AGENTS</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
          <h1 style={{ fontSize: 23, margin: "6px 0 0", fontWeight: 750 }}>Materiality Long List</h1>
          <div style={{ display: "flex", gap: 14 }}>
            <Link href="/agents" style={{ fontSize: 13, color: ACCENT, fontWeight: 600, textDecoration: "none" }}>Agent Studio →</Link>
            <Link href="/" style={{ fontSize: 13, color: ACCENT, fontWeight: 600, textDecoration: "none" }}>← Home</Link>
          </div>
        </div>
        <p style={{ fontSize: 13, color: "#5d6b64", lineHeight: 1.55, margin: "0 0 18px", maxWidth: 720 }}>
          Pick a company, run the framework view (what SASB / Sustainalytics / MSCI prescribe for its industry)
          and peer research in parallel, choose which peers to analyse, extract what those peers disclosed,
          then distill both tables into a 20-25 topic materiality long list. Results live in this tab only —
          a refresh starts over.
        </p>
        <MaterialityWizard />
      </div>
    </div>
  );
}
