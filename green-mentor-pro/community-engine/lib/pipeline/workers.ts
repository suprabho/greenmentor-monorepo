/**
 * Feed-pipeline worker control plane for the community admin hub.
 *
 * The ESG feed pipeline runs as scheduled GitHub Actions "workers" (today just
 * the daily feed ingest). This server-only module lets the Pipeline tab
 * (a) fire any/all of them on demand via `workflow_dispatch`, and (b) read back
 * each one's most recent run so operators can see freshness at a glance.
 *
 * Ported from vismay's `packages/content-source/src/workerDispatch.ts` so both
 * admin apps share one mental model. Env (all server-side):
 *   GITHUB_DISPATCH_TOKEN  fine-grained PAT with `actions` read + `workflow`
 *                          write on the repo
 *   GITHUB_DISPATCH_REPO   "owner/repo" (e.g. "suprabho/greenmentor-monorepo")
 *   GITHUB_DISPATCH_REF    branch the workflows run from (default: "main")
 *
 * When the env isn't set (local dev) callers get `unconfigured` mode: the
 * worker list still renders, but without last-run data or triggering.
 */

/** A pipeline worker, keyed by its GitHub Actions workflow file. */
export interface WorkerDef {
  /** Stable id (== workflow file, minus .yml) used by the API + UI. */
  id: string;
  /** Workflow file name, relative to .github/workflows/ at the repo root. */
  workflowFile: string;
  /** Human label for the dashboard. */
  label: string;
  /** One-line description of what the worker does. */
  description: string;
  /** Cron summary shown next to the label (informational only). */
  schedule: string;
}

/**
 * The feed workers, in pipeline order. Keep in sync with the repo-root
 * `.github/workflows/*.yml` — add an entry here when a new worker lands.
 */
export const PIPELINE_WORKERS: WorkerDef[] = [
  {
    id: "feed-ingest",
    workflowFile: "feed-ingest.yml",
    label: "ESG feed ingest",
    description:
      "Pulls the ESG RSS sources, summarizes + entity-tags each new article via Claude, upserts into Supabase.",
    schedule: "Daily 06:30 UTC",
  },
  {
    id: "brsr-scrape",
    workflowFile: "brsr-scrape.yml",
    label: "BRSR filings scraper",
    description:
      "Syncs NSE's BRSR filing index, archives each XBRL to Storage, extracts BRSR Core indicators + Section A material topics, and canonicalizes new topic phrasings via Claude.",
    schedule: "Daily 15:30 UTC",
  },
];

/** Most recent run of a worker's workflow, or null when it has never run. */
export interface WorkerLastRun {
  status: string | null;
  conclusion: string | null;
  /** ISO timestamp the run was created. */
  createdAt: string | null;
  /** What triggered it: schedule, workflow_dispatch, push, … */
  event: string | null;
  /** Link to the run on GitHub. */
  url: string | null;
}

export interface WorkerStatus extends WorkerDef {
  lastRun: WorkerLastRun | null;
}

export function isWorkerDispatchConfigured(): boolean {
  return Boolean(process.env.GITHUB_DISPATCH_TOKEN && process.env.GITHUB_DISPATCH_REPO);
}

function dispatchEnv(): { token: string; repo: string; ref: string } {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const repo = process.env.GITHUB_DISPATCH_REPO;
  const ref = process.env.GITHUB_DISPATCH_REF ?? "main";
  if (!token || !repo) {
    throw new Error("GITHUB_DISPATCH_TOKEN and GITHUB_DISPATCH_REPO must be set");
  }
  return { token, repo, ref };
}

function ghHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

/** Look up a worker by its id, or undefined if unknown. */
export function findWorker(id: string): WorkerDef | undefined {
  return PIPELINE_WORKERS.find((w) => w.id === id);
}

/**
 * Fire a single worker's workflow_dispatch. Inputs are passed through verbatim;
 * feed-ingest takes none, so an empty object is always safe.
 */
export async function dispatchWorker(
  worker: WorkerDef,
  inputs: Record<string, string> = {}
): Promise<void> {
  const { token, repo, ref } = dispatchEnv();
  const res = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/${worker.workflowFile}/dispatches`,
    {
      method: "POST",
      headers: { ...ghHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify({ ref, inputs }),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Dispatch of ${worker.id} failed: ${res.status} ${body.slice(0, 300)}`);
  }
  // 204 No Content on success.
}

/** Result of attempting to trigger every worker. */
export interface DispatchAllResult {
  id: string;
  ok: boolean;
  error?: string;
}

/**
 * Trigger every worker. Each dispatch is independent — one failure doesn't
 * abort the rest — and the per-worker outcome is returned so the UI can show
 * which ones actually fired.
 */
export async function dispatchAllWorkers(): Promise<DispatchAllResult[]> {
  return Promise.all(
    PIPELINE_WORKERS.map(async (w) => {
      try {
        await dispatchWorker(w);
        return { id: w.id, ok: true };
      } catch (e) {
        return { id: w.id, ok: false, error: e instanceof Error ? e.message : "dispatch failed" };
      }
    })
  );
}

interface GhRun {
  status: string | null;
  conclusion: string | null;
  created_at: string | null;
  event: string | null;
  html_url: string | null;
}

async function fetchLastRun(
  token: string,
  repo: string,
  worker: WorkerDef
): Promise<WorkerLastRun | null> {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/${worker.workflowFile}/runs?per_page=1`,
    { headers: ghHeaders(token), cache: "no-store" }
  );
  if (!res.ok) {
    throw new Error(`Could not read runs for ${worker.id}: ${res.status}`);
  }
  const data = (await res.json()) as { workflow_runs?: GhRun[] };
  const run = data.workflow_runs?.[0];
  if (!run) return null;
  return {
    status: run.status,
    conclusion: run.conclusion,
    createdAt: run.created_at,
    event: run.event,
    url: run.html_url,
  };
}

/**
 * Status (definition + last run) for every worker. The last-run read is
 * best-effort per worker: if one workflow's runs can't be fetched its
 * `lastRun` is null rather than failing the whole call.
 */
export async function fetchWorkerStatuses(): Promise<WorkerStatus[]> {
  const { token, repo } = dispatchEnv();
  return Promise.all(
    PIPELINE_WORKERS.map(async (w) => {
      let lastRun: WorkerLastRun | null = null;
      try {
        lastRun = await fetchLastRun(token, repo, w);
      } catch {
        lastRun = null;
      }
      return { ...w, lastRun };
    })
  );
}
