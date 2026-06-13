# GreenMentor Community Engine

Standalone Next.js app for the GreenMentor community team's maker tools
(currently the **Aura Header Studio**). Gated behind Google sign-in via
Supabase, with saved headers persisted to the shared GreenMentor Supabase
project.

## Stack

- Next.js 15 (App Router) · React 19 · Tailwind v4
- Supabase auth + Postgres via `@supabase/ssr` (cookie sessions, RLS)
- Playwright for server-side PNG export

## Local setup

```bash
cp .env.example .env.local      # fill in the publishable key
npm install
npx playwright install chromium # first run only (for PNG export)
npm run dev                     # http://localhost:3200
```

`.env.local` (publishable key is safe to expose to the browser; RLS enforces access):

```
NEXT_PUBLIC_SUPABASE_URL=https://haokazwcljdummkvufcg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_…
```

## One-time Supabase configuration (dashboard)

These can't be done from code — do them once in the Supabase dashboard for the
shared project (`haokazwcljdummkvufcg`):

1. **Database** — apply `supabase/migrations/0001_community_headers.sql`
   (creates `public.community_headers` + RLS). *Already applied to the shared
   project; re-run via the SQL Editor if you point at a fresh project.*
2. **Auth → Providers → Google** — enable it and paste the Google OAuth client
   ID + secret (from Google Cloud Console; authorized redirect URI there is
   `https://haokazwcljdummkvufcg.supabase.co/auth/v1/callback`).
3. **Auth → URL Configuration → Redirect URLs** — add:
   - `http://localhost:3200/auth/callback`
   - `https://<your-production-domain>/auth/callback`

## How auth works

- `middleware.ts` refreshes the session cookie and redirects unauthenticated
  requests to `/login` (the whole app is gated).
- `/login` starts Google OAuth; `/auth/callback` exchanges the code for a
  session; `/auth/signout` clears it.

## Saved headers

`community_headers` rows are either `personal` (owner-only) or `shared` (any
signed-in teammate can read). RLS enforces this. Save from the studio's Save
bar; browse/open/delete from `/library`.

## Header render CLI (powers the `aura-header` skill)

```bash
echo '{"title":"…"}' | npx tsx scripts/render-header.ts --out /tmp/header.png
```
