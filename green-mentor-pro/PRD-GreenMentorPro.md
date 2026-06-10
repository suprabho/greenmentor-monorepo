# PRD — Green Mentor Pro Platform

| | |
|---|---|
| **Document** | Product Requirements Document |
| **Version** | 1.0 (draft for review) |
| **Date** | 2026-06-10 |
| **Owner** | Product (Supro) |
| **Status** | Draft |
| **Source IA** | "Green Mentor 1" IA diagram (2026-06-10) |
| **Related** | `academy/PRD-Academy-Vizmaya.md` · `academy/SCOPE-Academy-Vizmaya.md` · `ARCHITECTURE.md` · `REBUILD-ESTIMATE.md` · `GreenMentor_Platform_v4` deck |
| **Prototype** | `green-mentor-pro/prototype/` (Next.js static click-through) |

---

## 1. Summary

**Green Mentor Pro** is the unified consumer/prosumer ESG platform. Where the legacy `greenmentor-in-*` product is an enterprise BRSR reporting SaaS sold top-down, Pro is the bottom-up surface: one app where an individual discovers ESG content, learns and earns credentials, finds work, gets AI assistance, and runs real ESG tooling — and where GreenMentor converts free attention into paid courses, job products, agent runs, and eventually enterprise seats.

The IA defines **five sections** plus one cross-cutting artifact:

1. **Feed** — open global ESG news/updates feed, calendar, leaderboards, content library. The free-forever community layer and top of funnel.
2. **Academy** — courses (one free Fundamental course with limitations), webinars, and the in-course learning loop: bite-size lessons, quizzes, assessments (submitted via the Longsite demo workspace), Ask AI, leaderboard, streak/XP, badges. Output: the **Green Learning Profile**.
3. **Jobs** — unlimited jobs feed with 5 free applications, CV screening, mock interviews. Consumes the Green Learning Profile.
4. **AI Hub** — the **ESG Buddy** chatbot (free assistant) and the **Agentic** layer: Communication, Document Extraction, Planning, Data Analyst & Visualizer, and Documents & Reports Producer agents.
5. **Longsite Lite** — a mobile- and prosumer-friendly version of the Longsite tool with multiple workspaces and a demo workspace pre-loaded with demo data.

The **Green Learning Profile** is the connective tissue: Academy activity produces it, Jobs consumes it, and the Feed leaderboards display it.

### Why now

- The Academy/Vizmaya PRD (v1.0) defines the learning content pipeline; Pro is the shell it ships inside, plus the AI scope that PRD deliberately excluded.
- The rebuild analysis (`REBUILD-ESTIMATE.md`) shows the modern stack (Next.js/TS/Supabase/Claude) cuts ~40–50% of legacy code, and `efdb` + `ls-ingestion` pre-build the hard emission-factor domain — making Longsite Lite and the agents feasible for a small team.
- The deck's credit economy (1 credit = ₹1) gives every section a shared monetization rail.

---

## 2. Goals & success metrics

| Goal | Metric | First-milestone target |
|------|--------|------------------------|
| Build the free funnel | Weekly active users on Feed | 2,000 WAU |
| Activate learners | Signup → first lesson completed | ≥ 50% |
| Convert to paid | Free → paid course conversion | ≥ 8% of activated learners |
| Habit | 7-day streak rate among enrolled learners | ≥ 25% |
| Career value | Profiles with ≥1 job application | ≥ 30% of certified learners |
| AI engagement | ESG Buddy sessions / WAU / week | ≥ 1.5 |
| Tool adoption | Longsite Lite demo workspace → own workspace created | ≥ 15% |
| Agent revenue | Paid agent runs in milestone window | ≥ 100 runs |

### Non-goals (v1)

