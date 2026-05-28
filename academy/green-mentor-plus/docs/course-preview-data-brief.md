# Task: Finalize the 5-course preview (data + placeholder thumbnails)

## Goal
The home course preview was trimmed to the **5 live Learnyst courses** from the catalog
screenshot, and each card now shows a **placeholder thumbnail**. This brief lists the values
that were inferred (not available in the screenshot) and the assets that still need swapping,
so a follow-up pass can replace them with the real data.

## Context: what was changed

- **Data:** [lib/data/courses.ts](../lib/data/courses.ts) — `courses` now holds exactly these 5,
  with screenshot values applied. The `certificationAddOns` / `AddOn` exports were removed (the
  two premium programs are now full course cards). A new `"ESG Reporting"` `Framework` and an
  `image` field were added.
- **Preview:** [components/marketing/CoursePreview.tsx](../components/marketing/CoursePreview.tsx) —
  renders all 5 as identical cards with a placeholder banner on top; the paid add-on footer bar
  was dropped and the "all included in your subscription" wording softened.
- **Assets:** [public/courses/](../public/courses/) — one generated placeholder SVG per course
  (`<id>.svg`), rendered via a plain `<img>` to match the codebase convention (no `next/image`).

### Current course list

| id | Title | Lessons | Price | Framework |
|---|---|---|---|---|
| `fundamentals-esg-brsr` | Fundamentals of ESG & BRSR | 23 | ₹999 | ESG & BRSR |
| `ghg-accounting-mastery` | GHG Accounting Mastery in 20 Hours | 22 | ₹6,999 | GHG Accounting |
| `esg-readiness` | ESG Readiness | 28 | ₹6,999 | ESG Strategy |
| `live-lca-training` | Live Training — Master Life Cycle Assessment (LCA) | 1 | ₹20,000 | LCA |
| `esg-reporting-pro` | Become an ESG Reporting Pro | 2 | ₹35,000 | ESG Reporting |

## What still needs doing

1. **Real thumbnails.** Replace each `public/courses/<id>.svg` with the actual Learnyst banner,
   keeping the same filename/path. No code change required — the `image` field already points there.

2. **Learnyst URLs — done.** All five point at the live catalog
   (`https://academy.greenmentor.co/learn/<Slug>`, set as `LEARNYST_COURSES_URL` in
   [lib/learnyst/config.ts](../lib/learnyst/config.ts)):

   | Course | Real slug |
   |---|---|
   | Fundamentals of ESG & BRSR | `Intro-to-ESG-and-BRSR` (public title "Intro to ESG and BRSR") |
   | GHG Accounting Mastery in 20 Hours | `GHG-Accounting-101` (public title "Master GHG Accounting") |
   | ESG Readiness | `ESG-Readiness` |
   | Live Training — Master LCA | `Live-Training---Master-Life-Cycle-Assessment-LCA-` |
   | Become an ESG Reporting Pro | `Become-an-ESG-Reporting-Pro` |

   **Still open:** the auth base `LEARNYST_BASE_URL` (used for signup/login/handoff) is still the
   placeholder `https://learn.greenmentor.academy` in both config and `.env`, whereas the real
   catalog is `academy.greenmentor.co`. Confirm whether signup/login should also move to the real
   domain.

3. **Descriptions.** The screenshot had no copy, so the `description` strings for the two promoted
   courses (`live-lca-training`, `esg-reporting-pro`) were written in-voice. Verify or replace.

4. **Framework taxonomy.** A new `"ESG Reporting"` value was added to the `Framework` union for the
   Pro course. Confirm that's the intended label.

5. **Bundle callout.** The callout in [CoursePreview.tsx](../components/marketing/CoursePreview.tsx)
   still names "ESG Reporting Bundle, ESG Mastery Essentials". Confirm those bundles still exist now
   that the catalog is 5 courses, or update the names.

6. **Title formatting.** The screenshot shows `Master Life Cycle Assessment(LCA)`; the code uses
   `Live Training — Master Life Cycle Assessment (LCA)`. Adjust if the exact Learnyst title differs.

7. **(Optional) Card meta.** The lessons·price line was removed from the cards in an earlier edit, so
   the screenshot's `lessons` / `standalonePrice` values live in the data but are not displayed. If
   they should show on the cards, re-add a meta line under the title in
   [CoursePreview.tsx](../components/marketing/CoursePreview.tsx).
