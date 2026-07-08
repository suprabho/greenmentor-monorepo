/**
 * Imports the real "ESG Fundamentals" course from a locally-downloaded copy of
 * the course Google Drive folder (Drive UI → right-click the folder →
 * Download, then unzip):
 *
 *   node --env-file=.env.local --import tsx scripts/import-academy-course.ts <path-to-folder>
 *   (or: npm run academy:import -- <path-to-folder>)
 *
 * The <path-to-folder> must contain the module subfolders named in
 * scripts/academy-course-data.ts ("Introduction", "Evolution of ESG", …).
 * For each module folder, every `*.mp4` named like "Something #N (Title).mp4"
 * becomes a lesson at position N: the video is uploaded to the private
 * academy-videos bucket, a poster frame goes to academy-posters, and
 * duration_seconds comes from ffprobe so the DB always matches the file.
 * Module-gate assessments + questions come from the same data file
 * (transcribed from the course's "Assessment" doc).
 *
 * Idempotent: rows are upserted by natural key and uploads use upsert, so
 * re-running after adding/replacing videos is safe. Requires ffmpeg/ffprobe
 * on PATH and SUPABASE_SERVICE_ROLE_KEY set.
 */
import { execFile } from "node:child_process";
import { mkdir, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { createAdminClient } from "../lib/supabase/admin";
import { COURSE, MODULES } from "./academy-course-data";

const run = promisify(execFile);

async function probeDurationSeconds(file: string): Promise<number> {
  const { stdout } = await run("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "csv=p=0",
    file,
  ]);
  const seconds = Number.parseFloat(stdout.trim());
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error(`ffprobe returned no duration for ${file}`);
  return Math.round(seconds);
}

async function extractPoster(videoFile: string, outFile: string): Promise<void> {
  // Grab a frame a second in so title cards/fade-ins have resolved.
  await run("ffmpeg", ["-y", "-ss", "1", "-i", videoFile, "-frames:v", "1", "-q:v", "3", outFile]);
}

/** "Introductory #6 (Stop Confusing…) (1).mp4" → { position: 6, title: "Stop Confusing…" }
 *  "introductory #5 {What is ESG}.mp4"        → { position: 5, title: "What is ESG" }
 *  "ESG Reporting Journey #3.mp4"             → { position: 3, title: null } */
function parseLessonFilename(name: string): { position: number; title: string | null } | null {
  const base = name.replace(/\.mp4$/i, "");
  const numMatch = base.match(/#(\d+)/);
  if (!numMatch) return null;
  const position = Number.parseInt(numMatch[1], 10);

  const bracketed = [...base.matchAll(/[({[]([^)}\]]+)[)}\]]/g)]
    .map((m) => m[1].trim())
    .filter((t) => t && !/^\d+$/.test(t)); // drop "(1)" duplicate-download markers
  return { position, title: bracketed[0] ?? null };
}

