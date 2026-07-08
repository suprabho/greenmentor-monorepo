-- webinar-headers — public bucket for Aura Header Studio images generated for a
-- webinar. Same shape as platform's academy-posters (0006_academy_content.sql):
-- a public bucket so the learner webinar cards can <img src> the cover without a
-- signing round trip. Writes happen through the community-engine service-role
-- client (POST /api/webinars/[id]/header), which bypasses RLS — so no
-- storage.objects policies are needed.
--
-- Apply to the shared Supabase project (both apps point at it).

insert into storage.buckets (id, name, public) values ('webinar-headers', 'webinar-headers', true)
  on conflict (id) do nothing;
