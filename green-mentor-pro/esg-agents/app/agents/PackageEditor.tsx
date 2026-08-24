"use client";

import { useMemo, useState } from "react";
import { AGENT_MODEL_CHOICES } from "@gm/agents/models";
import type { AgentMeta, PackageFiles } from "@/lib/agents/packageIO";
import { readFrontmatterModel, setFrontmatterModel } from "@/lib/agents/frontmatterModel";
import TestRunPanel from "./TestRunPanel";

const ACCENT = "#1f8a5b";
const BORDER = "#e3e8e5";

type TabId = "skill" | "io" | "tools" | "templates" | "test";

const TABS: { id: TabId; label: string; file?: string; hint: string }[] = [
  { id: "skill", label: "Prompt & config", file: "skill.md", hint: "Frontmatter (model, phase, gate) + the markdown body that IS the system prompt." },
  { id: "io", label: "I/O schema", file: "io.schema.json", hint: "$defs.input / $defs.output — Claude is forced to match the output shape." },
  { id: "tools", label: "Tools", file: "tools.json", hint: "Anthropic tool definitions the agent may call mid-run." },
  { id: "templates", label: "Templates", hint: "Reusable message / report / form scaffolds the agent fills." },
  { id: "test", label: "Test run", hint: "Run this package against the live runtime — grounding tools included. Saved edits apply on the next run." },
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
    : tab === "test" ? ""
    : pkg.templates.length ? `templates/${pkg.templates[tplIdx].name}` : "";

  const content = edits[fileId] ?? "";
  const dirty = fileId !== "" && edits[fileId] !== saved[fileId];
  const activeTab = TABS.find((t) => t.id === tab)!;

  // The model comes from skill.md, not from meta — registry.json is a projection that
  // lags an unsaved edit. Reading the *edited* buffer also means typing a new model
  // straight into the Prompt & config textarea moves the dropdown, and vice versa.
  const model = readFrontmatterModel(edits["skill.md"]) ?? meta.model;
  // The test bench runs whatever is on disk, so it defaults to the saved model.
  const savedModel = readFrontmatterModel(saved["skill.md"]) ?? meta.model;
  const modelNote = AGENT_MODEL_CHOICES.find((c) => c.id === model)?.note;
  const skillDirty = edits["skill.md"] !== saved["skill.md"];

  // Rewrite the frontmatter in the buffer rather than saving straight through: the
  // dropdown and the Prompt & config textarea edit the same file, so writing here
  // would clobber unsaved prompt edits. This marks the tab dirty and the change goes
  // out via the existing "Save to disk" button.
  const pickModel = (next: string) => {
    setEdits((prev) => ({ ...prev, "skill.md": setFrontmatterModel(prev["skill.md"], next) }));
    setStatus(null);
  };

  const saveFile = async (id: string) => {
    const body = edits[id];
    if (!id || body === saved[id]) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/agents/${meta.key}/package`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: id, content: body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setSaved((s) => ({ ...s, [id]: body }));
      setStatus({ ok: true, msg: `Saved ${id} ✓ — the runtime re-reads it on the next run.` });
    } catch (e) {
      setStatus({ ok: false, msg: e instanceof Error ? e.message : "save failed" });
    } finally {
      setBusy(false);
    }
  };
  const save = () => saveFile(fileId);

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
          <select
            value={model}
            onChange={(e) => pickModel(e.target.value)}
            title={modelNote ?? "Model this agent runs on — saved into skill.md frontmatter."}
            aria-label="Model"
            style={{
              background: "#e9f2ec", color: ACCENT, fontSize: 11.5, fontWeight: 700,
              padding: "3px 6px 3px 9px", borderRadius: 6, border: `1px solid ${ACCENT}33`, cursor: "pointer",
            }}
          >
            {/* A hand-edited model outside the known set still needs to show up. */}
            {!AGENT_MODEL_CHOICES.some((c) => c.id === model) && (
              <option value={model}>{model.replace("claude-", "")} ⚠</option>
            )}
            {AGENT_MODEL_CHOICES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
                {c.note ? " ⚠" : ""}
              </option>
            ))}
          </select>
          {meta.hitl_gate && badge(`gate: ${meta.hitl_gate}`, "#fbf2dc", "#b8860b")}
          {meta.enabled === false && badge("stub", "#eef1f0", "#8a958f")}
        </div>
      </div>

      {/* The dropdown edits skill.md, whose Save button lives on another tab — so the
          model change gets its own, reachable from wherever the user changed it. */}
      {(skillDirty || modelNote) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
          {modelNote && <span style={{ fontSize: 11.5, color: "#b8860b" }}>⚠ {modelNote}</span>}
          {skillDirty && (
            <>
              <span style={{ fontSize: 11.5, color: "#b8860b", fontWeight: 600 }}>● skill.md unsaved</span>
              <button
                onClick={() => saveFile("skill.md")}
                disabled={busy}
                style={{
                  background: ACCENT, color: "#fff", border: "none", borderRadius: 7, padding: "4px 11px",
                  fontSize: 12, fontWeight: 650, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.45 : 1,
                }}
              >
                {busy ? "Saving…" : "Save to disk"}
              </button>
            </>
          )}
        </div>
      )}

      {/* tabs */}
      <div style={{ display: "flex", gap: 4, margin: "16px 0 4px", borderBottom: `1px solid ${BORDER}` }}>
        {TABS.map((t) => {
          const tDirty = t.id === "test" ? false
            : t.id === "templates"
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

      {/* test bench */}
      {tab === "test" && <TestRunPanel agentKey={meta.key} defaultModel={savedModel} />}

      {/* editor */}
      {tab !== "test" && (fileId ? (
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
      ))}

      {/* footer — file editing only; the test bench owns its own actions */}
      {tab !== "test" && (
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
      )}
    </div>
  );
}
