/**
 * Regenerate agents/registry.json from each package's skill.md frontmatter.
 *
 *   tsx scripts/build-registry.ts
 */
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const AGENTS_ROOT = path.join(process.cwd(), "agents");

const dirs = fs
  .readdirSync(AGENTS_ROOT, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
  .map((d) => d.name)
  .sort();

const agents = dirs.map((dir) => {
  const { data: fm } = matter(fs.readFileSync(path.join(AGENTS_ROOT, dir, "skill.md"), "utf8"));
  return {
    key: fm.name,
    name: fm.name,
    phase: fm.phase,
    family: fm.family,
    model: fm.model,
    path: `agents/${dir}`,
    emit_tool: fm.emit_tool ?? `emit_${String(fm.name).replace(/-/g, "_")}`,
    hitl_gate: fm.hitl_gate?.gate ?? null,
    version: fm.version,
    ...(fm.enabled === false ? { enabled: false } : {}),
  };
});

const out = { version: "1.0.0", generatedAt: "REGENERATED", agents };
fs.writeFileSync(path.join(AGENTS_ROOT, "registry.json"), JSON.stringify(out, null, 2) + "\n");
console.log(`✅ wrote registry.json (${agents.length} agents)`);
