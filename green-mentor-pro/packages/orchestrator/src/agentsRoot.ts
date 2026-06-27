import path from "node:path";

// The agent packages live in this package's own `agents/` dir. Because Next
// bundles transpiled package source (so import.meta.url/__dirname don't point at
// node_modules at runtime), the consuming app resolves the real on-disk path
// once via setAgentsRoot(). Falls back to process.cwd()/agents.
let _root: string | null = null;

export function setAgentsRoot(dir: string) {
  _root = dir;
}

export function agentsRoot(): string {
  return _root ?? path.join(process.cwd(), "agents");
}
