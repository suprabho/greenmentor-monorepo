-- Green Mentor Pro — AI usage metering. Run after 0008_academy_gamification.sql
-- (which created the shared credit_transactions ledger) and 0004_chat.sql
-- (which created esg_organizations references / esg_is_member).
--
-- This is the measurement half of the credits rail: every billable model call
-- writes one ai_usage_events row with real token counts and the derived cost, so
-- per-run unit economics (PRD §12 open question 4) can be modelled from data
-- rather than guessed. Credits are METERED from actual tokens — the credit amount
-- is only knowable AFTER the call finishes, so there is no pre-run price to show;
-- see lib/ai/usage.ts for the balance floor that stands in for one.
--
-- Charging is deliberately decoupled from recording. Rows are always written;
-- `charged` is only true when AI_CREDITS_ENFORCED is on AND the call fell outside
-- the free daily allowance. That lets prices be set from observed cost before any
-- user is debited. The matching ledger row (type 'spend') carries
-- ref = 'ai:<ai_usage_events.id>', which the ledger's unique (user_id, ref)
-- turns into the idempotency guarantee.

create table if not exists public.ai_usage_events (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  -- Nullable: the standalone ESG Buddy surface is reachable without an org.
  org_id             uuid references public.esg_organizations (id) on delete set null,
  surface            text not null check (surface in ('buddy_chat', 'hub_chat', 'engagement_chat', 'energy_extract')),
  ref                text,                                  -- conversation / engagement id, for tracing back
  model              text not null,                          -- as reported by the provider
  -- 'table' = the model matched lib/ai/pricing.ts; 'fallback' = it did not and the
  -- most expensive known rate was applied. Non-zero fallback counts mean the rate
  -- table is stale — check before trusting cost_inr in aggregate.
  priced             text not null default 'table' check (priced in ('table', 'fallback')),

  -- Token counts straight from the provider (AI SDK LanguageModelUsage). Input is
  -- split because cache reads bill at ~0.1x and cache writes at ~1.25x of the base
  -- input rate; summing them as one number would misprice cached prompts badly.
  input_tokens       integer not null default 0,             -- non-cached input
  cache_read_tokens  integer not null default 0,
  cache_write_tokens integer not null default 0,
  output_tokens      integer not null default 0,
  reasoning_tokens   integer not null default 0,             -- subset of output_tokens, for visibility only

  cost_usd           numeric(14, 8) not null default 0,      -- provider cost, before margin
  cost_inr           numeric(14, 6) not null default 0,      -- cost_usd * AI_USD_INR
  -- Un-rounded metered credits (cost_inr * AI_CREDIT_MARGIN). 1 credit = ₹1 (PRD §7),
  -- so this is a rupee figure; kept fractional because a single chat message can
  -- legitimately cost less than a credit and those must still aggregate correctly.
  credits            numeric(14, 6) not null default 0,
  credits_charged    integer not null default 0,             -- what actually hit the ledger (ceil of credits, or 0)

  free_tier          boolean not null default false,         -- fell inside the free daily allowance
  charged            boolean not null default false,         -- a credit_transactions row exists for this event
  created_at         timestamptz not null default now()
);

create index if not exists ai_usage_events_user_idx
  on public.ai_usage_events (user_id, created_at desc);
-- Serves the free-allowance count in checkAiAllowance (per user, per surface, today).
create index if not exists ai_usage_events_quota_idx
  on public.ai_usage_events (user_id, surface, created_at desc);

alter table public.ai_usage_events enable row level security;

-- Same shape as xp_events / credit_transactions in 0008: owners may read their own
-- usage, and nothing may write from a client session. Every insert goes through the
-- service-role admin client in lib/ai/usage.ts, so a user can never manufacture a
-- free-tier row to dodge the allowance or fabricate a spend.
drop policy if exists "ai_usage_events own read" on public.ai_usage_events;
create policy "ai_usage_events own read" on public.ai_usage_events for select to authenticated
  using (auth.uid() = user_id);
