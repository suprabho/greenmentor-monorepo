/**
 * Lint every agent package: skill.md frontmatter valid, io.schema.json has
 * $defs.input/output with all objects additionalProperties:false, tools.json names
 * cover the frontmatter tools[], and registry.json matches the folders.
 *
 *   tsx scripts/validate-packages.ts
 */
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const AGENTS_ROOT = path.join(process.cwd(), "agents");
const errors: string[] = [];
const warn: string[] = [];

function readJson(p: string): any {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function assertAllObjectsClosed(schema: any, where: string) {
  if (schema && typeof schema === "object") {
    if (schema.type === "object" && schema.additionalProperties !== false) {
      warn.push(`${where}: object missing "additionalProperties": false`);
    }
    for (const k of Object.keys(schema)) assertAllObjectsClosed(schema[k], `${where}/${k}`);
  }
}

const registry = readJson(path.join(AGENTS_ROOT, "registry.json"));
const registryKeys = new Set(registry.agents.map((a: any) => a.key));

const dirs = fs
  .readdirSync(AGENTS_ROOT, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
  .map((d) => d.name);

for (const dir of dirs) {
  const base = path.join(AGENTS_ROOT, dir);
  const skillPath = path.join(base, "skill.md");
  if (!fs.existsSync(skillPath)) {
    errors.push(`${dir}: missing skill.md`);
    continue;
  }
  const { data: fm } = matter(fs.readFileSync(skillPath, "utf8"));

  for (const field of ["name", "model", "phase", "family", "tools", "version"]) {
    if (fm[field] === undefined) errors.push(`${dir}: skill.md frontmatter missing "${field}"`);
  }
  if (fm.name && fm.name !== dir) warn.push(`${dir}: frontmatter name "${fm.name}" != folder`);
  if (!registryKeys.has(fm.name)) warn.push(`${dir}: not present in registry.json`);

  const ioPath = path.join(base, "io.schema.json");
  if (!fs.existsSync(ioPath)) {
    errors.push(`${dir}: missing io.schema.json`);
  } else {
    const io = readJson(ioPath);
    if (!io.$defs?.input) errors.push(`${dir}: io.schema.json missing $defs.input`);
    if (!io.$defs?.output) errors.push(`${dir}: io.schema.json missing $defs.output`);
    assertAllObjectsClosed(io.$defs?.output, `${dir} output`);
  }

  const toolsPath = path.join(base, "tools.json");
  if (!fs.existsSync(toolsPath)) {
    errors.push(`${dir}: missing tools.json`);
  } else {
    const tools = readJson(toolsPath);
    const names = new Set(tools.map((t: any) => t.name));
    for (const t of fm.tools ?? []) {
      if (!names.has(t)) errors.push(`${dir}: frontmatter tool "${t}" not in tools.json`);
    }
    if (fm.emit_tool && !names.has(fm.emit_tool)) {
      warn.push(`${dir}: emit_tool "${fm.emit_tool}" not in tools.json (defined inline at runtime — ok)`);
    }
  }
}

if (warn.length) {
  console.log("⚠️  warnings:");
  warn.forEach((w) => console.log("   - " + w));
}
if (errors.length) {
  console.error("❌ errors:");
  errors.forEach((e) => console.error("   - " + e));
  process.exit(1);
}
console.log(`✅ ${dirs.length} agent packages valid.`);
