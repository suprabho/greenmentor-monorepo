---
name: verify
description: Build/launch/drive recipe for verifying changes to the platform Next.js app at runtime.
---

# Verifying the platform app

## Launch
- `npm run dev` in `green-mentor-pro/platform/` (Turbopack, port 3000). Ready in <1s; needs `.env.local` (already present — shared Supabase project + service-role key).
- Public routes when signed out: `/feed`, `/webinars`, `/jobs`. Gated (redirect to `/login`): `/profile`, `/onboarding`, `/ai-hub`, `/academy`, `/energy`.

## Drive headlessly
- Playwright is in `platform/node_modules` but scripts outside the package must import it by absolute path: `import { chromium } from "<repo>/green-mentor-pro/platform/node_modules/playwright/index.mjs"` (Node resolves ESM from the script's location, not cwd).
- Sidebar is desktop-only (`lg:`): use viewport ≥1024px wide; mobile header/bottom nav at e.g. 390×844.

## Test accounts
- Create a real signed-in session through the UI: `/login` → click "New here? Create an account" → fill email/password → "Create account". This hits `POST /auth/signup` (service-role, email pre-confirmed) and lands on `/onboarding` with a live session.
- Clean up after: delete the user via `svc.auth.admin.deleteUser(id)` with the service-role client (`--env-file=.env.local`). The `profiles` row cascades.

## Gotchas
- The shared Supabase project does NOT have all migrations applied. As of 2026-07-17, migration `0008_academy_gamification.sql` (xp_events, credit_transactions, streaks, badges_awarded) is missing, so `fetchHeaderStats` returns null and stat pills are hidden even when signed in. PostgREST reports missing tables as "Could not find the table ... in the schema cache"; note that `select(..., { head: true })` can falsely report ok on a missing table — use a real `.select().limit(1)` to probe existence.
- Supabase CLI is not linked in this repo (`supabase migration list --linked` fails); migrations are applied out-of-band.
