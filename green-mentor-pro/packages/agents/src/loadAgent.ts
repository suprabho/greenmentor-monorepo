import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { LoadedAgent, AgentFrontmatter, IoSchema } from "./types";
import type Anthropic from "@anthropic-ai/sdk";

const AGENTS_ROOT = path.join(process.cwd(), "agents");

/**
 * A package's four file kinds as raw text, before any parsing — the unit that both
 * the filesystem and a database-backed store can produce, so `compileAgent` doesn't
 * care where the bytes came from. Template values are raw too; compileAgent parses
 * the .json ones.
 */
export interface RawPackage {
  skill: string;
  ioSchema: string;
  tools: string;
  templates: Record<string, string>; // basename -> raw content
}

export function resolvePackageDir(packageDirOrKey: string): string {
  return path.isAbsolute(packageDirOrKey)
    ? packageDirOrKey
    : fs.existsSync(packageDirOrKey)
      ? packageDirOrKey
      : path.join(AGENTS_ROOT, packageDirOrKey);
}

/** Read a package folder off disk as raw text. */
export function readRawPackage(packageDirOrKey: string): RawPackage {
  const dir = resolvePackageDir(packageDirOrKey);
  const templates: Record<string, string> = {};
  const tplDir = path.join(dir, "templates");
  if (fs.existsSync(tplDir)) {
    for (const f of fs.readdirSync(tplDir)) {
      if (f.startsWith(".")) continue;
      templates[f] = fs.readFileSync(path.join(tplDir, f), "utf8");
    }
  }
  return {
    skill: fs.readFileSync(path.join(dir, "skill.md"), "utf8"),
    ioSchema: fs.readFileSync(path.join(dir, "io.schema.json"), "utf8"),
    tools: fs.readFileSync(path.join(dir, "tools.json"), "utf8"),
    templates,
  };
}

/**
 * Lay stored edits over the on-disk package. Keys are the same file ids the Agent
 * Studio edits: "skill.md", "io.schema.json", "tools.json", "templates/<name>".
 * Unknown keys are ignored; the bundled files stay the base layer, so an empty or
 * unreachable store degrades to exactly today's behaviour.
 */
export function applyPackageOverrides(raw: RawPackage, overrides: Record<string, string>): RawPackage {
  const out: RawPackage = { ...raw, templates: { ...raw.templates } };
  for (const [file, content] of Object.entries(overrides)) {
    if (file === "skill.md") out.skill = content;
    else if (file === "io.schema.json") out.ioSchema = content;
    else if (file === "tools.json") out.tools = content;
    else if (file.startsWith("templates/")) out.templates[file.slice("templates/".length)] = content;
  }
  return out;
}

/**
 * Compile raw package text into a typed, runtime-ready LoadedAgent.
 * The markdown body of skill.md IS the system prompt (mirrors the community-engine
 * header/draft route's `system`). io.schema.json holds { $defs: { input, output } }.
 */
export function compileAgent(raw: RawPackage): LoadedAgent {
  const { data, content } = matter(raw.skill);
  const fm = data as AgentFrontmatter;

  const io = JSON.parse(raw.ioSchema) as IoSchema;
  // Schemas use sibling $defs (e.g. #/$defs/DataRequest, #/$defs/DatasetRow). We
  // hand Ajv (and the emit tool) only the input/output subschema, so re-attach the
  // full $defs map to each so those internal $ref pointers still resolve.
  const inputSchema = { ...io.$defs.input, $defs: io.$defs };
  const outputSchema = { ...io.$defs.output, $defs: io.$defs };

  // Callable tools the agent may invoke mid-run (NOT the final emit tool).
  const allTools = JSON.parse(raw.tools) as Anthropic.Messages.Tool[];
  const allowed = new Set(fm.tools ?? []);
  const emitToolName = fm.emit_tool ?? `emit_${fm.name.replace(/-/g, "_")}`;

  // Frontmatter `tools[]` must be a subset of tools.json — fail loud on drift.
  const missing = [...allowed].filter((n) => !allTools.some((t) => t.name === n));
  if (missing.length) {
    throw new Error(`${fm.name}: tools.json missing declared tools: ${missing.join(", ")}`);
  }

  // Callable tools exclude the emit tool — runAgent defines the emit tool inline from
  // the output schema, so including it here would send a duplicate tool to the API.
  const tools = allTools
    .filter((t) => allowed.has(t.name) && t.name !== emitToolName)
    .map((t) => ({ ...t, strict: true as const })) as Anthropic.Messages.Tool[];

  // Server-side tools (frontmatter `server_tools`, not tools.json): executed on
  // Anthropic's infra within a single API turn, so they take no strict flag and
  // no runCallableTool dispatch. Haiku 4.5 predates the dynamic-filtering web
  // search variant, so it gets the basic one.
  const serverTools: Record<string, unknown>[] = [];
  if (fm.server_tools?.web_search) {
    const ws = fm.server_tools.web_search;
    serverTools.push({
      type: fm.model === "claude-haiku-4-5" ? "web_search_20250305" : "web_search_20260209",
      name: "web_search",
      max_uses: ws.max_uses ?? 8,
      ...(ws.allowed_domains?.length ? { allowed_domains: ws.allowed_domains } : {}),
      ...(ws.blocked_domains?.length ? { blocked_domains: ws.blocked_domains } : {}),
    });
  }

  // Templates: *.md -> string, *.json -> parsed object, keyed by basename.
  const templates: Record<string, unknown> = {};
  for (const [name, body] of Object.entries(raw.templates)) {
    templates[name] = name.endsWith(".json") ? JSON.parse(body) : body;
  }

  const promptVariant = fm.prompt_variant ?? "control";

  return {
    key: promptVariant !== "control" ? `${fm.name}@${promptVariant}` : fm.name,
    name: fm.name,
    system: content.trim(),
    model: fm.model,
    phase: fm.phase,
    family: fm.family,
    tools,
    serverTools,
    emitToolName: fm.emit_tool ?? `emit_${fm.name.replace(/-/g, "_")}`,
    inputSchema,
    outputSchema,
    templates,
    hitlGate: fm.hitl_gate,
    version: fm.version,
    promptVariant,
    enabled: fm.enabled ?? true,
    maxTokens: fm.max_tokens ?? 4096,
    maxTurns: fm.max_turns ?? 8,
    temperature: fm.temperature ?? 0,
  };
}

/**
 * Read an agent package folder off disk into a runtime-ready LoadedAgent.
 * Disk only — consumers that also honour stored overrides read the raw package,
 * apply them, and call `compileAgent` (see esg-agents' loadAgentWithOverrides).
 */
export function loadAgent(packageDirOrKey: string): LoadedAgent {
  return compileAgent(readRawPackage(packageDirOrKey));
}

/** Load every package listed in agents/registry.json, keyed by `key`. */
export function loadAllAgents(agentsRoot: string = AGENTS_ROOT): Record<string, LoadedAgent> {
  const reg = JSON.parse(
    fs.readFileSync(path.join(agentsRoot, "registry.json"), "utf8"),
  ) as { agents: { key: string; path: string }[] };
  return Object.fromEntries(
    reg.agents.map((a) => [a.key, loadAgent(path.join(agentsRoot, path.basename(a.path)))]),
  );
}
