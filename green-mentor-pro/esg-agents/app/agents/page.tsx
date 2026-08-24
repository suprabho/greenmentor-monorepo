export default function AgentsIndex() {
  return (
    <div style={{ background: "#fff", border: "1px solid #e3e8e5", borderRadius: 14, padding: 40, textAlign: "center", color: "#5d6b64" }}>
      <div style={{ fontSize: 15, fontWeight: 650, color: "#1a2420", marginBottom: 6 }}>Select an agent to view & edit</div>
      <div style={{ fontSize: 13.5, maxWidth: 460, margin: "0 auto", lineHeight: 1.5 }}>
        Each agent is controlled by four plain files — its <strong>prompt &amp; config</strong> (skill.md), its{" "}
        <strong>I/O contract</strong> (io.schema.json), its <strong>tools</strong>, and its <strong>templates</strong>.
        Pick one on the left to edit them. Saved edits are stored in the database and laid over the
        deployed package, so the runtime picks them up on the next run — here and in the pipeline.
        A file marked <strong>◆</strong> is a stored edit; revert it to fall back to the package in the repo.
      </div>
    </div>
  );
}
