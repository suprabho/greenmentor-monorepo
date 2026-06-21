"use client";

import { useMemo, useState } from "react";
import type { AgentMeta, PackageFiles } from "@/lib/agents/packageIO";

const ACCENT = "#1f8a5b";
const BORDER = "#e3e8e5";

type TabId = "skill" | "io" | "tools" | "templates";

const TABS: { id: TabId; label: string; file?: string; hint: string }[] = [
  { id: "skill", label: "Prompt & config", file: "skill.md", hint: "Frontmatter (model, phase, gate) + the markdown body that IS the system prompt." },
  { id: "io", label: "I/O schema", file: "io.schema.json", hint: "$defs.input / $defs.output — Claude is forced to match the output shape." },
  { id: "tools", label: "Tools", file: "tools.json", hint: "Anthropic tool definitions the agent may call mid-run." },
  { id: "templates", label: "Templates", hint: "Reusable message / report / form scaffolds the agent fills." },
];

export default function PackageEditor({ meta, pkg }: { meta: AgentMeta; pkg: PackageFiles }) {
  const initial = useMemo(() => {
    const m: Record<string, string> = {
      "skill.md": pkg.skill,
      "io.schema.json": pkg.ioSchema,
      "tools.json": pkg.tools,
    };
    pkg.templates.forEach((t) => (m[`templates/${t.name}`] = t.content));
    return m;
  }, [pkg]);

  const [saved, setSaved] = useState<Record<string, string>>(initial);
  const [edits, setEdits] = useState<Record<string, string>>(initial);
  const [tab, setTab] = useState<TabId>("skill");
  const [tplIdx, setTplIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const fileId =
    tab === "skill" ? "skill.md"
    : tab === "io" ? "io.schema.json"
    : tab === "tools" ? "tools.json"
    : pkg.templates.length ? `templates/${pkg.templates[tplIdx].name}` : "";

  const content = edits[fileId] ?? "";
  const dirty = fileId !== "" && edits[fileId] !== saved[fileId];
  const activeTab = TABS.find((t) => t.id === tab)!;

  const save = async () => {
    if (!dirty || !fileId) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/agents/${meta.key}/package`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: fileId, content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setSaved((s) => ({ ...s, [fileId]: content }));
      setStatus({ ok: true, msg: `Saved ${fileId} ✓ — the runtime re-reads it on the next run.` });
    } catch (e) {
      setStatus({ ok: false, msg: e instanceof Error ? e.message : "save failed" });
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setEdits((e) => ({ ...e, [fileId]: saved[fileId] }));
    setStatus(null);
  };

  const badge = (text: string, bg: string, fg: string) => (
    <span style={{ background: bg, color: fg, fontSize: 11.5, fontWeight: 700, padding: "3px 9px", borderRadius: 6 }}>{text}</span>
  );

  return (
    <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 18 }}>
      {/* header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 750 }}>{meta.name}</div>
          <div style={{ fontSize: 12.5, color: "#5d6b64", fontFamily: "ui-monospace, Menlo, monospace" }}>agents/{meta.key}/</div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {meta.phase > 0 && badge(`phase ${meta.phase}`, "#eef1f0", "#5d6b64")}
          {badge(meta.model.replace("claude-", ""), "#e9f2ec", ACCENT)}
          {meta.hitl_gate && badge(`gate: ${meta.hitl_gate}`, "#fbf2dc", "#b8860b")}
          {meta.enabled === false && badge("stub", "#eef1f0", "#8a958f")}
        </div>
      </div>

      {/* tabs */}
      <div style={{ display: "flex", gap: 4, margin: "16px 0 4px", borderBottom: `1px solid ${BORDER}` }}>
        {TABS.map((t) => {
          const tDirty = t.id === "templates"
            ? pkg.templates.some((tp) => edits[`templates/${tp.name}`] !== saved[`templates/${tp.name}`])
            : edits[t.file!] !== saved[t.file!];
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setStatus(null); }}
              style={{
                background: "none", border: "none", cursor: "pointer", padding: "8px 12px",
                fontSize: 13.5, fontWeight: active ? 700 : 600,
                color: active ? "#1a2420" : "#5d6b64",
                borderBottom: active ? `2px solid ${ACCENT}` : "2px solid transparent",
                marginBottom: -1,
              }}
            >
              {t.label}
              {t.id === "templates" && ` (${pkg.templates.length})`}
              {tDirty && <span style={{ color: "#b8860b", marginLeft: 4 }}>•</span>}
            </button>
          );
        })}
      </div>

      <div style={{ fontSize: 12.5, color: "#5d6b64", margin: "10px 2px" }}>{activeTab.hint}</div>

      {/* template picker */}
      {tab === "templates" && pkg.templates.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {pkg.templates.map((t, i) => (
            <button
              key={t.name}
              onClick={() => setTplIdx(i)}
              style={{
                fontSize: 12, fontFamily: "ui-monospace, Menlo, monospace",
                background: i === tplIdx ? "#e9f2ec" : "#fff", color: i === tplIdx ? ACCENT : "#5d6b64",
                border: `1px solid ${i === tplIdx ? ACCENT + "66" : BORDER}`, borderRadius: 6, padding: "4px 9px", cursor: "pointer",
              }}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}

      {/* editor */}
      {fileId ? (
        <textarea
          value={content}
          onChange={(e) => setEdits((prev) => ({ ...prev, [fileId]: e.target.value }))}
          spellCheck={false}
          style={{
            width: "100%", height: 480, boxSizing: "border-box", resize: "vertical",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12.5, lineHeight: 1.55,
            color: "#1a2420", background: "#fbfcfb", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 14,
            whiteSpace: "pre", overflow: "auto",
          }}
        />
      ) : (
        <div style={{ padding: 24, color: "#8a958f", fontSize: 13 }}>This agent has no templates.</div>
      )}

      {/* footer */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
        <button
          onClick={save}
          disabled={!dirty || busy}
          style={{
            background: ACCENT, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px",
            fontSize: 13.5, fontWeight: 650, cursor: dirty && !busy ? "pointer" : "not-allowed", opacity: dirty && !busy ? 1 : 0.45,
          }}
        >
          {busy ? "Saving…" : "Save to disk"}
        </button>
        <button
          onClick={reset}
          disabled={!dirty || busy}
          style={{ background: "#fff", color: "#5d6b64", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: dirty ? "pointer" : "not-allowed", opacity: dirty ? 1 : 0.5 }}
        >
          Reset
        </button>
        {dirty && <span style={{ fontSize: 12.5, color: "#b8860b", fontWeight: 600 }}>● unsaved changes</span>}
        {status && (
          <span style={{ fontSize: 12.5, fontWeight: 600, color: status.ok ? ACCENT : "#c2410c" }}>{status.msg}</span>
        )}
      </div>
    </div>
  );
}
