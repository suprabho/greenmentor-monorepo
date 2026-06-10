# GreenMentor Academy + Vizmaya — Detailed Scope

> **Status:** Draft scope for review · **Date:** 2026-06-09 · **Owner:** Product
> **Sources:** `GreenMentor_Platform_v4` deck · myAIcademy MVP (Figma) · `BUILD_PLAN.md` (single-source → multi-view pattern)
>
> **Scope boundary — read first.** This document deliberately **excludes everything AI- and tooling-related**: no AI agents, no Orchestrator/BRSR/Materiality/Scope-3/Policy agents, no LongSight execution environment, no AI intent-detection, no AI tutor ("Call with Amy"), no AI report-drafting. Those live in a separate scope. Here we define two things only:
>
> 1. **GreenMentor Academy** — bite-sized lessons and quizzes, structured like myAIcademy.
> 2. **Vizmaya** — the authoring + distribution layer (built on the **Vismay** engine) that produces academy content, pushes it to the community, and generates reports/docs from that same content.

---

## 1. The two systems and how they relate

| Layer | What it is | Role in this scope |
|-------|------------|--------------------|
| **Vismay engine** | Promad's underlying rendering/scene substrate (animated backgrounds, scene configs, theming, layout primitives). | The *runtime that draws things*. Academy screens, community cards, and generated docs all render **through** Vismay. We treat it as a fixed substrate — we configure it, we don't redefine it here. |
| **Vizmaya** | The authoring + distribution + report-generation **product** built on Vismay. | The *content pipeline*. One authored source becomes (a) academy lessons + quizzes, (b) community posts, (c) exportable reports/docs. This is the new thing we are defining. |
| **GreenMentor Academy** | The learner-facing experience inside the app. | The *primary consumption surface* for Vizmaya content. Modeled screen-for-flow on myAIcademy. |

The mental model: **Vizmaya authors once → Vismay renders everywhere → Academy + Community + Reports consume the same source.** This is the same single-source/multi-output principle proven in `BUILD_PLAN.md` (one `response.md` → slides + booklet + landing + PDF), generalized into a content engine.

---

## 2. What we carry over from the platform deck (minus AI)

The deck defines the business; the Academy is one pillar of it. Carried into this scope:

- **Four personas** — ESG Explorer (free, top of funnel), Career Transitioner (primary course revenue), Corporate Operator (company-billed), Consultant/Builder (charges clients). The Academy must serve all four with different content depth.
- **Credit economy** — 1 credit = ₹1, minimum top-up ₹1,000, starter credits on signup. Courses ₹2,000 / ₹4,000 / ₹7,000 (beginner/intermediate/advanced). Earning events (webinar +50, module +25, full course +100 bonus, referral +200, 7-day streak +50, weekly challenge +500, expert answer +100).
- **Certifications** — premium live cohort programs (e.g. PGC INES at ₹2,00,000); completion shown on public profile.
- **Free-forever layer** — community and live webinars. The Academy's free tier (Explorer content) sits here.
- **Gamification** — streaks, badges, leaderboards (present in both the deck and myAIcademy).

Explicitly **not** carried over: the AI agents, LongSight workflows, AI intent-detection, the three agent-task payment prompts, and the autonomous-workforce narrative. Course *purchase* and *credit* mechanics stay; agent execution does not.

---

## 3. GreenMentor Academy — Information Architecture

### 3.1 Content model

A five-level hierarchy. This is the schema Vizmaya authors against (Section 6) and the app renders.

```
Track            e.g. "ESG Foundations", "BRSR Practitioner", "GHG Accounting"
 └─ Course       e.g. "BRSR Fundamentals"  (priced: beginner/intermediate/advanced or free)
     └─ Module   a themed unit, ~20–40 min total   (the unlockable step on the learning path)
         └─ Lesson   a single bite-sized screen-set, 3–7 min  (the atomic learning unit)
             └─ Quiz   1–N check questions attached to the lesson and/or module
```

Supporting entities:

