/**
 * Uploads the local mentor headshots (platform/public/mentors/*) to the public
 * `instructor-photos` Supabase Storage bucket and backfills
 * community_instructors.photo with the resulting absolute URLs — so the roster
 * photos resolve everywhere (learner cards AND the community-engine Aura header
 * renderer), not just on the platform's own /mentors path.
 *
 *   node --env-file=.env.local --import tsx scripts/upload-instructor-photos.ts
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY (bypasses RLS to write the bucket + table).
 * Idempotent — re-run any time; uploads upsert and rows update in place. Matches
 * instructor rows by name (the roster was seeded from this same mentors list).
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { createAdminClient } from "../lib/supabase/admin";
import { mentors } from "../lib/data/mentors";

const BUCKET = "instructor-photos";

function contentTypeFor(file: string): string {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

async function ensureBucket(admin: ReturnType<typeof createAdminClient>): Promise<void> {
  const { error } = await admin.storage.createBucket(BUCKET, { public: true });
  // "already exists" (409 / Duplicate) is the happy path on re-runs.
  if (error && !/exists|duplicate/i.test(error.message)) {
    throw new Error(`could not ensure bucket ${BUCKET}: ${error.message}`);
  }
}

async function main(): Promise<void> {
  const admin = createAdminClient();
  await ensureBucket(admin);

  let uploaded = 0;
  let linked = 0;
  const missing: string[] = [];

  for (const mentor of mentors) {
    if (!mentor.photo || /^https?:\/\//.test(mentor.photo)) {
      // No local photo, or already an absolute URL — nothing to upload.
      continue;
    }

    const objectPath = path.basename(mentor.photo); // e.g. "karuna.jpeg"
    const localPath = path.join(process.cwd(), "public", mentor.photo);

    let bytes: Buffer;
    try {
      bytes = await readFile(localPath);
    } catch {
      missing.push(`${mentor.name} → ${localPath} (file not found)`);
      continue;
    }

    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(objectPath, bytes, { contentType: contentTypeFor(objectPath), upsert: true });
    if (upErr) throw new Error(`upload failed for ${objectPath}: ${upErr.message}`);
    uploaded++;

    const publicUrl = admin.storage.from(BUCKET).getPublicUrl(objectPath).data.publicUrl;

    const { data, error: updErr } = await admin
      .from("community_instructors")
      .update({ photo: publicUrl })
      .eq("name", mentor.name)
      .select("id");
    if (updErr) throw new Error(`backfill failed for ${mentor.name}: ${updErr.message}`);

    if (!data || data.length === 0) {
      missing.push(`${mentor.name} (uploaded, but no matching community_instructors row)`);
    } else {
      linked += data.length;
      console.log(`✓ ${mentor.name} → ${publicUrl}`);
    }
  }

  console.log(`\nDone. Uploaded ${uploaded} image(s), linked ${linked} instructor row(s).`);
  if (missing.length > 0) {
    console.log("\nNeeds attention:");
    for (const m of missing) console.log(`  - ${m}`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
