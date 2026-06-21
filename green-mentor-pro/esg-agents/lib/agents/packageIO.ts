import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

/**
 * Server-side read/write of agent package files for the Agent Studio UI.
 * Writes are guarded: the agent key must resolve inside agents/, only the four
 * known file kinds are editable, and JSON / frontmatter is validated before save.
 */
const AGENTS_ROOT = path.join(process.cwd(), "agents");

export interface AgentMeta {
  key: string;
  name: string;
  phase: number;
  family: string;
  model: string;
  hitl_gate: string | null;
  depth?: string;
  version: string;
  enabled?: boolean;
}

export interface PackageFiles {
  key: string;
  skill: string;
  ioSchema: string;
  tools: string;
  templates: { name: string; content: string }[];
}

export function listAgents(): AgentMeta[] {
  const reg = JSON.parse(fs.readFileSync(path.join(AGENTS_ROOT, "registry.json"), "utf8"));
  return (reg.agents as AgentMeta[]).slice().sort((a, b) => a.phase - b.phase || a.key.localeCompare(b.key));
}

/** Resolve + validate that `key` is a real agent folder inside AGENTS_ROOT. */
function agentDir(key: string): string {
  const resolved = path.resolve(AGENTS_ROOT, key);
  if (resolved !== path.join(AGENTS_ROOT, key) || !resolved.startsWith(path.resolve(AGENTS_ROOT) + path.sep)) {
    throw new Error("invalid agent key");
  }
  if (!fs.existsSync(path.join(resolved, "skill.md"))) throw new Error(`unknown agent: ${key}`);
  return resolved;
}

export function readPackage(key: string): PackageFiles {
  const dir = agentDir(key);
  const read = (f: string) => (fs.existsSync(path.join(dir, f)) ? fs.readFileSync(path.join(dir, f), "utf8") : "");
  const tplDir = path.join(dir, "templates");
  const templates = fs.existsSync(tplDir)
    ? fs
        .readdirSync(tplDir)
        .filter((n) => !n.startsWith("."))
        .map((name) => ({ name, content: fs.readFileSync(path.join(tplDir, name), "utf8") }))
    : [];
  return { key, skill: read("skill.md"), ioSchema: read("io.schema.json"), tools: read("tools.json"), templates };
}

/** Write one editable file back to disk, validating content first. Returns the saved path. */
export function writePackageFile(key: string, file: string, content: string): { ok: true; file: string } {
  const dir = agentDir(key);

  let target: string;
  if (file === "skill.md" || file === "io.schema.json" || file === "tools.json") {
    target = path.join(dir, file);
  } else if (file.startsWith("templates/")) {
    const name = file.slice("templates/".length);
    if (!name || name.includes("/") || name.includes("..")) throw new Error("invalid template path");
    target = path.join(dir, "templates", name);
    if (!fs.existsSync(target)) throw new Error(`unknown template file: ${name}`);
  } else {
    throw new Error(`file not editable: ${file}`);
  }

  // Validate before writing so a bad save can't break the loader.
  if (file.endsWith(".json")) {
    try {
      JSON.parse(content);
    } catch (e) {
      throw new Error(`invalid JSON: ${e instanceof Error ? e.message : "parse error"}`);
    }
  }
  if (file === "skill.md") {
    let fm;
    try {
      fm = matter(content);
    } catch (e) {
      throw new Error(`invalid frontmatter: ${e instanceof Error ? e.message : "parse error"}`);
    }
    if (!fm.data?.name) throw new Error("frontmatter must include a 'name' field");
    if (!fm.data?.model) throw new Error("frontmatter must include a 'model' field");
  }

  fs.writeFileSync(target, content, "utf8");
  return { ok: true, file };
}
