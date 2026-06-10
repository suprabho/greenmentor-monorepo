# Green Mentor Pro — High-Fidelity Static Prototype

Click-through prototype of the Green Mentor Pro platform, built from the "Green Mentor 1" IA
diagram. See `../PRD-GreenMentorPro.md` (product spec) and `../BUILD-PLAN-GreenMentorPro.md`
(execution plan).

Static demo data only (`lib/data.ts`) — no backend, no auth, no payments.

## Quick start

```bash
npm install
npm run dev      # http://localhost:3100
```

## Stack

- Next.js 15 (App Router, TypeScript), Tailwind CSS v4 (CSS-first tokens), Phosphor icons
- Greenmentor pitch-deck design system tokens — same set as `academy/green-mentor-plus`
- Desktop-first responsive; mobile bottom-nav; Longsite Lite is mobile-first by design

## Route map

| Route | Screen | IA node |
|-------|--------|---------|
| `/feed` | Global ESG feed + reactions/comments | Feed (green/free) |
| `/feed/calendar` | Webinars + ESG plans/tasks | Calendar |
| `/feed/leaderboards` | Weekly/all-time XP boards | Leader boards |
| `/feed/library` | Content library (free + credit-priced) | Content library |
| `/academy` | Catalog: free Fundamental hero + paid courses | Academy |
| `/academy/course` | Course detail, module path, cert gate | Fundamental course (green/free) |
| `/academy/lesson` | Bite-size lesson + quiz + Ask AI panel | Learning loop (green) |
| `/academy/assessment` | Assessment brief → Longsite demo handoff | Assessment → Longsite |
| `/academy/webinars` | Upcoming + recordings | Webinars |
| `/profile` | Green Learning Profile (XP, skills, credentials, portfolio) | Green Learning Profile |
| `/jobs` | Jobs feed, match %, 5-free counter | Jobs |
| `/jobs/screen-cv` | ATS score, gaps → course deep-links, rewrites | Screen CV |
| `/jobs/mock-interview` | AI interview session + rubric feedback | Mock interviews |
| `/ai-hub` | ESG Buddy chatbot (free, capped) | ESG Buddy (green/free) |
| `/ai-hub/agents` | 5 agent families + run flow | Agentic |
| `/longsite` | Workspace switcher + demo workspace dashboard | Longsite Lite (green/free) |

## Notes

- The quiz on `/academy/lesson` and the Ask AI/Notes tabs are interactive; everything else is static.
- Free-tier gates from the PRD are visualized in place (Ask AI caps, certificate locks, 5-free applications, agent run pricing).
