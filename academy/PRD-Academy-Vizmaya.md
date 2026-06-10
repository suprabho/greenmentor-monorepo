# PRD — GreenMentor Academy + Vizmaya

| | |
|---|---|
| **Document** | Product Requirements Document |
| **Version** | 1.0 (draft for review) |
| **Date** | 2026-06-09 |
| **Owner** | Product |
| **Status** | In review |
| **Related** | `academy/SCOPE-Academy-Vizmaya.md` · `GreenMentor_Platform_v4` deck · myAIcademy MVP (Figma) · `BUILD_PLAN.md` |

> **Scope boundary.** This PRD covers **only** the GreenMentor Academy (bite-sized lessons + quizzes) and **Vizmaya** (the content authoring + distribution + report-generation layer built on the **Vismay** engine). It deliberately **excludes all AI and tooling**: AI agents, Orchestrator/BRSR/Materiality/Scope-3/Policy agents, the LongSight execution environment, AI intent-detection, the AI tutor ("Call with Amy"), and AI report-drafting. Those are a separate PRD.

---

## 1. Summary

GreenMentor is shifting from selling standalone knowledge to selling access, credibility, and outcomes. The Academy is the credibility engine: it turns ESG Explorers into paying Career Transitioners and upskills Corporate Operators, all through short, gamified lessons and quizzes — structured like myAIcademy. **Vizmaya** is the content system behind it: author a unit once, then render it as an Academy lesson, project it into the community, and export it as a report or document. **Vismay** is the rendering engine all three ride on.

The problem this solves: today, course content, community content, and learner reports are produced separately and inconsistently. Vizmaya makes one authored source the single origin for all three, and the Academy gives that content a polished, retention-driven home.

---

## 2. Goals & success metrics

| Goal | Metric | Target (first milestone window) |
|------|--------|---------------------------------|
| Convert free learners to paid courses | Free → paid course conversion | ≥ 8% of activated learners |
| Drive learning habit | 7-day streak rate among enrolled learners | ≥ 25% |
| Prove content efficiency | Time from authored unit → live in Academy + Community | < 1 day, single author action |
| Credential value | Course completion rate (enrolled → certificate) | ≥ 40% |
| Reporting utility | Corporate Operators generating a cohort report | ≥ 3 within milestone window |

### Non-goals

- No AI generation, AI tutoring, or AI workflow execution anywhere in this PRD.
- No standalone web LMS — Academy lives inside the GreenMentor app.
- Vizmaya does **not** replace or re-architect the Vismay engine; it configures and consumes it.
- Jobs platform, consulting tooling, and ESG data product are out of scope except where the Academy's public profile feeds them.

---

## 3. Personas (from the platform deck)

| Persona | In the Academy | Content depth | Monetization |
|---------|----------------|---------------|--------------|
| **ESG Explorer** | Free beginner lessons, taster quizzes | Light | Free → conversion |
| **Career Transitioner** | Primary learner: full courses + certifications | Deep, sequential | Courses ₹2k–7k + certs |
| **Corporate Operator** | Upskills self + team; needs proof | Applied, role-based | Company-billed + cohort reports |
| **Consultant / Builder** | Upskills, signals credibility | Advanced | Charges client / personal |

---

## 4. Product overview

Three layers, one content source:

- **Vismay (engine, existing):** themed scene/background rendering, design tokens, layout primitives. Treated as a fixed substrate; deliverable to it is a GreenMentor theme + scene set.
- **Vizmaya (new):** authoring workspace + content library + three renderers (Academy, Community, Reports). One structured source per unit, parsed once, rendered many ways — the `BUILD_PLAN.md` single-source/multi-output pattern generalized.
- **Academy (new, app):** the learner experience — onboarding, catalog, lesson player, quiz engine, gamification, wallet, profile. Screen flow modeled on myAIcademy.

---

## 5. Academy requirements

### 5.1 Content model

Five-level hierarchy: **Track → Course → Module → Lesson → Quiz**, plus learning path (ordered, gated modules), topic tags, credentials, and per-learner progress records. Defined fully in the scope doc §3.1.

### 5.2 Functional requirements — Academy

> Priority: **P0** = first milestone (foundations) · **P1** = engagement · **P2** = depth/proof.

