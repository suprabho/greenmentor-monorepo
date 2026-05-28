# Legacy academy.greenmentor.co — content & asset extraction

Verbatim capture of the **live Brizy-built site** at `https://academy.greenmentor.co/`
(fetched 2026-05-27), preserved here as a content source for this rebuild.

> **Read this first.** The live site predates this repo. In most places the repo's
> copy, course taxonomy, testimonials, and design system are *more* evolved than the
> legacy page — do **not** overwrite `lib/data/*` with the copy below. Use this as a
> reference for (a) wording we may want to echo, (b) the real external links the
> legacy site points at, and (c) the "coming soon" framework catalog the repo doesn't
> yet model. The reconciliation table at the bottom maps each item to its repo status.

---

## 1. Header / navigation

- **Logo (raster):** `https://cloud-1de12d.becdn.net/media/original/8b338ac42c41d0fd19f1a6d650398ecb/659e4ff303acf6ed2d198a03_Asset2.png`
  — superseded by the inline vector wordmark in [Logo.tsx](../components/marketing/Logo.tsx).
- **Login:** `https://academy.greenmentor.co/learn/account/signin` (Learnyst-hosted)

## 2. Hero

- **Heading:** "Welcome to GreenMentor Academy"
- **Tagline:** "Empowering Sustainability Leaders"
- **Body:** "At GreenMentor Academy, we believe in the power of education to create a
  sustainable future for all. Our mission is to equip students and professionals with
  the knowledge, skills, and tools they need to become leaders in environmental
  stewardship and sustainability."
- **CTA:** "Enroll today" → `https://pages.razorpay.com/pl_NHj11w5RYMQACP/view`
- **Stat:** "100+ Worldwide learners"
- **Hero image:** `https://cloud-1de12d.becdn.net/media/original/2dca3ff954ba92000dee357b21afb1ac/Group17646.png`

## 3. Courses — segmented by audience

The legacy site groups its catalog under three audience tabs. Only two courses are
actually live ("What is ESG?" and the BRSR kickstart); the rest are **"Coming soon"**
placeholders whose CTA is a Google interest form, not checkout.

**Shared interest-form CTA:** "Register your interest" → `https://forms.gle/VpwiT6BoxyTQj6Pp8`
**Live-course CTA:** "Enroll today" → `https://pages.razorpay.com/pl_NHj11w5RYMQACP/view`

### Mid Career Professionals
| Course title (verbatim) | Label |
| --- | --- |
| Understanding Sustainability Reporting: A Deep Dive into GRI Framework | ESG Reporting (Coming soon) |
| Unraveling Sustainability Accounting Standards Board (SASB): Key Concepts and Applications | ESG Reporting (Coming soon) |
| Exploring Carbon Disclosure Project (CDP): Strategies for Effective Climate Reporting | ESG Reporting (Coming soon) |
| Tackling Climate-related Financial Disclosures (TCFD): A Comprehensive Analysis | ESG Reporting (Coming soon) |
| Integrating Business Reporting on Sustainability (BRSR): Best Practices and Implementation Strategies | ESG Reporting (Coming soon) |
| Delving into Dow Jones Sustainability Index (DJSI): Metrics, Methodologies, and Insights | ESG Reporting (Coming soon) |

### Business Leaders
- **What is ESG?** | Understand the fundamentals of ESG and Unlocking Growth by Leveraging ESG — *ESG Reporting | 1 - 50min* (live)
- Understanding Sustainability Reporting: A Deep Dive into GRI Framework — *Coming soon*

### Students
- **Kickstart a career in ESG/BRSR** — subtitle: "Integrating Business Reporting on
  Sustainability (BRSR): Best Practices and Implementation Strategies" — *ESG Reporting | 1 - 50min* (live)
- Understanding Sustainability Reporting: A Deep Dive into GRI Framework — *Coming soon*

**Course thumbnails (CDN):**
- GRI: `…/ebbafc68530daf69e9cd18f3aeb1be3f/Group7.png`
- SASB: `…/d187fe9a29c93f77e2cc3531848c501d/Group8.png`
- CDP: `…/cd3e4b6b69f15cd3f0371461fd40dc89/Group9.png`
- TCFD: `…/274da7a5b8102d05c4e942813c15a751/Group10.png`
- BRSR: `…/9e51775c2751fafffae5e085154b6949/Group11.png`
- DJSI: `…/335477def0c41de71de3ae1689f07a1e/Group13.png`
- "What is ESG?" dark ad: `…/7d9287f6ec398bf0fa8c39d323ec637f/DarkAd.png`
- Light ad banner: `…/1daf6a9b4d3a94971d22307362f875cf/LightAd6.png`

