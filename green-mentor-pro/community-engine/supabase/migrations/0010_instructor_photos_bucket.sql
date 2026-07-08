-- instructor-photos — public bucket for the roster headshots referenced by
-- community_instructors.photo (migration 0008). Same shape as academy-posters /
-- webinar-headers: public so both the learner cards AND the community-engine
-- Aura header renderer can <img src> the absolute URL — a relative /mentors path
-- only resolves on the platform origin.
--
-- Populate it with scripts/upload-instructor-photos.ts (in the platform app),
-- which uploads platform/public/mentors/*.jpeg here and backfills photo URLs.
-- Writes go through the service-role client, so no storage.objects policies.

insert into storage.buckets (id, name, public) values ('instructor-photos', 'instructor-photos', true)
  on conflict (id) do nothing;
