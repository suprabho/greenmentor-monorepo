-- story-source-uploads — staging bucket for source files too large to POST
-- inline to a route handler.
--
-- Route-handler request bodies cap at ~4.5MB, so a 20MB regulatory PDF cannot
-- reach the compose sources route at all. Instead the client asks for a signed
-- upload URL, PUTs the file straight to storage, and then calls the sources route
-- with the storage path; the route downloads the object server-side, extracts its
-- text, and deletes it.
--
-- PRIVATE, unlike story-assets (0015) and webinar-headers (0007). Those hold
-- rendered output that has to be publicly fetchable; this holds unpublished
-- source material an admin uploaded — regulatory drafts, client documents,
-- embargoed reports. Nothing outside the extraction step ever needs to read it,
-- so it must not be world-readable.
--
-- No storage.objects policies: every read and write goes through the
-- service-role client (already behind requireAdminApiUser), which bypasses RLS.
-- The signed upload URL the client receives is itself the scoped, expiring
-- capability — it grants a write to ONE path and nothing else.
--
-- Objects are transient: the sources route deletes each one once its text is
-- extracted. The bucket is not a document library, and treating it as one would
-- accumulate unpublished third-party material indefinitely.
--
-- Apply via the Supabase SQL Editor (runs as the privileged role) or psql.
-- Numbered 0022 so 0021 stays free for the story-publications migration.

insert into storage.buckets (id, name, public)
values ('story-source-uploads', 'story-source-uploads', false)
  on conflict (id) do nothing;

-- Keep the ceiling at the bucket too, not just in the route: a signed upload URL
-- is a capability handed to a browser, so the size limit has to be enforced where
-- the write actually lands. 25MB comfortably covers a long annual report while
-- still bounding what one signed URL can put in the bucket.
update storage.buckets
   set file_size_limit = 25 * 1024 * 1024
 where id = 'story-source-uploads';
