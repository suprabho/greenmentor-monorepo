# PRD — Bite-Sized Learning Module (Video → MCQ Assessment)

| | |
|---|---|
| **Document** | Product Requirements Document — module addendum |
| **Version** | 1.0 (draft for review) |
| **Date** | 2026-07-08 |
| **Owner** | Product (Supro) |
| **Status** | Draft |
| **Extends** | `academy/PRD-Academy-Vizmaya.md` §5 (Academy) & §6 (Vizmaya) · `green-mentor-pro/PRD-GreenMentorPro.md` §5.2 (Academy in-course loop) |
| **Target app** | `green-mentor-pro` (learner surface) · `green-mentor-pro/community-engine` (LMS + authoring service) |
| **Design** | myAIcademy MVP — "Phase 1 MVP · mobile" board (Figma `N2f0vO2siiux7qaURINUgV`, node `4084-28394`) |

> **How to read this.** This is an **addendum** that extends the existing Academy PRD, not a replacement. The Academy PRD defines the learner shell, the `Track → Course → Module → Lesson → Quiz` content model, the credit economy, and the myAIcademy screen flow. This document adds the three things that PRD left open or under-specified for the bite-sized loop: (1) **video-first lessons** with an **overall-progress** spine, (2) a **native LMS module inside `community-engine`** that owns courses/enrolment/progress/grading, and (3) the **coins + XP gamification** wiring. Where this document and the Academy PRD disagree, the reconciliation notes below (⟳) are the intended resolution.

---

## 1. Summary

The bite-sized learning module is the core learn-loop of the GreenMentor Academy: a learner opens a **course**, sees their **overall progress**, works through a sequence of **short video lessons**, and each module closes with a **multiple-choice assessment**. Completing lessons and passing assessments drives an **XP + coins** gamification layer (streaks, badges, leaderboard) that is the retention engine.

Three decisions frame this build (confirmed with product):

1. **LMS is built native on Supabase**, as a new module inside the existing `community-engine` app — *not* Moodle/Open LMS. The `open-lms-open-source` org is 100% Moodle plugins written in PHP (GPL); none is drop-in for our Next.js 15 / React 19 / Supabase / TypeScript stack. We **borrow their data-model patterns** (see §7.4) and build our own tables and APIs.
2. **Video is hosted in Supabase Storage.** No third-party video SaaS in v1. We build a lightweight player over signed URLs and track watch-progress client-side into Postgres.
3. **"Coins" = the existing ₹ credits** (1 coin = 1 credit = ₹1, spendable). **XP is separate and non-spendable** (progress/levels/leaderboard only). This keeps **two** currencies total — XP (progress) and coins/credits (spend) — reconciling the deck's credit economy with the myAIcademy coin UI. ⟳ *Supersedes any reading of the Academy PRD that treats "credits" and "coins" as different things.*

The module surfaces in the `green-mentor-pro` learner app (the "Learn" tab / in-course loop) and is **served by** an LMS API + authoring surface living in `community-engine`, which already runs the same stack and the shared GreenMentor Supabase project.

---

## 2. Goals & success metrics

| Goal | Metric | First-milestone target |
|------|--------|------------------------|
| Learners actually watch, not skim | Median lesson video completion (≥90% watched) | ≥ 70% of started lessons |
| Assessments gate real learning | Module assessment pass rate on first attempt | 55–75% (band — too high = too easy) |
| Progress spine drives return | 7-day streak rate among enrolled learners | ≥ 25% (aligns with Academy PRD) |
| Loop completes | Enrolled → module completed (video set + passed MCQ) | ≥ 60% of started modules |
| Course completion | Enrolled → course certificate | ≥ 40% (aligns with Academy PRD) |
| Gamification lands | Learners earning ≥1 badge in first week | ≥ 50% of activated learners |

### Non-goals (this module)