- No replacement of the enterprise `greenmentor-in-*` product; Longsite Lite is prosumer, not multi-tenant enterprise BRSR.
- No native mobile apps — responsive web, mobile-first for Longsite Lite.
- No user-generated courses; all Academy content flows through Vizmaya.
- No live consulting marketplace (deck's consulting pillar stays separate).

---

## 3. Personas

Carried from the platform deck; each persona has a primary section.

| Persona | Enters via | Primary section | Pays for |
|---------|-----------|-----------------|----------|
| **ESG Explorer** | Feed (news, webinars) | Feed + free Fundamental course | Nothing yet — conversion target |
| **Career Transitioner** | Academy | Academy + Jobs | Courses ₹2k–7k, certs, job products |
| **Corporate Operator** | Webinars / Longsite Lite | Longsite Lite + AI Hub | Agent runs, team seats, reports |
| **Consultant / Builder** | AI Hub / Longsite Lite | AI Hub agents + Longsite | Agent runs, advanced courses |

---

## 4. Information architecture

Transcription of the source IA. **Bold-green** items are the free/launch core (highlighted green in the diagram) — see §10 Phasing.

```
Green Mentor Pro
├── Feed
│   ├── **Open global feed of ESG news & updates → like / dislike / comment**
│   ├── Calendar ──→ Upcoming webinars · Existing ESG plans / tasks
│   ├── Leaderboards
│   └── Content library
├── Academy
│   ├── **Fundamental course — free with limitations**
│   ├── Courses (paid)
│   ├── Webinars
│   └── In-course learning loop  **(green container)**
│       ├── Bite-size learning
│       ├── Quizzes
│       ├── Assessment → submitted via Longsite demo workspace
│       ├── Ask AI
│       ├── Leaderboard
│       ├── Streak & XP
│       └── Badges
│       └──→ produces the Green Learning Profile ──→ feeds Jobs
├── Jobs
│   ├── Unlimited jobs feed · 5 free applications
│   ├── Screen CV
│   └── Mock interviews
├── AI Hub
│   ├── **ESG Buddy chatbot**
│   └── Agentic
│       ├── Communication agents
│       ├── Document extraction agents
│       ├── Planning agents
│       ├── Data analyst & visualizer agents
│       └── Documents & reports producer agents
└── Longsite Lite
    └── **Mobile/prosumer-friendly Longsite with multiple workspaces + demo workspace with demo data**
```

---

## 5. Module specifications

### 5.1 Feed

**Purpose.** Free-forever attention layer. No login required to read; login required to react/comment.

**Screens & components**

| Screen | Contents |
|--------|----------|
| **Global feed** | Infinite card feed of ESG news, regulatory updates (BRSR/CSRD/SEC), GreenMentor announcements, community highlights, webinar promos. Card: source, headline, summary, tags, like/dislike/comment counts. Inline comment thread. Filter chips (Regulation, Climate, Reporting, Careers, India, Global). |
| **Calendar** | Month/agenda view merging (a) upcoming webinars (RSVP → calendar invite) and (b) the user's existing ESG plans/tasks (course deadlines, assessment due dates, agent-scheduled tasks). |
| **Leaderboards** | Global + weekly XP leaderboards; course-level boards link in from Academy. Row: rank, avatar, name, XP, streak, top badge. |
| **Content library** | Searchable archive of past webinar recordings, articles, guides, templates. Free items open directly; premium items show a credit price. |

**Gates.** Read = anonymous. React/comment/RSVP = free account. Premium library items = credits.

**Engagement events.** Daily feed visit +5 XP · comment +10 XP (rate-limited) · webinar attendance +50 credits (per deck economy).

### 5.2 Academy

Defers to `academy/PRD-Academy-Vizmaya.md` for content model (Track → Course → Module → Lesson → Quiz), Vizmaya authoring, and the myAIcademy-style learner flow. Pro adds the platform integration points:

**Screens**

| Screen | Contents |
|--------|----------|
| **Catalog** | Hero: free Fundamental course. Then tracks/courses with level, duration, price (₹2k/4k/7k), rating. "Free with limitations" badge on Fundamental. |
| **Course detail / learning path** | Module map with lock states, syllabus, outcomes, instructor, certificate preview, enroll/buy CTA. |
| **Lesson player** | Bite-size lesson screens (3–7 min), progress rail, prev/next. Side panel tabs: **Ask AI** (lesson-context Q&A), notes, transcript. |
| **Quiz** | Per-lesson checks + module gate quizzes; instant feedback; XP on pass. |
| **Assessment** | Course-final applied assignment. CTA opens the **Longsite Lite demo workspace** pre-loaded with the assignment dataset; learner completes the task there and submits; submission lands back in Academy for evaluation. This is the bridge that teaches the tool while certifying the skill. |
| **Webinars** | Upcoming (RSVP) + past (library). Attendance earns credits. |
| **Course leaderboard** | Per-course XP ranking; feeds global board. |

**Gamification.** Streak (daily lesson), XP (lesson/quiz/assessment), badges (course completion, streak milestones, community contribution). All rendered on the Green Learning Profile.

**Fundamental course limitations (free tier).** Full bite-size content of the Fundamental track; quizzes included; **gated**: final assessment + certificate require account upgrade or credit payment; Ask AI capped (e.g. 20 questions/day); no cohort features.

### 5.3 Green Learning Profile (cross-cutting artifact)

**Purpose.** The portable, public-by-choice record of everything a learner has done: courses, certificates, badges, XP, streaks, assessment artifacts (Longsite outputs), webinar history. URL-shareable (à la LinkedIn/Credly).

**Consumed by:** Jobs (auto-attached to applications, drives match score), Feed leaderboards, recruiter view.

**Contents.** Identity + headline · verified credentials · skills graph from lesson tags (`scope-3`, `materiality`, `BRSR`…) · XP/streak/badge cabinet · portfolio of assessment outputs · activity heatmap.

### 5.4 Jobs

**Purpose.** Convert learning into career outcomes; monetize beyond 5 free applications.

| Screen | Contents |
|--------|----------|
| **Jobs feed** | Unlimited browsing. Card: role, company, location/remote, salary band, required skills with ✓ against the user's profile skills graph, match %. Apply with Green Learning Profile in two clicks. Counter: "3 of 5 free applications left." |
| **Screen CV** | Upload CV → analysis against a target role: ATS issues, skill gaps (each gap links to the Academy course that closes it), rewrite suggestions. First screen free; rerun/deep report = credits. |
| **Mock interviews** | Role-based interview practice (question banks: ESG analyst, sustainability manager, BRSR consultant). Self-record or AI-driven Q&A; rubric feedback. Free taster; full sessions = credits. |

**Gates.** Feed read = free account · 5 free applications, then credit-priced packs · CV deep reports and full mock interviews = credits.

**Skill-gap loop.** Every gap surfaced by Screen CV or a job's requirements deep-links to the Academy course that closes it — the platform's core cross-sell.

### 5.5 AI Hub

**Purpose.** The AI scope deliberately excluded from the Academy/Vizmaya PRD lives here.

#### ESG Buddy (free chatbot)

General-purpose ESG assistant: explains concepts, regulations, frameworks; answers from the content library; suggests courses and agents. Persistent chat history. Free with daily message cap; capless for paying users. System-prompted to cite library sources and to hand off to the right agent when a request is actually a job ("draft my BRSR section" → Documents & Reports Producer agent).

#### Agentic (paid, credit-metered)

Each agent = a guided form → run → reviewable output workflow (not open-ended chat). Outputs save to the user's Longsite Lite workspace and/or download.

| Agent family | Example jobs | Typical output |
|---|---|---|
| **Communication** | Draft stakeholder emails, sustainability announcements, supplier data requests | Email/post drafts |
| **Document extraction** | Pull structured data from utility bills, invoices, sustainability reports, policies | Structured tables → Longsite datasets |
| **Planning** | Materiality assessment plan, decarbonization roadmap drafts, ESG project plans → tasks land on Feed calendar | Plans, task lists |
| **Data analyst & visualizer** | Analyze emissions data in a workspace, build charts, find anomalies, YoY comparisons | Charts, insight summaries |
| **Documents & reports producer** | BRSR section drafts, ESG policy docs, board summaries, client reports | DOCX/PDF/XLSX |

**Pricing.** Per-run credit price by agent family (anchor: deck's agent-task prompts). Each run shows price before execution; outputs are reviewable/editable before export.

**Build note.** Document extraction + data analysis reuse the `efdb`/`ls-ingestion` Claude pipelines; report production reuses the legacy `react-pdf`/`docx`/`xlsx` export patterns.

### 5.6 Longsite Lite

**Purpose.** Prosumer, mobile-friendly version of the Longsite tool. The hands-on surface where Academy assessments happen, agent outputs land, and Corporate Operators trial the product that upsells to enterprise.

**Model.** User → multiple **workspaces** → datasets, calculations, charts, reports. One **demo workspace** ships pre-loaded with demo data (sample company, 12 months of energy/water/waste/scope-3 data) so every user — and every Academy assessment — starts from something real.

| Screen | Contents |
|--------|----------|
| **Workspace switcher** | Cards: demo workspace (badged), own workspaces, + new. |
| **Workspace home** | Mobile-first dashboard: emissions summary (S1/S2/S3), data completeness, recent activity, quick actions (add data, run agent, generate report). |
| **Data entry** | Simplified single-maker entry (no maker-checker in Lite): pick category → form → `calcEmission()` result inline. |
| **Charts/insights** | Pre-built visualizations; "Analyze with AI" → Data Analyst agent. |
| **Reports** | Generate summary report (Lite scope, not full BRSR) via Documents Producer agent. |

**Gates.** Demo workspace free for all. 1 own workspace free with row limits; more workspaces/rows/exports = subscription or credits. Enterprise features (maker-checker, multi-user orgs, full BRSR) = upsell to main platform.

---

## 6. Monetization model

One rail: **credits (1 credit = ₹1, min top-up ₹1,000, starter credits on signup)** + course/cert purchases.

| Surface | Free | Paid |
|---------|------|------|
| Feed | Read, react, comment, RSVP | Premium library items |
| Academy | Fundamental course (limited), webinars, quizzes | Courses ₹2k/4k/7k · certs · final assessment/certificate on Fundamental |
| Jobs | Browse unlimited, 5 applications, 1 CV screen | Application packs, deep CV reports, mock interview sessions |
| AI Hub | ESG Buddy (daily cap) | Agent runs (per-run, by family) |
| Longsite Lite | Demo workspace + 1 limited workspace | More workspaces, higher limits, report exports |

**Earning events** (deck): webinar +50 · module +25 · course +100 · referral +200 · 7-day streak +50 · weekly challenge +500 · expert answer +100. Earned credits spend anywhere on the rail — the cross-subsidy that makes the free tier sticky.

---

## 7. Cross-cutting systems

- **Identity & accounts.** Single account across all five sections. Supabase Auth (per rebuild plan). Anonymous read on Feed.
- **Gamification service.** One XP/streak/badge ledger consumed by Academy, Feed leaderboards, and the profile. Anti-gaming: rate limits, diminishing XP on repeats.
- **Credits ledger.** Double-entry: top-ups, earnings, spends; every paid action writes a transaction. Razorpay (already in `green-mentor-plus`).
- **Notifications.** Webinar reminders, streak nudges, application updates, agent-run completion. Email (SendGrid pattern) + in-app.
- **Search.** Unified across library, courses, jobs (pgvector available for semantic).
- **Analytics.** Per-section activation funnels mapped to §2 metrics.

---

## 8. Data model sketch (new entities)

```
users ─┬─ profiles (green_learning_profile: headline, public_slug, skills[])
       ├─ credit_transactions (type: topup|earn|spend, amount, ref)
       ├─ xp_events / streaks / badges_awarded
       ├─ enrollments ─ progress_records ─ quiz_attempts ─ assessment_submissions(workspace_ref)
       ├─ applications (job_id, profile_snapshot, status)   [5-free counter]
       ├─ cv_screens (file_ref, target_role, report)
       ├─ agent_runs (family, agent, inputs, output_refs, credits_spent, status)
       └─ workspaces ─ datasets ─ entries(calc results) ─ reports
feed_items ─ reactions ─ comments
events (webinars) ─ rsvps        jobs ─ companies
courses/modules/lessons/quizzes   ← Vizmaya-owned (see Academy PRD)
```

Multi-tenancy is **per-user** (workspaces), not per-org — RLS by `user_id`, dramatically simpler than the legacy `organization_id` model.

---

## 9. Technical approach

Per `REBUILD-ESTIMATE.md` / `MIGRATION-PLAN.md` conclusions:

- **Frontend:** Next.js 15 App Router, TypeScript strict, Tailwind v4 (CSS-first tokens), Phosphor icons, Zustand + TanStack Query, Framer Motion. Same design system as `green-mentor-plus` (Greenmentor pitch-deck bundle).
- **Backend:** Supabase (Postgres + RLS + Auth + Storage + Edge Functions). pgvector for search/EF matching.
- **AI:** Anthropic Claude for ESG Buddy + all agent families; extraction/analysis pipelines reuse `efdb` + `ls-ingestion`.
- **Calculations:** `calcEmission()` + EF database from `efdb` power Longsite Lite.
- **Payments:** Razorpay (courses, top-ups).
- **Content:** Vizmaya pipeline (separate PRD) is the sole source for Academy/library content.

---

## 10. Phasing

Green-highlighted IA nodes = **P0**. Each phase ships a usable product.

| Phase | Scope | Cut line |
|-------|-------|----------|
| **P0 — Free core** | Global feed (read/react/comment) · Fundamental course with full learning loop (bite-size, quizzes, Ask AI capped, streak/XP, badges, course leaderboard) · ESG Buddy (capped) · Longsite Lite with demo workspace · basic Green Learning Profile | No payments needed to get value |
| **P1 — Monetization** | Paid courses + certs · credits ledger + Razorpay · assessment-via-Longsite bridge · calendar · content library · global leaderboards · own workspaces in Lite | First revenue |
| **P2 — Career & agents** | Jobs feed + applications (5-free gate) · Screen CV · public profile pages · first two agent families (Document Extraction, Documents & Reports Producer) | Profile must exist from P0/P1 |
| **P3 — Full agentic** | Remaining agent families · mock interviews · planning-agent → calendar integration · workspace limits/subscriptions · enterprise upsell hooks | |

Dependencies: Vizmaya authoring (Academy PRD) gates P0 content · `efdb`/`ls-ingestion` gate Longsite Lite calcs and extraction agents · credits ledger gates everything in P1+.

---

## 11. Risks & open questions

1. **Scope gravity.** Five sections is a lot for v1 — P0 cut line must hold; everything else is a stub behind "coming soon."
2. **Longsite vs Longsite Lite divergence.** Need a decision: shared codebase with feature flags, or separate Lite app? (Prototype assumes separate Lite surface, shared calc engine.)
3. **Jobs supply.** A jobs feed without jobs is a dead section — seed strategy needed (aggregated listings? partner postings?) before P2.
4. **Agent unit economics.** Per-run Claude cost vs credit price needs margin modeling before public pricing.
5. **Free Ask AI abuse.** Caps + auth required; consider per-lesson context-only scope at P0.
6. **Naming.** "Longsite" (IA) vs "LongSight" (deck/docs) — standardize before launch.
7. **Profile privacy.** Public-by-choice defaults, recruiter visibility consent, India DPDP compliance.

---

## 12. Prototype route map

Static high-fidelity click-through in `green-mentor-pro/prototype/` (Next.js 15, Tailwind v4, Phosphor, demo data only, no backend):

| Route | Screen |
|-------|--------|
| `/feed` | Global feed with reactions + comments |
| `/feed/calendar` | Calendar: webinars + ESG tasks |
| `/feed/leaderboards` | Global/weekly leaderboards |
| `/feed/library` | Content library |
| `/academy` | Catalog (free Fundamental hero + paid courses) |
| `/academy/course` | Course detail + module path |
| `/academy/lesson` | Lesson player: bite-size + quiz + Ask AI panel + streak/XP |
| `/academy/assessment` | Assessment brief → Longsite demo handoff |
| `/academy/webinars` | Webinars |
| `/profile` | Green Learning Profile |
| `/jobs` | Jobs feed with match % + 5-free counter |
| `/jobs/screen-cv` | CV screening report |
| `/jobs/mock-interview` | Mock interview session |
| `/ai-hub` | ESG Buddy chatbot |
| `/ai-hub/agents` | Agentic hub: 5 families + run flow |
| `/longsite` | Workspace switcher + demo workspace dashboard |