(All prefixed `https://cloud-1de12d.becdn.net/media/original/`.)

## 4. "Why Choose GreenMentor Academy?"

- **Heading:** "Why Choose GreenMentor Academy?"
- **Feature list:** Expert-Led Courses · Hands-On Learning · Comprehensive Curriculum ·
  Flexible Learning Options · Global Community
- **CTA:** "Enroll today" → Razorpay link (above)
- **Image:** `…/ae92ce2c264812d264dcb91e503e8a79/Frame1000001818(3).png`

## 5. CTA bands

- **"Join the Green movement"** — "Join us today and become a catalyst for positive
  change in the world. Together, we can create a healthier planet for generations to
  come." → "Enroll today" (Razorpay)
- **"Train your team today"** / sub: "In ESG & Sustainability" → "Enquire now" →
  `https://www.greenmentor.co/book-a-meeting`
  — image: `…/662dff8827e744a5260a289ff7351852/HowCorporateTrainingCanRefineYourWorkLife_1683563495.png`

## 6. Footer

- **Company:** SaaS → `https://www.greenmentor.co/saas` · Academy → `https://academy.greenmentor.co/`
- **Quick links:**
  - Privacy Policy → `https://www.greenmentor.co/privacy-policy`
  - Terms and Conditions → `https://www.greenmentor.co/terms-of-use`
  - Return and Refund Policy → `https://www.greenmentor.co/return-and-refund-policy`
- **Contact:** `https://www.greenmentor.co/contact`
- **Copyright:** "©2024 Copyright All rights reserved."
- **Social:**
  - LinkedIn → `https://www.linkedin.com/company/the-green-mentor`
  - Facebook → `https://www.facebook.com/people/Green-Mentor/61550940795704/`

---

## 7. Brand assets observed (and why most are *not* worth importing)

| Asset | Legacy site | This repo | Verdict |
| --- | --- | --- | --- |
| **Wordmark** | `Asset2.png` (raster) | inline vector `greenmentor` lockup in `Logo.tsx`, dot `#00AE66` | **Keep repo's** — vector beats raster |
| **Fonts** | Overpass, Manrope, Lato (Brizy defaults) | Manrope + ABeeZee (+ Inter refs), from Figma deck system | **Keep repo's** — Overpass/Lato are template defaults, off-brand |
| **Colors** | blue `rgb(35,157,219)`, light-blue `rgb(189,225,244)`, grays | teal/green token set in `globals.css` (Figma) | **Keep repo's** — legacy blue is a Brizy theme default |
| **Favicon** | `…/f6d6…534d.png` (812 B) | layout references `/favicon.svg` (was **missing** — now added) | Fixed with brand-token SVG |

Only **Manrope** is common to both — already the repo's `--font-sans`.

---

## 8. Reconciliation — legacy element → repo status

| Legacy element | Status in this repo |
| --- | --- |
| Hero copy ("Welcome…/Empowering…") | Superseded — see [Hero.tsx](../components/marketing/Hero.tsx) + `hero-stats.ts` |
| Razorpay payment-page link (`pl_NHj11w5RYMQACP`) | Superseded — full subscription flow under `app/api/razorpay/*` + `app/onboarding/checkout` |
| Audience tabs (Mid-Career / Business Leaders / Students) | Present, richer — [audiences.ts](../lib/data/audiences.ts) |
| "Why Choose" props | Reframed as subscription inclusions — [value-props.ts](../lib/data/value-props.ts) |
| CTA bands ("Join the Green movement" / "Train your team") | Partially — [FinalCta.tsx](../components/marketing/FinalCta.tsx); **no B2B "book a meeting" CTA yet** |
| Coming-soon framework courses (GRI/SASB/CDP/TCFD/BRSR/DJSI) | **Not modeled** — repo ships 5 live Learnyst courses ([courses.ts](../lib/data/courses.ts)). Candidate "coming soon" roadmap. |
| "Register your interest" Google Form | **Not used** — candidate CTA for coming-soon courses |
| Footer legal/social/contact URLs | **Placeholders** in [nav.ts](../lib/data/nav.ts) (`/legal/*`, `/#contact`) — real external URLs captured in §6 above |
| Corporate "book-a-meeting" link | **Not used** anywhere |
