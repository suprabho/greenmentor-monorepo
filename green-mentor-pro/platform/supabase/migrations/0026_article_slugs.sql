-- Shareable deeplinks for feed posts: /feed/{slug}-{id_prefix}.
--
-- The community-engine side of this is 0017_shareable_slugs.sql, which does the
-- same for community_webinars and community_jobs and carries the full rationale
-- for the slug/id_prefix split. Both helper functions are `create or replace`
-- in both files, so the two migrations apply in either order.
--
-- No view to rebuild here: public.articles already has an anonymous read policy
-- ("articles public read", 0003_feed.sql), so the new columns are readable by
-- the anon key as soon as they exist.
--
-- The RSS worker (scripts/ingest-feed.ts) needs no change — it upserts on
-- articles.url and the BEFORE trigger fills the slug on the way in.
--
-- Apply via the Supabase SQL Editor (runs as the privileged role) or psql.

create or replace function public.gm_slugify(input text)
returns text
language sql
immutable
as $$
  select btrim(
    left(
      btrim(regexp_replace(lower(coalesce(input, '')), '[^a-z0-9]+', '-', 'g'), '-'),
      60
    ),
    '-'
  )
$$;

create or replace function public.gm_set_share_keys()
returns trigger language plpgsql as $$
begin
  if nullif(btrim(coalesce(new.slug, '')), '') is null then
    new.slug := nullif(public.gm_slugify(new.title), '');
  end if;
  new.id_prefix := left(replace(new.id::text, '-', ''), 10);
  return new;
end;
$$;

alter table public.articles
  add column if not exists slug      text,
  add column if not exists id_prefix text;

-- Not unique: articles grows unbounded from the RSS worker, and a unique index
-- on a truncated uuid would eventually fail an insert. The platform resolver
-- disambiguates on slug instead.
create index if not exists articles_id_prefix_idx on public.articles (id_prefix);

drop trigger if exists articles_share_keys on public.articles;
create trigger articles_share_keys
  before insert or update on public.articles
  for each row execute function public.gm_set_share_keys();

update public.articles
set slug      = coalesce(nullif(btrim(coalesce(slug, '')), ''), nullif(public.gm_slugify(title), '')),
    id_prefix = left(replace(id::text, '-', ''), 10)
where slug is null or btrim(slug) = '' or id_prefix is null;