async function main() {
  const root = process.argv[2];
  if (!root) {
    console.error("usage: npm run academy:import -- <path-to-downloaded-drive-folder>");
    process.exit(1);
  }

  const admin = createAdminClient();
  const scratch = path.join(tmpdir(), `academy-import-${Date.now()}`);
  await mkdir(scratch, { recursive: true });

  try {
    const { data: track, error: trackErr } = await admin
      .from("tracks")
      .upsert({ slug: COURSE.trackSlug, title: COURSE.trackTitle }, { onConflict: "slug" })
      .select("id")
      .single();
    if (trackErr) throw new Error(trackErr.message);

    const { data: course, error: courseErr } = await admin
      .from("courses")
      .upsert(
        {
          track_id: track.id,
          slug: COURSE.slug,
          title: COURSE.title,
          description: COURSE.description,
          level: COURSE.level,
          price_credits: COURSE.priceCredits,
          status: "published",
          position: 0,
        },
        { onConflict: "slug" }
      )
      .select("id")
      .single();
    if (courseErr) throw new Error(courseErr.message);
    console.log(`course: ${COURSE.title} (${course.id})`);

    for (const [moduleIndex, mod] of MODULES.entries()) {
      const moduleDir = path.join(root, mod.folder);
      let entries: string[];
      try {
        entries = await readdir(moduleDir);
      } catch {
        console.warn(`SKIP module "${mod.title}" — folder not found: ${moduleDir}`);
        continue;
      }

      const { data: moduleRow, error: moduleErr } = await admin
        .from("modules")
        .upsert(
          { course_id: course.id, position: moduleIndex, title: mod.title, description: mod.description },
          { onConflict: "course_id,position" }
        )
        .select("id")
        .single();
      if (moduleErr) throw new Error(moduleErr.message);
      console.log(`\nmodule ${moduleIndex + 1}/${MODULES.length}: ${mod.title}`);

      const videos = entries
        .filter((f) => /\.mp4$/i.test(f))
        .map((f) => ({ file: f, parsed: parseLessonFilename(f) }))
        .filter((v): v is { file: string; parsed: NonNullable<ReturnType<typeof parseLessonFilename>> } => v.parsed !== null)
        .sort((a, b) => a.parsed.position - b.parsed.position);
      if (!videos.length) {
        console.warn(`  no parseable .mp4 files in ${moduleDir}`);
        continue;
      }

      for (const { file, parsed } of videos) {
        const local = path.join(moduleDir, file);
        const lessonTitle = parsed.title ?? `${mod.title} — Part ${parsed.position}`;
        const videoPath = `${COURSE.slug}/${mod.slug}/l${parsed.position}.mp4`;
        const posterPath = `${COURSE.slug}/${mod.slug}/l${parsed.position}.jpg`;

        const durationSeconds = await probeDurationSeconds(local);

        const localPoster = path.join(scratch, `${mod.slug}-l${parsed.position}.jpg`);
        await extractPoster(local, localPoster);

        const videoBytes = await readFile(local);
        const { error: vErr } = await admin.storage
          .from("academy-videos")
          .upload(videoPath, videoBytes, { contentType: "video/mp4", upsert: true });
        if (vErr) throw new Error(`video upload failed (${videoPath}): ${vErr.message}`);

        const posterBytes = await readFile(localPoster);
        const { error: pErr } = await admin.storage
          .from("academy-posters")
          .upload(posterPath, posterBytes, { contentType: "image/jpeg", upsert: true });
        if (pErr) throw new Error(`poster upload failed (${posterPath}): ${pErr.message}`);

        // Drive filenames are 1-based; lessons.position is 0-based.
        const { error: lErr } = await admin.from("lessons").upsert(
          {
            module_id: moduleRow.id,
            position: parsed.position - 1,
            type: "video",
            title: lessonTitle,
            video_object_path: videoPath,
            poster_object_path: posterPath,
            duration_seconds: durationSeconds,
          },
          { onConflict: "module_id,position" }
        );
        if (lErr) throw new Error(`lesson upsert failed (${lessonTitle}): ${lErr.message}`);

        const mins = Math.floor(durationSeconds / 60);
        console.log(`  #${parsed.position} ${lessonTitle} (${mins}m${durationSeconds % 60}s) ✓`);
      }

      if (mod.questions.length > 0) {
        // Get-or-create rather than upsert: the one-gate-per-module uniqueness
        // is a partial index (where scope = 'module'), which PostgREST's
        // on_conflict can't target.
        const { data: existingAssessment, error: findErr } = await admin
          .from("assessments")
          .select("id")
          .eq("module_id", moduleRow.id)
          .eq("scope", "module")
          .maybeSingle();
        if (findErr) throw new Error(findErr.message);

        let assessmentId = existingAssessment?.id;
        if (!assessmentId) {
          const { data: created, error: aErr } = await admin
            .from("assessments")
            .insert({
              scope: "module",
              module_id: moduleRow.id,
              title: `Module check: ${mod.title}`,
              pass_threshold_pct: 70,
              xp_award: 25,
              coin_award: 25,
              shuffle_options: true,
            })
            .select("id")
            .single();
          if (aErr) throw new Error(aErr.message);
          assessmentId = created.id;
        }
        const assessment = { id: assessmentId };

        for (const [qi, question] of mod.questions.entries()) {
          const { error: qErr } = await admin.from("questions").upsert(
            {
              assessment_id: assessment.id,
              position: qi,
              stem: question.stem,
              type: "single_select",
              options: question.options,
              correct_key: question.correctKey,
              topic_tag: question.topicTag,
            },
            { onConflict: "assessment_id,position" }
          );
          if (qErr) throw new Error(`question upsert failed (${mod.slug} #${qi}): ${qErr.message}`);
        }
        console.log(`  gate: ${mod.questions.length} questions ✓`);
      } else {
        console.log(`  gate: none (no questions in the Assessment doc yet)`);
      }
    }

    console.log(`\nDone. The course is live at /academy/${COURSE.slug}`);
    console.log(
      `To remove the placeholder demo course, run in the SQL editor:\n  delete from courses where slug = 'esg-fundamentals-bites';`
    );
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
