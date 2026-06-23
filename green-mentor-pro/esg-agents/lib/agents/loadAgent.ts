import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { LoadedAgent, AgentFrontmatter, IoSchema } from "./types";
import type Anthropic from "@anthropic-ai/sdk";

const AGENTS_ROOT = path.join(process.cwd(), "agents");

const readJson = <T,>(p: string): T => JSON.parse(fs.readFileSync(p, "utf8")) as T;

/**
 * Read an agent package folder into a typed, runtime-ready LoadedAgent.
 * The markdown body of skill.md IS the system prompt (mirrors the community-engine
 * header/draft route's `system`). io.schema.json holds { $defs: { input, output } }.
 */
export function loadAgent(packageDirOrKey: string): LoadedAgent {
  const packageDir = path.isAbsolute(packageDirOrKey)
    ? packageDirOrKey
    : fs.existsSync(packageDirOrKey)
      ? packageDirOrKey
      : path.join(AGENTS_ROOT, packageDirOrKey);

  const { data, content } = matter(fs.readFileSync(path.join(packageDir, "skill.md"), "utf8"));
  const fm = data as AgentFrontmatter;

  const io = readJson<IoSchema>(path.join(packageDir, "io.schema.json"));
  // Schemas use sibling $defs (e.g. #/$defs/DataRequest, #/$defs/DatasetRow). We
  // hand Ajv (and the emit tool) only the input/output subschema, so re-attach the
  // full $defs map to each so those internal $ref pointers still resolve.
  const inputSchema = { ...io.$defs.input, $defs: io.$defs };
  const outputSchema = { ...io.$defs.output, $defs: io.$defs };

  // Callable tools the agent may invoke mid-run (NOT the final emit tool).
  const allTools = readJson<Anthropic.Messages.Tool[]>(path.join(packageDir, "tools.json"));
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

  // Templates: *.md -> string, *.json -> parsed object, keyed by basename.
  const templates: Record<string, unknown> = {};
  const tplDir = path.join(packageDir, "templates");
  if (fs.existsSync(tplDir)) {
    for (const f of fs.readdirSync(tplDir)) {
      const p = path.join(tplDir, f);
      templates[f] = f.endsWith(".json") ? readJson(p) : fs.readFileSync(p, "utf8");
    }
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
    emitToolName: fm.emit_tool ?? `emit_${fm.name.replace(/-/g, "_")}`,
    inputSchema,
    outputSchema,
    templates,
    hitlGate: fm.hitl_gate,
    version: fm.version,
    promptVariant,
    enabled: fm.enabled ?? true,
    maxTokens: fm.max_tokens ?? 4096,
    temperature: fm.temperature ?? 0,
  };
}

/** Load every package listed in agents/registry.json, keyed by `key`. */
export function loadAllAgents(agentsRoot: string = AGENTS_ROOT): Record<string, LoadedAgent> {
  const reg = readJson<{ agents: { key: string; path: string }[] }>(
    path.join(agentsRoot, "registry.json"),
  );
  return Object.fromEntries(
    reg.agents.map((a) => [a.key, loadAgent(path.join(agentsRoot, path.basename(a.path)))]),
  );
}
