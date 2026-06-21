export default function AgentsIndex() {
  return (
    <div style={{ background: "#fff", border: "1px solid #e3e8e5", borderRadius: 14, padding: 40, textAlign: "center", color: "#5d6b64" }}>
      <div style={{ fontSize: 15, fontWeight: 650, color: "#1a2420", marginBottom: 6 }}>Select an agent to view & edit</div>
      <div style={{ fontSize: 13.5, maxWidth: 460, margin: "0 auto", lineHeight: 1.5 }}>
        Each agent is controlled by four plain files — its <strong>prompt &amp; config</strong> (skill.md), its{" "}
        <strong>I/O contract</strong> (io.schema.json), its <strong>tools</strong>, and its <strong>templates</strong>.
        Pick one on the left to edit them; changes save straight to disk and the runtime re-reads them on the next run.
      </div>
    </div>
  );
}
