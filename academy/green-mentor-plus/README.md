# Greenmentor — GM Academy (web)

Marketing site and onboarding flow for **GM Academy** — the learning surface of
**Greenmentor**, the world's first community-led ESG data & learning platform.
This codebase owns everything users see *before* Learnyst — landing,
segmentation, plan choice — then hands off to Learnyst for auth, payment and
course delivery.

The visual design follows the Greenmentor pitch-deck design system bundle
(`greenmentor-design-system.tar.gz`) — see [Design system](#design-system) below.

## Quick start

```bash
npm install
npm run dev
```

The app runs on `http://localhost:3000`. Saves hot-reload via Turbopack.

## Stack

- **Next.js 15** App Router, TypeScript strict, Turbopack
- **Tailwind CSS v4** with CSS-first tokens in [`app/globals.css`](app/globals.css)
- **Phosphor Icons** — duotone for headers, regular for UI
- **Zustand** (persisted) for onboarding state
- **Framer Motion** for transitions
- **Zod** for the lead API schema

## Routes

| Route                      | What it does                                              |
|----------------------------|-----------------------------------------------------------|
| `/`                        | Landing (hero, audience, value props, courses, pricing, social, FAQ, CTA) |
| `/courses`                 | Full library                                              |
| `/pricing`                 | Plans + FAQ                                               |
| `/about`                   | Three sub-brand lockup + philosophy                       |
| `/faq`                     | All FAQs                                                  |
| `/onboarding/welcome`      | Name + email                                              |
| `/onboarding/audience`     | Segment (`student` / `mid-career` / `business-leader`)    |
| `/onboarding/goals`        | Multi-select goals                                        |
| `/onboarding/plan`         | Plan + monthly/annual                                     |
| `/onboarding/checkout`     | Razorpay Subscriptions checkout (modal)                   |
| `/onboarding/handoff`      | POST `/api/lead`, redirect to Learnyst                    |
| `/login`                   | Redirects to Learnyst login                               |
| `/signup`                  | Redirects to `/onboarding/welcome`                        |
| `POST /api/lead`           | Validates onboarding payload (Zod), logs to console       |
| `POST /api/razorpay/subscription` | Server-creates a Razorpay subscription              |
| `POST /api/razorpay/verify`       | Verifies the HMAC signature from Checkout           |
| `POST /api/razorpay/webhook`      | Razorpay → us. Verifies signature, logs event       |
| `GET/POST /api/learnyst/sso` | Stub for v2 SSO (returns 501)                           |

Deep-link pre-fills: `/onboarding/welcome?segment=mid-career&plan=membership&cycle=annual`.

## Architecture seams

- [`lib/learnyst/client.ts`](lib/learnyst/client.ts) — the **only** place that
  builds the Learnyst URL. v1 constructs prefill query params; v2 will call the
  SSO endpoint and return a one-time URL. Callers stay identical.
- [`lib/razorpay/`](lib/razorpay/) — payment seam. `client.ts` is server-only
  (creates subscriptions, verifies signatures); `config.ts` resolves plan ids
  from env vars; `types.ts` is shared with the client.
- [`lib/store/onboarding.ts`](lib/store/onboarding.ts) — single Zustand store,
  persisted under `gm-onboarding` in `localStorage`. Tracks Razorpay
  `subscriptionId` / `paymentId` / `paymentStatus` alongside the onboarding
  answers.
- [`lib/data/`](lib/data/) — every piece of changeable copy lives here.

## Environment

See [`.env.example`](.env.example) for the full list. Copy it to `.env.local`
and fill in values from the Razorpay dashboard before running.

```
NEXT_PUBLIC_LEARNYST_BASE_URL=https://learn.greenmentor.academy

# Razorpay — payment seam. Keys live in test mode until launch.
RAZORPAY_KEY_ID=…
RAZORPAY_KEY_SECRET=…           # server only
NEXT_PUBLIC_RAZORPAY_KEY_ID=…   # mirror, for Checkout SDK
RAZORPAY_WEBHOOK_SECRET=…
RAZORPAY_PLAN_MEMBERSHIP_MONTHLY=plan_…
RAZORPAY_PLAN_MEMBERSHIP_ANNUAL=plan_…
```

### Payment flow

```
/plan ─► /checkout ──► POST /api/razorpay/subscription   (server creates sub)
                  ──► Razorpay Checkout (modal)
                  ──► POST /api/razorpay/verify          (HMAC check)
                  ──► /handoff                            (Learnyst redirect)
```

The webhook (`/api/razorpay/webhook`) is the source of truth for subscription
lifecycle — wire it to Learnyst enrolment / revocation in v2.

## Design system

The visual language follows the Greenmentor pitch-deck design system bundle.
Tokens live in [`app/globals.css`](app/globals.css) under `@theme`. Two
worlds — pick by surface:

- **Dark world** (hero, credibility moments, final CTA): `#014A50` deep teal
  background, white text, neon `#07D862` accents. Eyebrow chips are flat
  `#164E4F` rectangles with mint `#DAF4D7` text in `0.11em` tracking.
- **Light world** (product, audience, pricing, courses, FAQ): white or mint
  `bg-section-fade` (mint → white vertical gradient), `#5D5D5D` body text,
  primary green `#009C62` for section labels with a dashed neon hairline below.

### Type
- **Inter** is the workhorse face for everything (300/400/500/600/700).
- **ABeeZee** is the alternate humanist voice — used only for sub-brand names
  (`GM Academy`, `Longsight`).
- The deck uses **Codec Pro** for the signature 96px stat numerals and
  **Neue Haas Grotesk Display Pro** for hero titles. Both are paid foundry
  fonts; we substitute Inter Medium with `-0.02em` tracking until the
  licensed `.woff2` files are dropped in.

### Components

- `Button` — primary (green-700), accent (neon, teal text), outline,
  ghost-dark, ghost-light. 10px border-radius, Inter SemiBold.
- `Eyebrow` — flat-rectangle label with ALL-CAPS wide tracking.
- `Badge` — mint pill chip with primary-green SemiBold text (category pills),
  or neon for "Most Popular" callouts.
- `Card` — light (white + slate-200 border + soft-card shadow on hover),
  dark (rgba(7,216,98,0.15) fill + 1px neon border, 24px radius), or
  `bg-section-fade` mint.
- `SectionHeader` — primary-green Inter Bold label + dashed neon rule +
  serif-substitute headline + body subhead. The signature device.
- `StatBand` — the deck's signature vertical-gradient band with big
  Codec-Pro-substitute numerals.

### Brand assets

Bundled under [`public/brand/`](public/brand/):

| File                          | Source                                       |
|-------------------------------|----------------------------------------------|
| `wordmark-outline.svg`        | Giant outlined `greenmentor` lockup — used as a `mix-blend-mode: color-dodge` decoration in hero and footer |
| `partner-iimb-nsrcel.png`     | "Backed by" IIMB + NSRCEL lockup             |
| `partner-iitb.png`            | IIT-B Innovation Centre                      |
| `partner-amazon.png`          | Amazon — students-from row                   |
| `partner-kpmg.png`            | KPMG — students-from row                     |
| `partner-hm.png`              | H&M — students-from row                      |
| `aligned-frameworks.png`      | BRSR · GRI · SASB · CDP · CBAM lockup        |

## Outstanding TODOs

Search the codebase for `TODO[` to find these in context.

1. **`TODO[Brand]`** — replace the placeholder concentric-circle mark in
   [`components/marketing/Logo.tsx`](components/marketing/Logo.tsx) with the
   real Greenmentor logomark when it lands.
2. **`TODO[Pricing]`** — confirm plan names, monthly/annual amounts, and
   features in [`lib/data/plans.ts`](lib/data/plans.ts). Annual saving badge
   is keyed off `annualSavingsPercent` — keep in sync if pricing moves.
3. **`TODO[Copy]`** — marketing review on
   [`lib/data/value-props.ts`](lib/data/value-props.ts) and
   [`lib/data/goals.ts`](lib/data/goals.ts).
4. **`TODO[About]`** — drop in real mentor bios with photos under `/about`.
5. **`TODO[Marketing]`** — replace placeholder testimonials in
   [`lib/data/testimonials.ts`](lib/data/testimonials.ts) with consented
   quotes.
6. **`TODO[Learnyst]`** — confirm the real signup URL with Learnyst support
   ([`lib/learnyst/config.ts`](lib/learnyst/config.ts)). Wire per-course
   Learnyst URLs in [`lib/data/courses.ts`](lib/data/courses.ts).
7. **Foundry fonts** — drop **Codec Pro**, **Neue Haas Grotesk Display Pro**
   and **Ulm Grotesk** `.woff2` files into `/public/fonts/` and add an
   `@font-face` block in `globals.css`. Hero titles and 96px stats will look
   meaningfully sharper.
8. **Razorpay plan ids** — create the two plans in the Razorpay dashboard
   (Membership Monthly, Membership Annual) and drop the ids into `.env.local`
   under the `RAZORPAY_PLAN_*` keys. The `/checkout` step fails loudly in dev
   with the missing env-var name if any are absent.
9. **Razorpay webhook → Learnyst enrolment** — `/api/razorpay/webhook`
   currently verifies signature + logs. Wire `subscription.activated` to
   create/enrol the Learnyst user and `subscription.cancelled` / `halted` to
   revoke access.
10. **`POST /api/lead`** — v1 logs to console. Wire to a CRM or a Slack
   webhook before launch.
11. **SSO endpoint** — implement `/api/learnyst/sso` against the Learnyst
    SSO API to enable v2 zero-friction handoff.
12. **Analytics** — [`lib/utils/analytics.ts`](lib/utils/analytics.ts) is a
    console stub. Wire to PostHog or Mixpanel before launch.
13. **Additional partner logos** — EY, L&T, BPCL, BCG, CRISIL, EKi were
    referenced in the deck but the binaries were not bundled. Source the
    SVGs and add to `/public/brand/`.

## Accessibility

- Visible focus rings (2px neon green, 2px offset) on all interactive elements
- All form fields labelled, errors associated via `aria-describedby`
- Accordion / toggle controls have `aria-expanded` / `aria-pressed`
- `prefers-reduced-motion` honored globally
- Mobile-first: 375px → 1440px+

## Brand voice (from the design system bundle)

- **Confident, outcomes-led.** Every claim paired with a number ("3× the
  supply", "60% reduction in reporting time", "3,000+ active students").
- **Mission-aligned, not preachy.** ESG is the subject matter; the tone is
  operational ("bridge the skills gap"), not aspirational ("save the
  planet").
- **First-person plural for the company, third-person for the user.**
  "At Greenmentor, we've designed…" / "Professionals with essential skills…"
- **Slight Indian-English register.** Title Case used liberally. *Keep it.*
- **No emoji. No exclamation marks. No motivational quotes. No nature
  metaphors.** Stick to ESG and ops vocabulary.
