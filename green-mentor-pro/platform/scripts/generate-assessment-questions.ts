/**
 * Drafts module-gate questions for course modules that have none, grounded in
 * the actual video content: extracts each video's audio (ffmpeg), transcribes
 * it locally (whisper-cli, model auto-downloaded on first run), and has Claude
 * write 3 single-select MCQs per video from the transcript.
 *
 *   npm run academy:generate-questions -- <path-to-course-folder>            # draft only
 *   npm run academy:generate-questions -- <path-to-course-folder> --apply    # draft + seed DB gates
 *
 * By default this only WRITES A DRAFT to scripts/academy-generated-questions.json
 * for human review — AI-generated assessment content should be checked by the
 * course author before learners see it. Re-run with --apply (or hand-merge the
 * reviewed questions into scripts/academy-course-data.ts and re-run
 * academy:import) to create the gates in the database.
 *
 * Targets every module in academy-course-data.ts whose `questions` array is
 * empty. Requires ffmpeg + whisper-cli on PATH, ANTHROPIC_API_KEY and
 * SUPABASE_SERVICE_ROLE_KEY (for --apply) in .env.local.
 */
import Anthropic from "@anthropic-ai/sdk";
import { execFile } from "node:child_process";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { createAdminClient } from "../lib/supabase/admin";
import { COURSE, MODULES, type SeedQuestion } from "./academy-course-data";

const run = promisify(execFile);

const QUESTIONS_PER_VIDEO = 3;
const CLAUDE_MODEL = process.env.ACADEMY_QUESTIONS_MODEL ?? "claude-sonnet-5";
const WHISPER_MODEL_URL =
  "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin";
const WHISPER_MODEL_PATH = path.join(homedir(), ".cache", "whisper", "ggml-base.en.bin");
const DRAFT_PATH = path.join(__dirname, "academy-generated-questions.json");

function parseLessonFilename(name: string): { position: number; title: string | null } | null {
  const base = name.replace(/\.mp4$/i, "");
  const numMatch = base.match(/#(\d+)/);
  if (!numMatch) return null;
  const position = Number.parseInt(numMatch[1], 10);
  const bracketed = [...base.matchAll(/[({[]([^)}\]]+)[)}\]]/g)]
    .map((m) => m[1].trim())
    .filter((t) => t && !/^\d+$/.test(t));
  return { position, title: bracketed[0] ?? null };
}

async function ensureWhisperModel(): Promise<void> {
  try {
    await readFile(WHISPER_MODEL_PATH);
    return;
  } catch {
    console.log(`downloading whisper model (~148 MB, one-time) → ${WHISPER_MODEL_PATH}`);
    await mkdir(path.dirname(WHISPER_MODEL_PATH), { recursive: true });
    await run("curl", ["-L", "-o", WHISPER_MODEL_PATH, WHISPER_MODEL_URL], { maxBuffer: 1024 * 1024 });
  }
}

async function transcribe(videoFile: string, scratch: string): Promise<string> {
  const wav = path.join(scratch, `${path.basename(videoFile, ".mp4")}.wav`);
  await run("ffmpeg", ["-y", "-i", videoFile, "-ar", "16000", "-ac", "1", "-f", "wav", wav]);
  const outBase = wav.replace(/\.wav$/, "");
  await run("whisper-cli", ["-m", WHISPER_MODEL_PATH, "-f", wav, "-otxt", "-of", outBase, "--no-prints"]);
  return (await readFile(`${outBase}.txt`, "utf8")).trim();
}

async function draftQuestions(
  anthropic: Anthropic,
  moduleTitle: string,
  lessonTitle: string,
  transcript: string
): Promise<SeedQuestion[]> {
  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: `You are writing assessment questions for a bite-sized ESG course. Below is the transcript of one short video lesson.

Module: ${moduleTitle}
Lesson: ${lessonTitle}

Transcript:
"""
${transcript}
"""

Write exactly ${QUESTIONS_PER_VIDEO} single-select multiple-choice questions grounded ONLY in claims actually made in this transcript (never outside knowledge — if the transcript garbles a detail, skip that detail). Each question: a clear stem, four plausible options (one correct, three realistic distractors of similar length/specificity), and a short kebab-case topic tag.

Respond with ONLY a JSON array, no prose, in exactly this shape:
[{"stem":"...","options":[{"key":"a","text":"..."},{"key":"b","text":"..."},{"key":"c","text":"..."},{"key":"d","text":"..."}],"correctKey":"a","topicTag":"..."}]`,
      },
    ],
  });

  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
  const jsonStart = text.indexOf("[");
  const jsonEnd = text.lastIndexOf("]");
  if (jsonStart < 0 || jsonEnd <= jsonStart) throw new Error(`no JSON array in model response for "${lessonTitle}"`);
  // Models occasionally emit trailing commas, which JSON.parse rejects.
  const jsonText = text.slice(jsonStart, jsonEnd + 1).replace(/,\s*([\]}])/g, "$1");
  const parsed = JSON.parse(jsonText) as SeedQuestion[];

  for (const question of parsed) {
    const keys = question.options.map((o) => o.key).join(",");
    if (keys !== "a,b,c,d" || !["a", "b", "c", "d"].includes(question.correctKey)) {
      throw new Error(`malformed question for "${lessonTitle}": ${JSON.stringify(question)}`);
    }
  }
  return parsed;
}

