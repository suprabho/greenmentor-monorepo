-- story-assets — public bucket for images rendered from a story's body when
-- exporting Substack-friendly HTML (chart + hero blocks that Substack can't
-- render inline). Public so the exported <img src> resolves when the newsletter
-- is pasted into Substack (Substack re-fetches and re-hosts the image at paste
-- time — the source URL must be reachable without auth, and must persist, so
-- this is a durable bucket, not the share-cards TTL handoff table).
--
-- Same shape as webinar-headers (0007): writes go through the community-engine
-- service-role client (POST /api/stories/[id]/export), which bypasses RLS, so no
-- storage.objects policies are needed.
--
-- Apply to the shared Supabase project (both apps point at it).

insert into storage.buckets (id, name, public) values ('story-assets', 'story-assets', true)
  on conflict (id) do nothing;
