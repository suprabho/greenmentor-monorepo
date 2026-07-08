/**
 * Generates short placeholder title-card videos + poster images for every
 * seeded Academy lesson (no real video assets exist yet — see
 * PRD-Bite-Sized-Learning-Module.md §14 risk #2) and uploads them to the
 * academy-videos / academy-posters Storage buckets, then backfills
 * lessons.duration_seconds to the actual generated length so the DB never
 * disagrees with what the <video> element reports.
 *
 *   node --env-file=.env.local --import tsx scripts/seed-academy-media.ts
 *
 * Requires ffmpeg on PATH and SUPABASE_SERVICE_ROLE_KEY set. Safe to re-run —
 * skips lessons that already have an object at their video_object_path.
 */
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { createAdminClient } from "../lib/supabase/admin";

const run = promisify(execFile);
const CLIP_SECONDS = 30;

async function ffmpegClip(outPath: string, title: string, seconds: number): Promise<void> {
  const hue = Math.floor(Math.random() * 360);
  const safeTitle = title.replace(/'/g, "\\'").replace(/:/g, "\\:");
  await run("ffmpeg", [
    "-y",
    "-f", "lavfi", "-i", `color=c=hsl(${hue}%2c60%2c25):s=1280x720:d=${seconds}`,
    "-f", "lavfi", "-i", `sine=frequency=220:duration=${seconds}`,
    "-vf",
    `drawtext=text='${safeTitle}':fontcolor=white:fontsize=42:x=(w-text_w)/2:y=(h-text_h)/2`,
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest",
    outPath,
  ]);
}

async function ffmpegPoster(outPath: string, videoPath: string): Promise<void> {
  await run("ffmpeg", ["-y", "-i", videoPath, "-frames:v", "1", "-q:v", "3", outPath]);
}

async function main() {
  const admin = createAdminClient();
  const { data: lessons, error } = await admin
    .from("lessons")
    .select("id, title, video_object_path, poster_object_path")
    .eq("type", "video")
    .not("video_object_path", "is", null);
  if (error) throw new Error(error.message);

  const dir = await mkdtemp(path.join(tmpdir(), "academy-media-"));
  try {
    for (const lesson of lessons ?? []) {
      const videoPath = lesson.video_object_path as string;
      const posterPath = lesson.poster_object_path as string | null;

      const { data: existing } = await admin.storage
        .from("academy-videos")
        .list(path.dirname(videoPath), { search: path.basename(videoPath) });
      if (existing?.some((f) => f.name === path.basename(videoPath))) {
        console.log(`skip (already uploaded): ${videoPath}`);
        continue;
      }

      const localVideo = path.join(dir, `${lesson.id}.mp4`);
      const localPoster = path.join(dir, `${lesson.id}.jpg`);
      console.log(`generating: ${lesson.title}`);
      await ffmpegClip(localVideo, lesson.title as string, CLIP_SECONDS);
      await ffmpegPoster(localPoster, localVideo);

      const videoBytes = await readFile(localVideo);
      const { error: uploadErr } = await admin.storage
        .from("academy-videos")
        .upload(videoPath, videoBytes, { contentType: "video/mp4", upsert: false });
      if (uploadErr) throw new Error(`video upload failed for ${videoPath}: ${uploadErr.message}`);

      if (posterPath) {
        const posterBytes = await readFile(localPoster);
        const { error: posterErr } = await admin.storage
          .from("academy-posters")
          .upload(posterPath, posterBytes, { contentType: "image/jpeg", upsert: false });
        if (posterErr) throw new Error(`poster upload failed for ${posterPath}: ${posterErr.message}`);
      }

      const { error: durationErr } = await admin
        .from("lessons")
        .update({ duration_seconds: CLIP_SECONDS })
        .eq("id", lesson.id);
      if (durationErr) throw new Error(`duration update failed for ${lesson.id}: ${durationErr.message}`);

      console.log(`uploaded: ${videoPath}`);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