- **Learning path** — the ordered sequence of modules a learner walks (myAIcademy's path/map metaphor). Linear with unlocks; later modules gated by completing earlier ones or passing the gate quiz.
- **Skill / topic tags** — every lesson tagged (e.g. `scope-3`, `materiality`, `BRSR`, `governance`) to drive recommendations and the topic tiles.
- **Credential** — issued at course/certification completion; surfaces as a badge on the public profile.
- **Progress record** — per learner: lesson state (locked / available / in-progress / complete), quiz scores, streak counter, XP/credits earned.

### 3.2 Lesson format (the "bite-sized" definition)

Each **Lesson** is a short, swipeable set of *screens* (not a long article and not a long video). A lesson is built from an ordered list of **blocks**, each block being one of a fixed set of types:

| Block type | Purpose |
|------------|---------|
| `concept` | One idea, one screen: heading + short body + supporting visual (rendered via Vismay scene/illustration). |
| `example` | A worked, concrete instance (e.g. "Here's how a textile firm classifies a Scope 3 category"). |
| `callout` | A highlighted definition, regulation reference, or "remember this". |
| `media` | Image / diagram / short recorded clip (non-AI; pre-produced). |
| `checkpoint` | An inline single question to keep attention (lightweight, not graded). |
| `summary` | Closing recap screen with the 2–3 takeaways → flows into the quiz. |

Design rules (from the build plan's slide principles, adapted to mobile): one idea per screen, large headings, generous whitespace, max ~6 bullet equivalents, visual hierarchy by size not just color.

### 3.3 Quiz engine

Quizzes are first-class, attached at lesson level (quick check) and module level (gate). Question types:

- **Single-select MCQ** — the default.
- **Multi-select** — "select all that apply".
- **True/False**.
- **Ordering / sequence** — e.g. order the steps of a materiality assessment.
- **Match pairs** — e.g. match emission to its Scope.
- **Scenario** — a short prompt + MCQ (applied judgement).

Quiz behaviors (mirroring myAIcademy's gamified practice flow with a mascot):

- Immediate per-question feedback (correct/incorrect + one-line explanation).
- A mascot/character reacts (GreenMentor-themed mascot, e.g. a sustainability character) — encouragement on correct, gentle retry on wrong.
- Score + XP/credits awarded at the end; streak incremented.
- **Pass threshold** on module gate quizzes (e.g. 70%); below threshold → review prompt, retry allowed.
- Results feed the leaderboard and badges.

### 3.4 Navigation / app IA

Bottom-tab structure (consumption surfaces; community + webinars are the free top-of-funnel):

```
[ Learn ]  [ Community ]  [ Webinars ]  [ Jobs ]  [ Profile ]
```

The **Learn** tab is the Academy home. Its sub-structure:

- **Home / "Continue"** — resume current lesson, today's streak, recommended next.
- **My Learning** — enrolled courses, progress rings, certificates in progress.
- **Explore / Catalog** — tracks, courses, topic tiles, search & filter.
- **Learning Path / Map** — the visual ordered map of modules with unlock states.

---

## 4. Academy — key screens

Mapped to the myAIcademy MVP sections (Figma bands shown in parentheses). Each screen below is a "key screen"; per-state exhaustive specs are deferred to design handoff.

### 4.1 Entry & onboarding *(Intro · Login/Signup · Onboarding · Suggestion)*

1. **Intro / splash** — brand, single CTA to begin.
2. **Login / Signup** — phone/email + OTP; "download to join" is the registration gate from the deck's flywheel. Starter credits granted on first signup.
3. **Onboarding personalization** (the long myAIcademy band — ~10–14 steps): goal ("get BRSR done" / "switch careers into ESG" / "upskill my team" / "just exploring"), current level, role, topics of interest, time-per-day commitment. Output = persona inference + initial recommendations.
4. **Suggestion / recommended path** — "Based on your goals, start here": 1 recommended track + 2–3 alternates, each a course card.

### 4.2 Catalog & course detail *(topic tiles · Course detail · Live vs Self-Paced)*

5. **Topic tiles / category grid** — colorful topic cards (myAIcademy's category band) → filtered course lists.
6. **Course detail** — title, outcome, module list with durations, price in credits, what you'll earn (badge/credential), enroll CTA. Shows free vs paid clearly.
7. **Live vs Self-Paced choice** — for courses offered both ways: self-paced lessons *or* a live cohort (certifications). Self-paced is the default Academy mode; live routes to webinar/cohort scheduling.

### 4.3 Learning & lessons *(Self-Paced · Learning path)*

8. **Learning path / map** — vertical map of modules; current node highlighted, future nodes locked, completed nodes checked.
9. **Module overview** — lessons in the module, est. time, the gate quiz at the end.
10. **Lesson player** — the bite-sized swipeable block sequence (Section 3.2); progress bar across the top; "next" advances blocks; exits to summary → quiz.
11. **Lesson summary** — recap takeaways + "Start quiz" CTA.

### 4.4 Quiz & feedback *(Gamification/Practice · Leaderboard · Course Rating)*

12. **Quiz screen** — one question per screen, answer, immediate feedback, mascot reaction.
13. **Quiz results** — score, XP/credits earned, streak update, pass/fail on gate quizzes, retry or continue.
14. **Leaderboard** — weekly/all-time ranks (cohort + global), drives the weekly-challenge credit reward.
15. **Badges / achievements** — earned credentials and streak milestones.
16. **Course rating** — post-completion rating + short feedback (myAIcademy's rating band).

### 4.5 Economy, account, retention *(Payment · WhatsApp · Settings · Profile)*

17. **Credit wallet** — balance, top-up (min ₹1,000), transaction history, earn-more prompts.
18. **Payment** — credit purchase + paid-course/certification checkout. Personal wallet vs company-billed vs charge-to-client routing is *selected here* but the agent-task payment prompts are out of scope — only course/credit purchase applies in the Academy.
19. **WhatsApp touchpoints** — lesson reminders, streak nudges, new-content alerts (myAIcademy's WhatsApp band) — retention channel, not a content surface.
20. **Settings** — notifications, account, billing details, privacy.
21. **Public profile** — earned credentials, completed courses, streak, leaderboard standing; the credibility artifact referenced in the deck (visible to employers via the Jobs tab).

---

## 5. The Vismay engine — what we rely on (not redefine)

Vismay is treated as the **rendering substrate**. The Academy and Vizmaya depend on it for:

- **Scene/background rendering** — themed animated backgrounds and illustration scenes behind onboarding, lesson screens, and quiz states (the GreenMentor palette: greens/earth tones rather than myAIcademy's blue).
- **Theming & tokens** — a single GreenMentor theme (color, type scale, spacing) consumed everywhere, so Academy screens, community cards, and exported docs stay visually consistent.
- **Layout primitives** — the block/card/screen rendering used by the lesson player and by Vizmaya's output renderers.

We do **not** redesign Vismay here. The deliverable to Vismay is a **GreenMentor theme + scene set** (palette, mascot, lesson/quiz scene presets). That is a configuration task, not an engine change.

---

## 6. Vizmaya — authoring, distribution, report generation

Vizmaya is the new build. It has three jobs, all driven from **one content source per unit**.

### 6.1 Single-source content model

Following the `BUILD_PLAN.md` pattern (one structured markdown → many rendered views), each authored unit (lesson, module, or report) is **one structured source document** with a defined schema, parsed once into typed data, then rendered into multiple targets. The author writes the content once; Vizmaya produces every output.

Authoring source (illustrative, structured-markdown convention — same family as the build plan's parser):

```
## unit: brsr-intro-01
- type: lesson
- track: brsr-practitioner
- course: brsr-fundamentals
- module: brsr-basics
- tags: BRSR, regulation, disclosure
- credits-on-complete: 25

### concept: What BRSR is
SEBI's Business Responsibility & Sustainability Reporting...

### example: A textile firm's first disclosure
...

### callout: Who must file
Top 1000 listed companies by market cap.

### quiz
#### mcq: Which body mandates BRSR?
- option: SEBI | correct
- option: RBI
- option: MCA
- explanation: SEBI mandates BRSR for the top 1000 listed companies.

### summary
Three things to remember: ...
```

A **parser → typed model → renderers** chain (directly analogous to the build plan's `parser.ts → types.ts → SectionRenderer`) turns this into the three outputs below.

### 6.2 Job 1 — Develop content (authoring)

- **Authoring workspace** — where content authors create/edit units against the schema above. Validation: every lesson needs ≥1 quiz, every block has required fields, tags resolve to known topics.
- **Content library** — versioned store of all units, organized by track/course/module. Reuse: a lesson can appear in multiple courses; a quiz bank is shared.
- **Preview** — render-as-learner preview (lesson player + quiz) before publish, drawn via Vismay so authors see the true result.
- **Publish workflow** — draft → review → published, with the published version feeding the live Academy.

(Note: authoring is **human** in this scope. No AI generation.)

### 6.3 Job 2 — Distribute to the community

The same source unit can be projected onto community surfaces without re-authoring:

- **Lesson → community post** — a "concept of the day" card pulled from a lesson's `concept`/`callout` block, posted to the relevant topic channel.
- **Quiz → community challenge** — a quiz question becomes a weekly challenge / poll in community (ties to the +500 weekly-challenge credit reward).
- **Course → announcement** — new course/module publish auto-drafts a community + WhatsApp announcement.
- **Webinar → recap unit** — a webinar can be captured as a unit and distributed back as a recap card + replay link.

Distribution is a **projection** of the content model onto community/WhatsApp formats — one source, many placements. Channel targeting, scheduling, and topic routing are configured per unit.

### 6.4 Job 3 — Generate reports & docs from content

The third Vizmaya output: turn content (and a learner's/cohort's progress over that content) into **shareable documents**, reusing the build plan's multi-format export (slides / booklet / PDF) approach.

Document types in scope:

- **Course completion certificate** (PDF) — learner, course, credential, date, verifiable profile link.
- **Cohort / learning report** (PDF or booklet) — for Corporate Operators: which team members completed which modules, quiz scores, time invested. The "proof of upskilling" artifact.
- **Course syllabus / curriculum doc** — the authored track/course rendered as a polished booklet (sales/enablement collateral).
- **Content pack export** — a module's lessons rendered to a printable study guide for offline use.

All of these are **renders of the existing content model + progress data** — no separate authoring, no AI drafting. Export mechanics mirror the build plan: structured data → HTML render (Vismay-themed) → PDF/booklet.

---

## 7. How it all connects (end-to-end)

```
                    ┌─────────────────────────────┐
                    │   VIZMAYA  (authoring)       │
                    │   one structured source per  │
                    │   lesson / module / report   │
                    └──────────────┬──────────────┘
                                   │ parse → typed content model
            ┌──────────────────────┼──────────────────────┐
            ▼                      ▼                       ▼
   ┌─────────────────┐   ┌──────────────────┐   ┌────────────────────┐
   │  ACADEMY         │   │  COMMUNITY        │   │  REPORTS / DOCS     │
   │  lessons+quizzes │   │  posts·challenges │   │  certs·cohort·PDF   │
   │  (Learn tab)     │   │  ·announcements   │   │  ·syllabus booklet  │
   └────────┬────────┘   └─────────┬────────┘   └──────────┬─────────┘
            └──────────────────────┴──────────────────────┘
                                   │ all rendered through
                                   ▼
                        ┌─────────────────────┐
                        │   VISMAY engine      │
                        │   theme · scenes ·   │
                        │   layout primitives  │
                        └─────────────────────┘
```

Progress, credits, badges, and the public profile are the connective tissue: consuming Academy content earns credits/credentials, which surface in community and on the profile, which feed the report/doc outputs.

---

## 8. Phasing (Academy + Vizmaya only)

| Phase | Academy | Vizmaya |
|-------|---------|---------|
| **P0 — Foundations** | Onboarding, login, catalog, course detail, lesson player, single-select quiz, credit wallet, course purchase. GreenMentor theme on Vismay. | Content schema + parser, authoring workspace (manual), publish workflow, one course authored end-to-end. |
| **P1 — Engagement** | Learning path/map, full quiz types, streaks, badges, leaderboard, course rating, WhatsApp reminders, public profile. | Lesson→community post projection, quiz→weekly challenge, completion certificate (PDF). |
| **P2 — Depth & proof** | Live-vs-self-paced, certification cohort enrollment surface. | Cohort/learning report, syllabus booklet, content-pack export; webinar→recap unit. |

---

## 9. Open questions for sign-off

1. **Mascot** — does GreenMentor want a named character (myAIcademy uses one in quizzes/gamification)? If yes, naming + visual design is a Vismay scene-set task.
2. **Authoring schema** — confirm structured-markdown (build-plan style) vs a block-based DB schema. Markdown is faster to start and matches the proven pattern; a DB schema scales better for reuse/versioning. Recommend starting markdown-first.
3. **Credit values for quizzes/challenges** — the deck locks course/webinar/streak credits; per-quiz and per-challenge values still need numbers.
4. **Offline / study-guide export** — is the printable content-pack a P2 need or later?
5. **Profile visibility** — what's public vs cohort-only on the credential profile (ties into the Jobs tab and Corporate Operator reporting)?

---

### Appendix — myAIcademy section → GreenMentor Academy mapping

| myAIcademy band (Figma) | GreenMentor Academy equivalent |
|--------------------------|-------------------------------|
| Intro screen | Intro / splash |
| Login / Signup | Login / Signup (registration gate) |
| Onboarding (long band) | Goal/level/topic personalization |
| Suggestion | Recommended path |
| Topic tiles | Catalog category grid |
| Live vs Self-Paced | Self-paced default + live cohort route |
| Live class view | Webinar / cohort session (links out) |
| Payment | Credit wallet + course checkout |
| WhatsApp | Reminder / retention touchpoints |
| Leaderboard | Leaderboard (weekly challenge) |
| Gamification (mascot) | Quiz feedback + badges + streaks |
| Course Rating | Post-completion rating |
| Settings | Settings |
| Course detail / home feed | Course detail + Learn home |
| "Call with Amy" (AI tutor) | **Out of scope (AI)** |