- No AI tutoring / AI generation in the loop (stays in the AI Hub per the green-mentor-pro PRD; "Ask AI" side-panel is a *link-out*, out of scope here).
- No live/cohort teaching, no webinars (separate surfaces).
- No adaptive-difficulty or spaced-repetition engine in v1 (parked — see risks).
- No Moodle/LTI integration (explicitly rejected — native build).
- No third-party video CDN/DRM in v1 (Supabase Storage only).

---

## 3. Personas served (subset)

Carried from the Academy PRD; this module is the daily-driver surface for the first two.

| Persona | In this module | Depth |
|---------|----------------|-------|
| **ESG Explorer** | Free Fundamental course: full video lessons + MCQs; certificate/assessment gated | Light, top-of-funnel |
| **Career Transitioner** | Primary learner — sequential courses, gated modules, certificates | Deep, sequential |
| **Corporate Operator** | Upskills self/team; progress + scores feed cohort reports | Applied |
| **Consultant / Builder** | Advanced courses; credential signalling | Advanced |

---

## 4. The learning loop (end-to-end)

This is the flow the Figma "Phase 1 MVP" board renders. Frame IDs in parentheses map to the design (full map in Appendix A).

```
  Course Overview                 Video Lesson                  MCQ Assessment
  (overall progress)     ─▶       (Supabase Storage)    ─▶      (module gate)
  4084:50135 / 52246              4084:44745 (player)           4084:44479 (quiz)
        │                              │                              │
        │  resume "Continue"          │  ≥90% watched → lesson       │  pass ≥ threshold →
        │  next unlocked node         │  complete → +XP, +coins       │  module complete,
        ▼                              ▼  streak++ (flame 4084:44334) ▼  badge, unlock next
  ┌──────────────────────────────────────────────────────────────────────────┐
  │  Overall progress bar + lesson list (LESSON 1..7) always visible on top    │
  │  Header flame = streak counter · 4-tab bottom nav · progress-tracker bar   │
  └──────────────────────────────────────────────────────────────────────────┘
```

Narratively:

1. **Course Overview** — the spine. A persistent **overall progress** indicator (percent + ring/bar) sits above an ordered **lesson list** (the design shows `LESSON 1…7`, each with title, objective, and key topics). Completed lessons are checked, the current one is highlighted, later ones locked. A **Continue** action resumes the exact lesson/position.
2. **Video Lesson** — a short (3–7 min) video streamed from Supabase Storage with play/pause, scrubber, and a thin **watch-progress bar** (design: `Video` scrubber component). Reaching the watched threshold marks the lesson complete and advances.
3. **MCQ Assessment** — at the end of a module, a **single-select MCQ** quiz. The design shows a **progress-tracker bar + correct-answers counter + close (X)**, one question per screen with **four answer options** and **correct / incorrect** states. Passing the threshold completes the module, awards the badge, and unlocks the next node.
4. **Gamification everywhere** — the header **flame** is the streak counter; XP and coins are awarded on lesson completion and assessment pass; badges and leaderboard update.

---

## 5. Content model additions

Extends the Academy PRD's five-level hierarchy `Track → Course → Module → Lesson → Quiz`. This module makes two things concrete that the Academy PRD left as "blocks" and "quiz":

### 5.1 Lesson becomes video-first

The Academy PRD defined a lesson as an ordered set of *blocks* (concept/example/callout/media/checkpoint/summary). ⟳ For this module, the **primary lesson type is `video`**: a single hosted clip plus optional supporting blocks (a `summary` and an optional `transcript`). The bite-sized "swipeable screens" model still applies to non-video lessons, but the flagship loop the Figma renders is **video → MCQ**.

