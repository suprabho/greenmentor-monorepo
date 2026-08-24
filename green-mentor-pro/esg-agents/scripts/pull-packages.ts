/**
 * Pull stored Agent Studio edits back into the repo, so prompts saved in the running
 * app return to version control.
 *
 *   tsx scripts/pull-packages.ts            # write the files
 *   tsx scripts/pull-packages.ts --dry-run  # just list what differs
 *
 * Edits made in the Studio go to the database (the deployed filesystem is read-only),
 * which means they bypass git. Run this, review the diff, and commit.
 */
import { existsSync } from "node:fs";
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

import { readPackage, writePackageFile } from "@gm/agents";
import { readAllOverrides } from "../lib/db/agentPackages";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const all = await readAllOverrides();
  const keys = Object.keys(all).sort();
  if (!keys.length) return console.log("No stored edits — the repo is already the whole picture.");

  let changed = 0;
  let same = 0;
  for (const key of keys) {
    let pkg;
    try {
      pkg = readPackage(key);
    } catch {
      console.warn(`⚠ ${key}: stored edits for an agent that has no package folder — skipped`);
      continue;
    }
    const onDisk: Record<string, string> = {
      "skill.md": pkg.skill,
      "io.schema.json": pkg.ioSchema,
      "tools.json": pkg.tools,
    };
    pkg.templates.forEach((t) => (onDisk[`templates/${t.name}`] = t.content));

    for (const [file, content] of Object.entries(all[key])) {
      if (onDisk[file] === content) { same++; continue; }
      changed++;
      console.log(`${dryRun ? "would write" : "writing"}  ${key}/${file}`);
      if (!dryRun) writePackageFile(key, file, content);
    }
  }
  console.log(`\n${changed} file(s) ${dryRun ? "differ" : "written"}, ${same} already in sync.`);
  if (changed && !dryRun) console.log("Review with `git diff agents/` and commit.");
}

main().catch((e) => { console.error(e.message); process.exit(1); });
