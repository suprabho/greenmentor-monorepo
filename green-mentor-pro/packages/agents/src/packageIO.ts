import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { isAgentModel } from "./anthropic/models";

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
  /**
   * skill.md's parsed frontmatter. The Studio header reads `model` from here rather
   * than from the AgentMeta row, because registry.json is a projection that can lag
   * an unsaved (or just-saved) edit — the file on disk is the source of truth.
   */
  frontmatter: Record<string, unknown>;
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
  const skill = read("skill.md");
  return {
    key,
    skill,
    ioSchema: read("io.schema.json"),
    tools: read("tools.json"),
    templates,
    frontmatter: (matter(skill).data ?? {}) as Record<string, unknown>,
  };
}

/**
 * Patch the `model` of one agent's row in registry.json after its skill.md is saved,
 * so the Studio's header badge and left rail reflect a model change without a manual
 * `pnpm registry:build`.
 *
 * Deliberately narrow, on two axes:
 *
 *  - Only `model` is synced. registry.json carries hand-authored fields no projection
 *    reproduces (`name` is a display name like "Peer Material Topics Skill", not the
 *    frontmatter slug; `depth` exists nowhere else), so rewriting the row from
 *    frontmatter would destroy them. Other fields stay exactly as stale-or-not as
 *    they are today.
 *  - The edit is textual, not a JSON round-trip, because the file is hand-formatted
 *    one row per line with aligned columns — re-serializing it would reflow all 12
 *    rows on every save. If the row isn't on a single line (someone reformatted the
 *    file), we leave it alone rather than mangle it.
 */
function syncRegistryModel(dirName: string, model: string): void {
  const registryPath = path.join(AGENTS_ROOT, "registry.json");
  if (!fs.existsSync(registryPath)) return;
  const lines = fs.readFileSync(registryPath, "utf8").split("\n");

  const i = lines.findIndex((l) => l.includes(`"path": "agents/${dirName}"`));
  if (i < 0) return;

  // Keep the column alignment: absorb the length change into the run of spaces that
  // follows the value, so shorter ids don't pull the rest of the row leftwards.
  const patched = lines[i].replace(
    /("model"\s*:\s*")([^"]*)(",)( *)/,
    (_m, open: string, old: string, close: string, pad: string) => {
      const slack = Math.max(1, pad.length + old.length - model.length);
      return `${open}${model}${close}${" ".repeat(slack)}`;
    },
  );
  if (patched === lines[i]) return; // no model field on that row, or already current

  lines[i] = patched;
  fs.writeFileSync(registryPath, lines.join("\n"), "utf8");
}

/** The four file kinds the Agent Studio may edit. */
export function isEditablePackageFile(file: string): boolean {
  if (file === "skill.md" || file === "io.schema.json" || file === "tools.json") return true;
  if (!file.startsWith("templates/")) return false;
  const name = file.slice("templates/".length);
  return Boolean(name) && !name.includes("/") && !name.includes("..");
}

/**
 * Validate an edited package file before it is stored, so a bad save can't break the
 * loader. Storage-agnostic on purpose — the filesystem writer below and the
 * database-backed store in esg-agents both gate on this. Returns the parsed skill.md
 * frontmatter (null for the other file kinds) so callers can project from it.
 */
export function validatePackageFile(file: string, content: string): Record<string, any> | null {
  if (!isEditablePackageFile(file)) throw new Error(`file not editable: ${file}`);

  if (file.endsWith(".json")) {
    try {
      JSON.parse(content);
    } catch (e) {
      throw new Error(`invalid JSON: ${e instanceof Error ? e.message : "parse error"}`);
    }
  }
  if (file !== "skill.md") return null;

  let fm;
  try {
    fm = matter(content);
  } catch (e) {
    throw new Error(`invalid frontmatter: ${e instanceof Error ? e.message : "parse error"}`);
  }
  if (!fm.data?.name) throw new Error("frontmatter must include a 'name' field");
  if (!fm.data?.model) throw new Error("frontmatter must include a 'model' field");
  // Catch a bad model at save time — otherwise the package stores fine and the
  // first run fails with a 404 from the Anthropic API.
  if (!isAgentModel(fm.data.model)) {
    throw new Error(`unknown model '${fm.data.model}' — not one of the supported Claude models`);
  }
  return fm.data;
}

/** Write one editable file back to disk, validating content first. Returns the saved path. */
export function writePackageFile(key: string, file: string, content: string): { ok: true; file: string } {
  const dir = agentDir(key);
  const skillFm = validatePackageFile(file, content);

  let target: string;
  if (file.startsWith("templates/")) {
    const name = file.slice("templates/".length);
    target = path.join(dir, "templates", name);
    if (!fs.existsSync(target)) throw new Error(`unknown template file: ${name}`);
  } else {
    target = path.join(dir, file);
  }

  fs.writeFileSync(target, content, "utf8");
  if (skillFm) syncRegistryModel(path.basename(dir), String(skillFm.model));
  return { ok: true, file };
}