| Lesson field | Purpose |
|--------------|---------|
| `video_object_path` | Supabase Storage object key for the lesson video (private bucket; served via signed URL). |
| `duration_seconds` | Source duration; used to compute % watched and to display length. |
| `completion_threshold_pct` | % of duration that must be watched to mark complete (default **90**). |
| `poster_object_path` | Thumbnail/poster frame. |
| `transcript` *(optional)* | Text transcript block (accessibility + search). |
| `objective`, `key_topics[]` | Shown in the lesson list (design shows both, e.g. Lesson 3's objective + key topics). |
| `summary_block` | Closing takeaways screen that flows into the assessment. |

### 5.2 Assessment is a first-class module gate

| Assessment field | Purpose |
|------------------|---------|
| `scope` | `lesson` (quick check) or `module` (gate). The gate is what the Figma quiz renders. |
| `question_type` | v1 = `single_select` (four options, per design). Multi-select / true-false / ordering / match / scenario are P1 (Academy PRD §5.2 FR-A-07). |
| `pass_threshold_pct` | Default **70**. Below → review + retry. |
| `max_attempts`, `retry_policy` | e.g. unlimited with a cool-down, or N attempts. |
| `shuffle_options` | Randomise option order per attempt (anti-gaming). |
| `xp_award`, `coin_award` | Gamification payout on pass (see §8). |

Each **question**: stem, 4 options (1 correct in v1), a one-line **explanation** shown on answer (design supports immediate correct/incorrect feedback), and a topic tag.

---

## 6. Functional requirements — learner app (`green-mentor-pro`)

> Priority: **P0** = first milestone · **P1** = engagement depth · **P2** = later.

### 6.1 Overall progress & course overview

| ID | Requirement | Priority | Acceptance criteria |
|----|-------------|----------|---------------------|
| FR-L-01 | Course Overview screen with an **overall progress** indicator (percent complete across the course) | P0 | Progress reflects completed lessons + passed module gates; updates immediately on completion |
| FR-L-02 | Ordered **lesson list** with locked / available / current / complete states, each showing title + objective + key topics | P0 | States render correctly; tapping an available lesson opens it; locked lessons are not enterable |
| FR-L-03 | **Continue / resume** — resumes the exact lesson and last video position | P0 | "Continue" returns the learner to the furthest incomplete lesson at their saved timestamp |
| FR-L-04 | Module-level progress (lessons done / total, gate status) surfaced in overview | P0 | Each module shows x/y lessons and gate pass state |
| FR-L-05 | Persistent header **streak flame** + count; bottom 4-tab navigation | P0 | Flame reflects current streak; nav matches design's four tabs |

### 6.2 Video lesson player (Supabase Storage)

| ID | Requirement | Priority | Acceptance criteria |
|----|-------------|----------|---------------------|
| FR-V-01 | Stream lesson video from a **private Supabase Storage bucket via signed URL** | P0 | Video plays; the object is not publicly listable; signed URL expires |
| FR-V-02 | Player controls: play/pause, seek scrubber, elapsed/total, fullscreen | P0 | All controls work on mobile web; scrubber matches design |
| FR-V-03 | **Watch-progress tracking** — persist furthest-watched position and % watched, throttled (e.g. every 5–10s + on pause/exit) | P0 | Re-opening resumes position; % watched is durable across sessions/devices |
| FR-V-04 | **Completion gate** — lesson marked complete at `completion_threshold_pct` (default 90%); seeking past unwatched content does not fake completion | P0 | Watching to threshold completes; scrubbing to the end without watching does **not** (server validates against recorded watched ranges) |
| FR-V-05 | On completion: award XP + coins, advance to next lesson or module summary, increment streak if first activity today | P0 | Awards logged once (idempotent); next node unlocks; streak logic runs once/day |
| FR-V-06 | Transcript / captions panel (if present) | P1 | Transcript renders and is searchable; captions toggle |
| FR-V-07 | Adaptive quality / bandwidth handling for larger files | P2 | Playback degrades gracefully on slow connections (HLS or multi-rendition — see risks) |

### 6.3 MCQ assessment engine

| ID | Requirement | Priority | Acceptance criteria |
|----|-------------|----------|---------------------|
| FR-Q-01 | Single-select MCQ, one question per screen, four options, with **progress tracker + correct-answers counter + close** | P0 | Matches design; progress advances per question |
| FR-Q-02 | **Immediate feedback** — correct/incorrect state + one-line explanation before advancing | P0 | Every answered question shows correctness + explanation |
| FR-Q-03 | **Scoring + pass threshold** (default 70%) on module gate; results screen with score, XP/coins earned, pass/fail | P0 | Score computed correctly; pass unlocks next module; fail offers review + retry |
| FR-Q-04 | **Retry** on fail per retry policy; option shuffle on each attempt | P0 | Retry re-serves questions with shuffled options; attempts recorded |
| FR-Q-05 | Attempt history persisted (answers, score, timestamp, attempt no.) | P0 | Every attempt is stored and attributable to the learner + assessment |
| FR-Q-06 | Additional question types (multi-select, T/F, ordering, match, scenario) | P1 | Each renders, validates, scores (Academy PRD FR-A-07) |
| FR-Q-07 | Lesson-level quick checks (ungraded, attention keeper) | P1 | Inline check renders mid-lesson; not counted toward gate |

### 6.4 Gamification surfaces (learner-facing)

| ID | Requirement | Priority | Acceptance criteria |
|----|-------------|----------|---------------------|
| FR-G-01 | **Streak** — daily activity increments the header flame; missed day resets (or consumes a streak-freeze if held) | P0 | Streak increments once/day on qualifying activity; reset logic correct |
| FR-G-02 | **XP** awarded on lesson completion + assessment pass; XP drives level | P0 | XP events logged; level derived from cumulative XP |
| FR-G-03 | **Coins** (= credits, ₹1) awarded per the earning schedule; spendable on the shared credits rail | P0 | Coin awards write to the credits ledger; balance is the same everywhere |
| FR-G-04 | **Badges** — module/course completion, streak milestones | P1 | Badge awarded on trigger; shown on profile |
| FR-G-05 | **Leaderboard** — weekly + all-time, from XP | P1 | Ranks update from XP events; weekly board resets |
| FR-G-06 | Awards are **idempotent and anti-gamed** (rate limits, diminishing returns on repeats) | P0 | Re-completing a lesson does not re-award full XP/coins |

---

## 7. LMS module in `community-engine` (native, Supabase)

### 7.1 Why here, and what it is

`community-engine` is already a Next.js 15 / React 19 / Tailwind v4 / Supabase app on the shared GreenMentor Supabase project (`haokazwcljdummkvufcg`), with `@vismay/viz-engine` + `viz-admin` and Playwright PNG export wired in. Today it hosts the community team's **maker tools** (Aura Header Studio, Share Cards). We add an **LMS module** here as the back-office + service layer that:

- **owns the course data** (courses, modules, lessons, videos, assessments, questions),
- **authors/manages** content (the human authoring surface — the Vizmaya "Develop content" job, §6.2 of the Academy PRD),
- **serves** the learner app via an API (course tree, signed video URLs, submit-progress, submit-attempt),
- **records** enrolment, progress, grades, and gamification events under Supabase RLS.

The learner app (`green-mentor-pro`) is the **consumption** surface; `community-engine` is **authoring + LMS API**. Both hit the same Supabase project, so "API" can be thin (shared DB + RLS + a few Edge Functions / route handlers) rather than a separate service tier.

### 7.2 LMS responsibilities

| Capability | Detail |
|------------|--------|
| **Course authoring** | CRUD for Track/Course/Module/Lesson/Assessment/Question. Upload videos to Storage, set thresholds, attach transcripts, define pass thresholds and awards. Validation: a module needs ≥1 lesson; a gate needs ≥1 question; a lesson needs a video or blocks. |
| **Publishing** | draft → review → published (Academy PRD FR-V-06). Only published content appears in the learner app. Versioned. |
| **Enrolment** | Learner ↔ course enrolment records; free vs paid entitlement; cohort tagging for Corporate Operators. Pattern borrowed from Moodle `enrol_programs`. |
| **Progress store** | Per-learner lesson state, video watched-ranges/position, module completion, streak counter. |
| **Gradebook** | Assessment attempts, scores, pass/fail, best/last attempt. Pattern borrowed from Moodle gradebook. |
| **Certificates** | On course completion, generate certificate (reuses Playwright PNG/PDF export already in the app). Pattern borrowed from Moodle `tool_certify`. |
| **Gamification ledger hooks** | Emit XP + coin events on completion/pass; write coins to the shared credits ledger. |
| **Signed media** | Issue short-lived signed URLs for private video objects; validate entitlement before signing. |

### 7.3 Relationship to Vizmaya / Vismay

This LMS module **is the concrete first implementation of Vizmaya's "Develop content" job** for video courses. It authors against the same `Track→Course→Module→Lesson→Quiz` schema and renders through **Vismay** (`@vismay/viz-engine`, already a dependency) for themed screens. It does **not** re-architect Vismay; it configures it. Distribution (lesson→community post, quiz→challenge) and Reports (cohort report, syllabus booklet) remain as Academy-PRD Vizmaya jobs and can consume the same tables later.

### 7.4 What we borrow from `open-lms-open-source` (patterns, not code)

All repos are **Moodle plugins in PHP (GPL)** — architecturally incompatible with our TS/Supabase stack and carrying GPL obligations. We treat them as **reference designs** for battle-tested LMS data models, and reimplement natively:

| Moodle plugin (reference) | What we borrow | Our native equivalent |
|---------------------------|----------------|-----------------------|
| `moodle-enrol_programs` | Program = ordered set of courses with gated progression; assignment/enrolment model | `enrolments` + `learning_paths` + module `unlock` rules in Postgres |
| `moodle-tool_certify` / `certificateelement_programs` | Certification lifecycle: issue on completion, expiry, verification | `certificates` table + Playwright render + public verify URL (Green Learning Profile) |
| Moodle **gradebook** (core concept) | Attempt/score/best-grade model; pass conditions | `assessment_attempts` + computed `grades` |
| `moodle-mod_hsuforum` | Threaded discussion UX around a course (if we add course discussion) | Native community post projection (Academy PRD FR-V-07) — **P2**, only if needed |
| `moodle-mod_livepoll` | Live in-session polling | Community weekly-challenge/poll projection — **P2** |
| `moodle-theme_snap` | Learner-facing IA/nav conventions | Our own design system (myAIcademy-derived) |

**Explicit rejection:** we do **not** run Moodle, LTI 1.3, or any PHP service. GPL + a second runtime + Moodle's data-heavy model is disproportionate for a bite-sized, mobile-first, credits-native product on Supabase.

---

## 8. Gamification — coins + XP wiring

### 8.1 The two currencies (and the one they are not)

| System | What it is | Spendable? | Where it lives |
|--------|-----------|------------|----------------|
| **XP** | Progress / mastery points. Drives **level** and **leaderboard**. Never spent, never bought. | ❌ | `xp_events` ledger → derived level |
| **Coins** | ⟳ **The existing ₹ credits under a friendlier name.** 1 coin = 1 credit = ₹1. Earned by learning, bought via top-up, spent anywhere on the credits rail. | ✅ | The **shared `credit_transactions` ledger** (green-mentor-pro PRD §7) |

There is **no third currency.** "Coins" in the learner UI and "credits" in the wallet/checkout are the **same balance**. This is the reconciliation the product decision fixed.

### 8.2 Earning schedule

Aligns with the platform deck's credit economy (green-mentor-pro PRD §6) and adds the per-lesson/per-quiz values the Academy PRD flagged as unset (Academy PRD open question #3). Values are **proposals for sign-off**.

| Event | XP | Coins (credits) | Notes / anti-gaming |
|-------|----|----|---------------------|
| Lesson video completed (≥ threshold) | +10 | +2 | Once per lesson; repeats award 0 coins, diminished XP |
| Lesson quick-check correct | +2 | 0 | XP only; capped/day |
| Module gate passed | +25 | +25 | Matches deck "module +25"; first pass only |
| Full course completed | +100 | +100 | Matches deck "course +100 bonus" |
| 7-day streak milestone | +50 | +50 | Matches deck "7-day streak +50" |
| Weekly challenge (quiz→community) | +100 | +500 | Matches deck "weekly challenge +500" |
| Perfect assessment (100%) | +15 | 0 | XP bonus only |

> Coins earned spend on the same rail as top-ups (courses, premium library, agent runs). XP never converts to coins. Anti-gaming: idempotent awards keyed on `(user, event_ref)`; diminishing XP on repeated completion of the same unit; daily caps on quick-check XP.

### 8.3 Streaks (the header flame)

- A **qualifying activity** (complete ≥1 lesson **or** pass a gate) on a given day (learner's timezone — Asia/Calcutta by default) increments the streak.
- Missing a day resets to 0, **unless** the learner holds a **streak freeze** (a coin-purchasable / milestone-granted item) which auto-consumes to protect the streak.
- Streak milestones (7/30/100) award the XP+coins bonuses above and a badge.

### 8.4 Badges & leaderboard

- **Badges:** module completion, course completion, streak milestones, perfect assessment, first-course. Rendered on the Green Learning Profile (green-mentor-pro PRD §5.3).
- **Leaderboard:** weekly + all-time, ranked by **XP** (not coins — coins are money-adjacent, ranking by them is gameable/pay-to-win). Feeds the Feed leaderboards.

---

## 9. Data model sketch (new / extended Supabase tables)

RLS by `user_id` throughout; content tables readable by all authenticated users when `status = 'published'`, writable only by authors.

```
-- Content (authored in community-engine, read by learner app)
tracks(id, title, slug, …)
courses(id, track_id, title, level, price_credits, status, cert_template_id, …)
modules(id, course_id, position, title, unlock_rule, …)
lessons(id, module_id, position, type['video'|'blocks'], title,
        objective, key_topics[], video_object_path, poster_object_path,
        duration_seconds, completion_threshold_pct default 90, transcript, summary_block, …)
assessments(id, module_id|lesson_id, scope['module'|'lesson'],
            pass_threshold_pct default 70, max_attempts, shuffle_options,
            xp_award, coin_award, …)
questions(id, assessment_id, position, stem, type default 'single_select',
          options jsonb, correct_key, explanation, topic_tag)

-- Enrolment & progress (per learner)
enrolments(id, user_id, course_id, entitlement['free'|'paid'], cohort_id?, enrolled_at)
lesson_progress(user_id, lesson_id, watched_seconds, furthest_position_s,
                watched_ranges jsonb, pct_watched, completed_at,
                UNIQUE(user_id, lesson_id))
module_progress(user_id, module_id, lessons_done, gate_passed_at, completed_at)
assessment_attempts(id, user_id, assessment_id, attempt_no, answers jsonb,
                    score_pct, passed, started_at, submitted_at)
certificates(id, user_id, course_id, issued_at, verify_slug, pdf_object_path)

-- Gamification
xp_events(id, user_id, event_type, event_ref, xp, created_at)   -- UNIQUE(user_id, event_ref)
streaks(user_id, current_len, longest_len, last_active_date, freezes_held)
badges_awarded(user_id, badge_key, awarded_at)
-- Coins reuse the EXISTING shared ledger:
credit_transactions(user_id, type['earn'|'topup'|'spend'], amount, ref, created_at)
```

Notes:
- **Video anti-cheat:** completion is validated server-side against `watched_ranges` (union of watched intervals), not the client's claimed `pct`. Seeking to the end does not fill the ranges.
- **Idempotency:** `xp_events.event_ref` and the coin `credit_transactions.ref` are unique per (user, unit) so re-completion cannot double-award.
- Content tables are **Vizmaya-owned**; progress/gamification are learner-owned — matching the ownership split in the green-mentor-pro PRD §8.

---

## 10. Screens (mapped to Figma "Phase 1 MVP · mobile")

| # | Screen | Figma frame(s) | Key elements |
|---|--------|----------------|--------------|
| 1 | **Course Overview** (overall progress) | `4084:50135`, `4084:52246`, `4084:52386` | Overall progress ring/bar, lesson list (LESSON 1–7 with objective + key topics), Continue, streak flame header, 4-tab nav |
| 2 | **Lesson navigation / list** | `4084:52260` (expanded LESSON 1–7) | Per-lesson title, objective, key topics; lock/complete states |
| 3 | **Video Player** | `4084:44745`, `4084:44759`, `4084:50139` | Video surface, play button, media controls, scrubber + watch-progress bar, lesson title |
| 4 | **MCQ Assessment — question** | `4084:44479`, `4084:44525`, `4084:44571` | Progress-tracker bar, correct-answers counter, close (X), question, 4 options, correct/incorrect states |
| 5 | **Assessment — result** | `4084:50137` (Assessment), `4084:44617` | Score, pass/fail, XP/coins earned, retry/continue |
| 6 | **Streak / gamification affordance** | header `info-details-flame` (`4084:44334`) | Flame + streak count, celebratory states |

*(The board's node scale is ~17735×9341 — it holds the full myAIcademy MVP; the frames above are the bite-sized-loop subset relevant to this PRD.)*

---

## 11. Technical approach

Consistent with `green-mentor-pro` PRD §9 and the `community-engine` stack (per its `package.json`/README):

- **Frontend:** Next.js 15 App Router, React 19, TypeScript strict, **Tailwind v4**, **Phosphor icons** (per your standing preference and both apps' existing deps), Framer Motion for the loop transitions.
- **Video:** HTML5 `<video>` over **signed Supabase Storage URLs** from a private bucket; a small progress hook posts watched-ranges to Postgres (throttled). No third-party player SDK in v1.
- **Backend:** Supabase Postgres + RLS + Auth + Storage; route handlers / Edge Functions in `community-engine` for authoring, signing URLs, submitting progress/attempts, and awarding.
- **Rendering:** Vismay (`@vismay/viz-engine`) for themed lesson/quiz scenes; Playwright (already present) for certificate PNG/PDF export.
- **Auth:** shared Supabase Auth session across both apps (single account, green-mentor-pro PRD §7).
- **Payments/coins:** coins write to the existing `credit_transactions` ledger; top-ups via Razorpay (already in `green-mentor-plus`).

---

## 12. Phasing

| Phase | Learner app | LMS (`community-engine`) | Gamification |
|-------|-------------|--------------------------|--------------|
| **P0 — Core loop** | Course Overview + overall progress, lesson list with states, video player w/ resume + 90% completion gate, single-select MCQ gate with feedback + retry, results | Course/module/lesson/assessment authoring, Storage video upload, publish workflow, enrolment, progress + attempts store, signed URLs | XP + coins on completion/pass, streak flame, idempotent awards |
| **P1 — Depth** | Transcript/captions, lesson quick-checks, more question types, leaderboard, badges UI | Gradebook views, certificate generation (`tool_certify` pattern), cohort tagging | Badges, weekly leaderboard, streak freezes |
| **P2 — Reach** | Adaptive video quality, offline/study-guide export | Community projection (post/challenge via `hsuforum`/`livepoll` patterns), cohort reports, syllabus booklet | Weekly challenge (quiz→community, +500) |

**Dependencies:** at least **one full course authored** (video + modules + gates) gates P0 usefulness · shared credits ledger must exist for coin awards · Supabase Storage bucket + RLS policies before video P0.

---

## 13. Analytics & events

Instrument to the §2 metrics: `lesson_started`, `video_progress` (throttled), `lesson_completed`, `assessment_started`, `question_answered` (correct/incorrect), `assessment_submitted` (score, passed), `module_completed`, `course_completed`, `streak_incremented`, `xp_awarded`, `coins_awarded`, `badge_awarded`, `certificate_issued`. Watch-completion funnel and first-attempt pass-rate are the two health dashboards.

---

## 14. Risks & open questions

1. **Video completion honesty.** Client-reported % is spoofable; we validate against server-side watched-ranges — but this needs a concrete anti-scrub spec (min contiguous coverage, tolerance). *Owner: eng.*
2. **Supabase Storage as video host.** Fine for short clips at modest scale; large files / high concurrency may need HLS multi-rendition or a CDN later. v1 accepts single-rendition MP4 with a size ceiling. **Confirm max lesson length / file size.**
3. **Pass-threshold calibration.** 70% default and first-attempt band (55–75%) need tuning against real question difficulty; too-high pass = trivially easy content.
4. **Coin/credit unification messaging.** UI must never imply coins and credits are different balances; naming/UX review needed before launch.
5. **Streak-freeze economics.** Price (in coins) and grant rules for freezes are unset.
6. **Retry policy.** Unlimited-with-cooldown vs N-attempts — affects gaming and coin awards. **Confirm.**
7. **Authoring effort.** Native LMS authoring in `community-engine` is real build work; scope the P0 author UI tightly (forms over the schema, not a rich WYSIWYG).
8. **Question types in P0.** Design shows single-select four-option; confirm P0 is single-select-only (recommended) with others at P1.

### Open questions for sign-off
- Max video length / file-size ceiling for Supabase Storage v1?
- Retry policy + max attempts on module gates?
- Streak-freeze pricing and grant rules?
- Confirm per-lesson (+10 XP / +2 coins) and per-quiz values in §8.2.
- Does a course need a discussion/forum surface at launch, or is that P2 (`hsuforum` pattern)?

---

## Appendix A — Figma frame → screen map

| Figma frame id | Name | Maps to |
|----------------|------|---------|
| `4084:50135`, `4084:52246`, `4084:52386` | Course Overview | Course Overview / overall progress |
| `4084:52260` | Lesson navigation (LESSON 1–7 expanded) | Lesson list |
| `4084:44745`, `4084:44759`, `4084:50139` | Video Player | Video lesson |
| `4084:44479`, `4084:44525`, `4084:44571`, `4084:44617` | progress-tracker/quiz/correct-answers | MCQ assessment |
| `4084:50137` | Assessment | Assessment brief/result |
| `4084:44334` (`info-details-flame`) | Flame + count | Streak counter |
| `4084:44340` etc. | 4× Tab item | Bottom navigation |

## Appendix B — `open-lms-open-source` assessment

The org is a **Moodle plugin ecosystem, ~70 repos, all PHP (GPL)**. Most-relevant repos and our decision:

| Repo | Stars | Relevance | Decision |
|------|-------|-----------|----------|
| `moodle-enrol_programs` | ~10 | Program enrolment + gated pathways | **Reference** our `enrolments`/`learning_paths` |
| `moodle-tool_certify` | ~0 | Certification lifecycle | **Reference** our `certificates` |
| `moodle-mod_hsuforum` | ~13 (47 forks) | Enhanced course forum | **Reference** community projection (P2) |
| `moodle-mod_livepoll` | ~2 | Live polling | **Reference** weekly challenge (P2) |
| `moodle-theme_snap` | ~87 | Learner theme/IA | **Reference** only; we use our own DS |
| `moodle-mod_mediagallery` / `lightboxgallery` | 7 / 30 | Media resources | Not needed |

**Bottom line:** valuable as **domain-model references**; not adoptable as code given PHP/Moodle runtime + GPL. Build native on Supabase (product decision).
