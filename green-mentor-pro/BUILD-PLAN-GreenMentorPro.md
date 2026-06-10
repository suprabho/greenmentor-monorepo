# Build Plan — Green Mentor Pro

> Execution companion to `PRD-GreenMentorPro.md`. Phases map to PRD §10. Assumes a 2–3 person build team using the modern stack (Next.js 15 / TypeScript / Supabase / Claude) per `REBUILD-ESTIMATE.md`, with `efdb` + `ls-ingestion` reused as-is. Estimates are working weeks, not calendar promises.

---

## 0. Pre-build foundations (Week 0–2)

| Workstream | Deliverable | Reuses |
|---|---|---|
| Repo & infra | `green-mentor-pro` app scaffold, Supabase project, Vercel/Fly deploy, CI | `green-mentor-plus` config patterns |
| Design system | Port Greenmentor tokens (teal/green worlds, Inter/ABeeZee, tile shadows) into shared package; component kit: AppShell, Card, Chip, StatBand, Avatar, ProgressRail | `green-mentor-plus/app/globals.css` |
| Auth & accounts | Supabase Auth (email + Google), anonymous-read on Feed, profile bootstrap | Deletes legacy `-um` service pattern |
| Data model v0 | Migrations for users/profiles, xp_events, streaks, badges, feed_items, courses-shadow tables | PRD §8 |
| Decisions to close | Longsite vs LongSight naming · Lite codebase strategy · Vizmaya content delivery contract (API vs static export) | PRD §11 |

**Gate to P0:** deploy pipeline green, auth works, design kit renders the prototype screens.

---

## P0 — Free core (Week 2–10)

Everything green in the IA. No payments.

| # | Epic | Scope | Est. |
|---|------|-------|------|
| P0.1 | App shell & nav | Sidebar/bottom-nav shell, section routing, responsive frame, profile menu | 1w |
| P0.2 | Global Feed | Feed items CRUD (admin-seeded + RSS/curation pipeline), like/dislike/comment, filter chips, anonymous read | 2w |
| P0.3 | Academy core | Catalog, course detail, lesson player, quiz engine — rendering Vizmaya content for the **Fundamental course** | 3w |
| P0.4 | Learning loop | XP/streak/badge ledger + UI, course leaderboard, daily-streak nudge email | 1.5w |
| P0.5 | Ask AI (capped) | Lesson-context Claude Q&A, 20/day cap, abuse limits | 1w |
| P0.6 | ESG Buddy | Chat UI, history, capped free tier, course/agent handoff suggestions (suggestions only — agents are stubs) | 1.5w |
| P0.7 | Longsite Lite demo | Workspace shell (mobile-first), demo workspace with seeded company data, dashboard, read-only charts, simple data entry with `calcEmission()` | 3w |
| P0.8 | Green Learning Profile v0 | Private profile page: XP, streak, badges, course progress | 1w |
| P0.9 | QA + beta launch | Cross-section QA, analytics events, closed beta | 1w |

**Parallel content track:** Fundamental course authored in Vizmaya (Academy PRD owns this) — *hard dependency for P0.3*.

**Exit criteria:** a new user can read the feed, finish a Fundamental lesson with quiz, chat with ESG Buddy, and explore the demo workspace — all free.

---

## P1 — Monetization (Week 10–18)

| # | Epic | Scope | Est. |
|---|------|-------|------|
| P1.1 | Credits ledger | Double-entry transactions, starter credits, earning events (webinar/module/course/streak/referral) | 1.5w |
| P1.2 | Payments | Razorpay top-ups + course purchases, receipts, refund path | 1.5w |
| P1.3 | Paid courses | Enrollment gates, certificates (issue + verify URL), cert on profile | 2w |
| P1.4 | Assessment bridge | Assessment brief in Academy → opens Longsite demo workspace with assignment dataset → submit → evaluation queue | 2w |
| P1.5 | Calendar | Webinars + ESG tasks merged view, RSVP, ICS export, reminders | 1.5w |
| P1.6 | Content library | Search, free vs credit-priced items, webinar recordings | 1.5w |
| P1.7 | Global leaderboards | Weekly/all-time, anti-gaming rate limits | 0.5w |
| P1.8 | Own workspaces in Lite | Create workspace, row limits, upgrade prompts | 1.5w |

**Exit criteria:** first rupee of self-serve revenue; assessment-via-Longsite loop works end-to-end.

---

## P2 — Career & first agents (Week 18–26)

| # | Epic | Scope | Est. |
|---|------|-------|------|
| P2.1 | Jobs feed | Listings model + seed pipeline (aggregation/partners — resolve PRD risk #3 first), match % from profile skills graph, 5-free application counter, application packs | 2.5w |
| P2.2 | Public profiles | Shareable Green Learning Profile URL, recruiter view, privacy controls | 1.5w |
| P2.3 | Screen CV | Upload → Claude analysis vs target role → gaps deep-linked to courses; 1 free, rerun on credits | 2w |
| P2.4 | Agent runtime | Shared agent-run framework: guided input form → credit hold → Claude pipeline → reviewable output → save/export; run history | 2w |
| P2.5 | Agent family: Document Extraction | Bills/invoices/reports → structured tables → Lite datasets (reuse `ls-ingestion`) | 1.5w |
| P2.6 | Agent family: Documents & Reports Producer | BRSR-section/policy/summary drafts → DOCX/PDF export (reuse legacy export libs) | 1.5w |

**Exit criteria:** learner → certified → applied to a job with profile attached; two agent families earning credits.

---

## P3 — Full agentic & scale (Week 26+)

- Remaining agent families: Communication, Planning (tasks → calendar), Data Analyst & Visualizer (charts on Lite workspaces).
- Mock interviews (question banks + AI-driven sessions + rubric feedback).
- Lite subscriptions (workspace/row tiers), report exports.
- Enterprise upsell hooks: maker-checker teaser, org invites → main platform pipeline.
- Hardening: load, abuse, DPDP/privacy review, i18n groundwork.

---

## Team & cadence

- **Squad:** 1 full-stack lead, 1 product engineer, 1 designer (50%), product owner (Supro). Content team works the Vizmaya track in parallel.
- **Cadence:** 2-week sprints; each phase ends with a usable release behind a beta flag.
- **Tracking:** epics above map 1:1 to project-board epics; PRD §2 metrics wired into analytics from P0.9.

## Top dependency risks

1. **Vizmaya readiness** gates P0.3 — if the authoring pipeline slips, hand-build the Fundamental course as static JSON behind the same renderer contract.
2. **Jobs supply** gates P2.1 — start partner/aggregation conversations during P1.
3. **Agent margins** gate P2.4 pricing — model Claude cost per run during P1.