| ID | Requirement | Priority | Acceptance criteria |
|----|-------------|----------|---------------------|
| FR-A-01 | Account creation via phone/email + OTP; starter credits granted on first signup | P0 | New user can register and reach onboarding; starter credit balance is non-zero and logged |
| FR-A-02 | Onboarding personalization (goal, level, role, topics, time/day) | P0 | Completing onboarding stores preferences and produces ≥1 recommended track |
| FR-A-03 | Catalog browse with topic tiles, search, and filter | P0 | User can find a course by topic tag and by free-text search |
| FR-A-04 | Course detail with modules, durations, price in credits, and credential earned | P0 | Free vs paid is unambiguous; enroll CTA reflects entitlement |
| FR-A-05 | Lesson player rendering ordered blocks (concept/example/callout/media/checkpoint/summary) | P0 | A lesson advances block-by-block with a progress indicator and exits to summary |
| FR-A-06 | Quiz engine — single-select MCQ with immediate feedback + explanation | P0 | User answers, sees correct/incorrect + one-line explanation, receives score at end |
| FR-A-07 | Quiz types: multi-select, true/false, ordering, match, scenario | P1 | Each type renders, validates, and scores correctly |
| FR-A-08 | Module gate quiz with pass threshold and retry | P1 | Below-threshold score blocks unlock and offers review + retry |
| FR-A-09 | Learning path / map with locked / available / complete states | P1 | Completing a module unlocks the next node visually and functionally |
| FR-A-10 | Credit wallet: balance, top-up (min ₹1,000), transaction history | P0 | All earn/spend events appear in history with correct balance math |
| FR-A-11 | Course/certification checkout via credits (personal / company / client routing select) | P0 | Purchase deducts correctly and grants entitlement; routing choice recorded |
| FR-A-12 | Gamification: streaks, XP/credits on completion, badges | P1 | Daily activity increments streak; completions award the configured credits and badges |
| FR-A-13 | Leaderboard (weekly + all-time, cohort + global) | P1 | Ranks update from quiz/challenge activity; weekly winner eligible for reward |
| FR-A-14 | Post-completion course rating + feedback | P1 | Rating is captured and attributed to the course |
| FR-A-15 | WhatsApp retention touchpoints (reminders, streak nudges, new-content alerts) | P1 | Opted-in users receive scheduled reminders; opt-out respected |
| FR-A-16 | Public profile: credentials, completed courses, streak, leaderboard standing | P1 | Profile renders earned credentials; visibility settings respected |
| FR-A-17 | Live-vs-self-paced choice; certification cohort enrollment surface | P2 | Self-paced is default; live route links to webinar/cohort scheduling |

### 5.3 Key user stories

- **As an ESG Explorer**, I want to try a free lesson and quiz in under five minutes so I can decide whether to invest.
  *Acceptance:* free lesson reachable within 2 taps of catalog; completes with a score and a "continue learning" prompt.
- **As a Career Transitioner**, I want a clear path of modules with unlock gates so I always know what to do next.
  *Acceptance:* path shows current node, next locked node, and the gate quiz required to advance.
- **As a Corporate Operator**, I want my completed courses to produce a shareable credential so I can prove progress to my CFO.
  *Acceptance:* completing a course generates a certificate (see FR-V-09).
- **As any learner**, I want immediate quiz feedback with a short explanation so I learn from mistakes, not just see a score.
  *Acceptance:* every question shows correct/incorrect + explanation before advancing.

### 5.4 Screens

21 key screens, mapped band-for-band to the myAIcademy Figma (full list in scope doc §4 and appendix). Grouped as: entry & onboarding, catalog & course detail, learning & lessons, quiz & feedback, economy/account/retention.

---

## 6. Vizmaya requirements

### 6.1 Single-source principle

Each unit (lesson, module, or report) is **one structured source document**, parsed once into a typed model, then rendered to Academy, Community, and Report targets. No content is authored twice. (Pattern proven in `BUILD_PLAN.md`: one `response.md` → slides + booklet + landing + PDF.)

### 6.2 Functional requirements — Vizmaya

