// Agent Studio package IO. Reads come from the bundled files with any stored edits
// laid on top; writes go to the store, because the deployed filesystem is read-only.
import matter from "gray-matter";
import { listAgents, readPackage, validatePackageFile } from "@gm/agents";
import type { AgentMeta, PackageFiles } from "@gm/agents";
import { deleteOverride, readAllOverrides, readOverrides, writeOverride } from "@/lib/db/agentPackages";

export { listAgents, readPackage, writePackageFile } from "@gm/agents";
export type { AgentMeta, PackageFiles } from "@gm/agents";

/** A package plus which of its files are currently served from the store, not the repo. */
export interface PackageFilesWithOverrides extends PackageFiles {
  overridden: string[];
}

function overlay(pkg: PackageFiles, overrides: Record<string, string>): PackageFilesWithOverrides {
  const templates = pkg.templates.map((t) =>
    overrides[`templates/${t.name}`] ? { ...t, content: overrides[`templates/${t.name}`] } : t,
  );
  const skill = overrides["skill.md"] ?? pkg.skill;
  return {
    ...pkg,
    skill,
    ioSchema: overrides["io.schema.json"] ?? pkg.ioSchema,
    tools: overrides["tools.json"] ?? pkg.tools,
    templates,
    frontmatter: (matter(skill).data ?? {}) as Record<string, unknown>,
    overridden: Object.keys(overrides).sort(),
  };
}

export async function readPackageWithOverrides(key: string): Promise<PackageFilesWithOverrides> {
  return overlay(readPackage(key), await readOverrides(key));
}

/**
 * The Studio rail. registry.json is a build-time projection of the repo, so a model
 * changed through the Studio only shows up here if we re-read it from the stored
 * skill.md — one round trip for every agent.
 */
export async function listAgentsWithOverrides(): Promise<AgentMeta[]> {
  const all = await readAllOverrides();
  return listAgents().map((a) => {
    const skill = all[a.key]?.["skill.md"];
    if (!skill) return a;
    const model = (matter(skill).data as { model?: unknown } | undefined)?.model;
    return typeof model === "string" ? { ...a, model } : a;
  });
}

/** Validate, then store. Same gate as the on-disk writer, so a bad save can't land. */
export async function savePackageFile(
  key: string,
  file: string,
  content: string,
  updatedBy: string | null,
): Promise<{ ok: true; file: string }> {
  // Resolves the key against agents/ and throws on an unknown agent or a template
  // the package doesn't have — the store has no folder to check against.
  const pkg = readPackage(key);
  if (file.startsWith("templates/") && !pkg.templates.some((t) => `templates/${t.name}` === file)) {
    throw new Error(`unknown template file: ${file.slice("templates/".length)}`);
  }
  validatePackageFile(file, content);
  await writeOverride(key, file, content, updatedBy);
  return { ok: true, file };
}

/** Drop a stored edit; the file reverts to whatever the deployed package says. */
export async function revertPackageFile(key: string, file: string): Promise<{ ok: true; file: string }> {
  readPackage(key); // same unknown-agent guard as the save path
  await deleteOverride(key, file);
  return { ok: true, file };
}