async function applyToDb(drafts: Record<string, { moduleTitle: string; questions: SeedQuestion[] }>) {
  const admin = createAdminClient();

  const { data: course, error: courseErr } = await admin
    .from("courses")
    .select("id")
    .eq("slug", COURSE.slug)
    .single();
  if (courseErr) throw new Error(courseErr.message);

  for (const [slug, draft] of Object.entries(drafts)) {
    const moduleIndex = MODULES.findIndex((m) => m.slug === slug);
    const { data: moduleRow, error: moduleErr } = await admin
      .from("modules")
      .select("id")
      .eq("course_id", course.id)
      .eq("position", moduleIndex)
      .single();
    if (moduleErr) throw new Error(moduleErr.message);

    const { data: existing, error: findErr } = await admin
      .from("assessments")
      .select("id")
      .eq("module_id", moduleRow.id)
      .eq("scope", "module")
      .maybeSingle();
    if (findErr) throw new Error(findErr.message);

    let assessmentId = existing?.id;
    if (!assessmentId) {
      const { data: created, error: createErr } = await admin
        .from("assessments")
        .insert({
          scope: "module",
          module_id: moduleRow.id,
          title: `Module check: ${draft.moduleTitle}`,
          pass_threshold_pct: 70,
          xp_award: 25,
          coin_award: 25,
          shuffle_options: true,
        })
        .select("id")
        .single();
      if (createErr) throw new Error(createErr.message);
      assessmentId = created.id;
    }

    for (const [qi, question] of draft.questions.entries()) {
      const { error: qErr } = await admin.from("questions").upsert(
        {
          assessment_id: assessmentId,
          position: qi,
          stem: question.stem,
          type: "single_select",
          options: question.options,
          correct_key: question.correctKey,
          topic_tag: question.topicTag,
        },
        { onConflict: "assessment_id,position" }
      );
      if (qErr) throw new Error(qErr.message);
    }
    console.log(`applied: ${draft.moduleTitle} — ${draft.questions.length} questions`);
  }
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--apply");
  const apply = process.argv.includes("--apply");
  const root = args[0];
  if (!root) {
    console.error("usage: npm run academy:generate-questions -- <path-to-course-folder> [--apply]");
    process.exit(1);
  }
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");

  const targets = MODULES.filter((m) => m.questions.length === 0);
  if (!targets.length) {
    console.log("every module in academy-course-data.ts already has questions — nothing to do");
    return;
  }
  console.log(`modules needing questions: ${targets.map((m) => m.title).join(", ")}\n`);

  await ensureWhisperModel();
  const anthropic = new Anthropic();
  const scratch = path.join(tmpdir(), `academy-questions-${Date.now()}`);
  await mkdir(scratch, { recursive: true });

  const drafts: Record<string, { moduleTitle: string; questions: SeedQuestion[] }> = {};

  try {
    for (const mod of targets) {
      const moduleDir = path.join(root, mod.folder);
      let entries: string[];
      try {
        entries = await readdir(moduleDir);
      } catch {
        console.warn(`SKIP "${mod.title}" — folder not found: ${moduleDir}`);
        continue;
      }

      const videos = entries
        .filter((f) => /\.mp4$/i.test(f))
        .map((f) => ({ file: f, parsed: parseLessonFilename(f) }))
        .filter((v): v is { file: string; parsed: NonNullable<ReturnType<typeof parseLessonFilename>> } => v.parsed !== null)
        .sort((a, b) => a.parsed.position - b.parsed.position);

      console.log(`module: ${mod.title} (${videos.length} videos)`);
      const questions: SeedQuestion[] = [];
      for (const { file, parsed } of videos) {
        const lessonTitle = parsed.title ?? `${mod.title} — Part ${parsed.position}`;
        const transcript = await transcribe(path.join(moduleDir, file), scratch);
        const drafted = await draftQuestions(anthropic, mod.title, lessonTitle, transcript);
        questions.push(...drafted);
        console.log(`  #${parsed.position} ${lessonTitle} → ${drafted.length} questions`);
      }
      drafts[mod.slug] = { moduleTitle: mod.title, questions };
    }

    await writeFile(DRAFT_PATH, JSON.stringify(drafts, null, 2));
    console.log(`\ndraft written: ${DRAFT_PATH}`);
    console.log("review the questions, then either re-run with --apply or merge them into scripts/academy-course-data.ts");

    if (apply) {
      console.log("\n--apply: seeding gates into the database…");
      await applyToDb(drafts);
      console.log(
        "\nNote: also merge the reviewed questions into scripts/academy-course-data.ts so a future academy:import stays in sync."
      );
    }
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