| ID | Requirement | Priority | Acceptance criteria |
|----|-------------|----------|---------------------|
| FR-V-01 | Content schema + parser (structured source → typed model) | P0 | A sample lesson source parses into Track/Course/Module/Lesson/Quiz with all blocks |
| FR-V-02 | Authoring workspace to create/edit units against the schema | P0 | Author can create a lesson with blocks + quiz and save it |
| FR-V-03 | Validation (lesson needs ≥1 quiz; required block fields; tags resolve) | P0 | Invalid unit cannot be published; errors are specific |
| FR-V-04 | Content library: versioned, organized by track/course/module, reusable units | P1 | A lesson/quiz can be reused across courses; versions are retained |
| FR-V-05 | Render-as-learner preview via Vismay before publish | P0 | Preview matches the live lesson player output |
| FR-V-06 | Publish workflow (draft → review → published) feeding the live Academy | P0 | Publishing a unit makes it appear in the Academy; drafts do not |
| FR-V-07 | Distribution: lesson → community post projection | P1 | A concept/callout block can be posted to a topic channel without re-authoring |
| FR-V-08 | Distribution: quiz → community weekly challenge/poll | P1 | A quiz question publishes as a challenge tied to the reward |
| FR-V-09 | Reports: course completion certificate (PDF) | P1 | Completion generates a PDF with learner, course, credential, date, profile link |
| FR-V-10 | Reports: cohort/learning report (PDF/booklet) | P2 | Operator can export team completions, scores, and time invested |
| FR-V-11 | Reports: syllabus/curriculum booklet from a course | P2 | A course renders to a polished, themed booklet |
| FR-V-12 | Reports: content-pack / study-guide export (printable) | P2 | A module's lessons export to a printable study guide |
| FR-V-13 | Distribution: course/module publish → community + WhatsApp announcement draft | P1 | Publishing drafts an announcement targeted to the right channel |
| FR-V-14 | Distribution: webinar → recap unit + replay link | P2 | A webinar can be captured as a unit and distributed as a recap card |

### 6.3 Vizmaya user stories

- **As a content author**, I want to write a lesson once and have it appear in the Academy and as a community card so I'm not duplicating work.
  *Acceptance:* one publish action makes the unit live in the Academy and available to project to community.
- **As a content lead**, I want to preview exactly what learners will see before publishing so quality stays high on day one.
  *Acceptance:* preview is render-identical to the live player.

---

## 7. Vismay dependency (engine)

Vizmaya and the Academy depend on Vismay for scene/background rendering, theming/tokens, and layout primitives. **Deliverable to Vismay:** a GreenMentor theme + scene set (palette in greens/earth tones, mascot, lesson/quiz scene presets). This is configuration, not an engine change. No Academy or Vizmaya requirement may assume Vismay internals beyond its documented theme + render API.

---

## 8. Phasing & milestones

| Phase | Academy | Vizmaya |
|-------|---------|---------|
| **P0 — Foundations** | FR-A-01..06, 10, 11 + GreenMentor theme on Vismay | FR-V-01..03, 05, 06; one course authored end-to-end |
| **P1 — Engagement** | FR-A-07..09, 12..16 | FR-V-04, 07, 08, 09, 13 |
| **P2 — Depth & proof** | FR-A-17 | FR-V-10, 11, 12, 14 |

---

## 9. Risks & dependencies

- **Authoring schema choice** (markdown-first vs DB) affects reuse/versioning; recommend markdown-first to start (matches proven pattern), migrate to DB if reuse demands it.
- **Vismay readiness** — theme + scene-set must land before P0 Academy UI; gate P0 on it.
- **Credit value gaps** — per-quiz and per-challenge credit values are unset (deck only locks course/webinar/streak values).
- **Content supply** — Academy quality depends on authored content volume; P0 needs at least one complete course authored.
- **Mascot decision** — gamification leans on a character (per myAIcademy); absence weakens quiz engagement.

---

## 10. Open questions

1. Named GreenMentor mascot — yes/no, and visual direction?
2. Authoring schema — structured-markdown or block-based DB? (Recommend markdown-first.)
3. Per-quiz and per-challenge credit values?
4. Profile visibility — public vs cohort-only for credentials?
5. Is the printable study-guide export a P2 need or later?

---

### Appendix — myAIcademy → Academy mapping

See scope doc appendix. Summary: Intro, Login/Signup, Onboarding, Suggestion, Topic tiles, Live-vs-Self-Paced, Live class view, Payment, WhatsApp, Leaderboard, Gamification (mascot), Course Rating, Settings, Course detail/home all map to Academy equivalents. "Call with Amy" (AI tutor) is **out of scope**.
