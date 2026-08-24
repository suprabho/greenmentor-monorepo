-- Agent Studio package store. Agent packages ship as files in the repo and are
-- bundled into the deployment; this table holds edits saved from the Studio, which
-- cannot write to the filesystem on Vercel (/var/task is read-only).
--
-- Reads lay these rows over the bundled files, so an empty or unreachable table
-- degrades to exactly the on-disk behaviour. Deleting a row reverts that file to
-- whatever the deployed package says.
--
-- Deliberately NOT org-scoped, unlike the rest of 0001/0002: an agent package is
-- platform configuration — the prompt, I/O contract and tool list are the same for
-- every engagement — and it is global today as files in the repo. `updated_by`
-- keeps the audit trail. RLS is enabled with no policies (the pattern from
-- platform's 0011_brsr_filings), so anon/authenticated see zero rows and only the
-- service-role client reaches it.

create table if not exists public.esg_agent_package_files (
  id          uuid primary key default gen_random_uuid(),
  agent_key   text not null,                          -- folder name, e.g. 'peer-research'
  file        text not null,                          -- 'skill.md' | 'io.schema.json' | 'tools.json' | 'templates/<name>'
  content     text not null,
  updated_by  uuid,                                   -- session userUuid; no auth.uid() under service role
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (agent_key, file)
);

create index if not exists esg_agent_package_files_agent_idx
  on public.esg_agent_package_files (agent_key);

drop trigger if exists esg_agent_package_files_updated_at on public.esg_agent_package_files;
create trigger esg_agent_package_files_updated_at
  before update on public.esg_agent_package_files
  for each row execute function public.esg_set_updated_at();

alter table public.esg_agent_package_files enable row level security;
