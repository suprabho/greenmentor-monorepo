import { PHASE_ORDER, PHASES } from "@/lib/orchestrator/pipeline";

/**
 * Engagement dashboard placeholder — the 8-phase pipeline board.
 * M1 replaces this with a live board over esg_engagement_phases + review_queue.
 */
export default function Home() {
  return (
    <main style={{ padding: 32, fontFamily: "ui-sans-serif, system-ui" }}>
      <h1>GreenMentor ESG-Agents</h1>
      <p>8-phase reporting engagement — one agent per phase, human gate after each.</p>
      <ol>
        {PHASE_ORDER.map((key) => {
          const p = PHASES[key];
          return (
            <li key={key}>
              <strong>Phase {p.phaseNo}</strong> — {key} → <code>{p.agentKey}</code>{" "}
              <em>(gate: {p.hitlGate})</em>
            </li>
          );
        })}
      </ol>
    </main>
  );
}
