# Task: Source logos for the "Where our learners go" hiring companies

## Goal
The **"Where our learners go"** section renders 50 hiring companies as text pills (a top-10
prominent set + 40 more behind a "See more" toggle). Obtain an official **logo** for each company
and place it locally in `public/brand/logos/`, so the section can later render them as a logo wall
instead of (or alongside) the text pills.

This brief covers **sourcing the assets only**. Wiring them into the UI is a follow-up — see
"Out of scope" at the end.

## Context: what exists today

- **Component:** [components/marketing/HiringCompanies.tsx](../components/marketing/HiringCompanies.tsx).
  Companies are rendered as `<span>` pills (green for the top set, gray-bordered for the long tail).
- **Data:** [lib/data/hiring-companies.ts](../lib/data/hiring-companies.ts) exports two plain
  `string[]` arrays: `topHiringCompanies` (10) and `moreHiringCompanies` (40). They are consumed
  **only** by `HiringCompanies.tsx`.
- **Assets:** logos live in [public/brand/logos/](../public/brand/logos/) and are referenced as
  `/brand/logos/<file>`. **Already present — reuse, do not re-source:** `bcg.svg`, `ey.svg`,
  `pwc.svg`. KPMG also exists at `/brand/partner-kpmg.png`.
- **Conventions:** Next.js + Tailwind v4 (no `tailwind.config`). The project uses **pnpm**
  (`pnpm-lock.yaml`). Plain `<img>` tags are used throughout (not `next/image`), each preceded by
  `{/* eslint-disable-next-line @next/next/no-img-element */}`. `next.config.ts` has **no** remote
  image config, so **all logos must be downloaded and committed locally** — do not hotlink remote URLs.

## Step 1 — Source the logos (local assets only)

For each of the 50 companies below, obtain an official logo and save it to
`public/brand/logos/<slug>.svg`. **Skip `bcg`, `ey`, `pwc`** (already present) and **`kpmg`**
(reuse `/brand/partner-kpmg.png`). That leaves **46 to source**.

Requirements:
- Prefer **SVG**; transparent-background **PNG** is acceptable if no clean SVG exists.
- Must have a **transparent background** and clean edges. Trim surrounding whitespace.
- Use the **official mark/wordmark** at a reasonable resolution; do not distort aspect ratios.
- Save as `logos/<slug>.svg` (or `.svg`/`.png` as sourced) using the exact slug in the table.

### Where to fetch
These are mostly large, listed Indian and global companies, so good sources in order of preference:
1. **Wikimedia Commons / the company's Wikipedia infobox** — usually has the official SVG logo.
2. The company's **own website** (brand/press/media kit pages, or the SVG in the site header).
3. **Simple Icons** (simpleicons.org) — only covers some global brands (Shell, Siemens, Unilever,
   Nestlé, P&G, ABB, Schneider Electric); single-color SVGs.

Verify each download is the **right entity** — several names collide (see notes column). Confirm the
mark is recognizable before saving.

### Top hiring companies (prominent set)

| Company       | slug            | source notes |
|---------------|-----------------|--------------|
| Tata          | `tata`          | Tata Group corporate mark (the "Tata" oval/wordmark) — **not** a Tata operating company logo |
| Reliance      | `reliance`      | Reliance Industries Ltd |
| Mahindra      | `mahindra`      | Mahindra Group "Rise" mark |
| Arabesque     | `arabesque`     | Arabesque (ESG / asset-management firm, arabesque.com) — **not** unrelated "Arabesque" brands |
| BCG           | `bcg`           | **EXISTS** — reuse `/brand/logos/bcg.svg` |
| EY            | `ey`            | **EXISTS** — reuse `/brand/logos/ey.svg` |
| KPMG          | `kpmg`          | **EXISTS** — reuse `/brand/partner-kpmg.png` |
| PwC           | `pwc`           | **EXISTS** — reuse `/brand/logos/pwc.svg` |
| Deloitte      | `deloitte`      | Deloitte wordmark (with the green dot) |
| ReNew Energy  | `renew-energy`  | ReNew (formerly ReNew Power), renew.com |

### More hiring companies (long tail)

| Company            | slug                 | source notes |
|--------------------|----------------------|--------------|
| Shell              | `shell`              | Shell pecten |
| Wipro              | `wipro`              | current Wipro mark |
| Infosys            | `infosys`            | Infosys wordmark |
| HCL                | `hcl`                | HCLTech (current rebrand) |
| Adani              | `adani`              | Adani Group |
| JSW                | `jsw`                | JSW Group — **distinct from JSL below** |
| Godrej             | `godrej`             | Godrej Group |
| ITC                | `itc`                | ITC Limited |
| Marico             | `marico`             | Marico Limited |
| L&T                | `lt`                 | Larsen & Toubro |
| HDFC Bank          | `hdfc-bank`          | the bank specifically |
| Axis Bank          | `axis-bank`          | |
| SBI                | `sbi`                | State Bank of India |
| ICICI Bank         | `icici-bank`         | |
| Kotak              | `kotak`              | Kotak Mahindra Bank |
| Aditya Birla       | `aditya-birla`       | Aditya Birla Group (the rising-sun mark) |
| Vedanta            | `vedanta`            | Vedanta Limited / Resources |
| NTPC               | `ntpc`               | |
| ONGC               | `ongc`               | Oil and Natural Gas Corporation |
| Siemens            | `siemens`            | |
| Schneider Electric | `schneider-electric` | |
| ABB                | `abb`                | |
| Unilever           | `unilever`           | the "U" mark |
| Nestlé             | `nestle`             | |
| P&G                | `pg`                 | Procter & Gamble |
| Dalmia Cement      | `dalmia-cement`      | Dalmia Bharat / Dalmia Cement |
| UltraTech          | `ultratech`          | UltraTech Cement (Aditya Birla) |
| JSL                | `jsl`                | Jindal Stainless — **distinct from JSW above** |
| Tata Steel         | `tata-steel`         | Tata Steel specifically — **distinct from the `tata` group mark** |
| SAIL               | `sail`               | Steel Authority of India |
| Greenko            | `greenko`            | Greenko Group |
| Sterlite Power     | `sterlite-power`     | Sterlite Power — **not** Sterlite Technologies (STL) |
| Torrent Power      | `torrent-power`      | Torrent Group / Torrent Power |
| Hero MotoCorp      | `hero-motocorp`      | **not** Hero Cycles / Hero FinCorp |
| Bajaj Auto         | `bajaj-auto`         | Bajaj Auto specifically |
| TVS Motor          | `tvs-motor`          | TVS Motor Company |
| Asian Paints       | `asian-paints`       | |
| Pidilite           | `pidilite`           | Pidilite Industries |
| Havells            | `havells`            | |
| Voltas             | `voltas`             | Voltas (Tata) |

> **Brand / legal note:** these are third-party trademarks. Use them only to truthfully indicate
> where learners have been hired, use official marks, and don't distort aspect ratios. If any
> company's hiring claim can't be substantiated, flag it to the requester rather than shipping the
> logo.

## Step 2 — Sanity-check the assets
- 50 slugs total; **46 new files** in `public/brand/logos/` after this task (3 SVGs + 1 PNG reused).
- Each file opens, has a transparent background, and is the correct company.
- Filenames exactly match the `slug` column (lowercase, kebab-case).
- No accidental committing of large raster files where an SVG was available.

## Out of scope (follow-up)
Rendering these in the UI is a separate change and a design decision (50 logos is a big visual
shift from the current pills). When that's approved, the pattern will mirror
[docs/hero-company-logos-brief.md](./hero-company-logos-brief.md):
1. Convert `topHiringCompanies` / `moreHiringCompanies` in
   [lib/data/hiring-companies.ts](../lib/data/hiring-companies.ts) from `string[]` to
   `{ name: string; logo: string }[]`.
2. Update [components/marketing/HiringCompanies.tsx](../components/marketing/HiringCompanies.tsx)
   to render `<img>` logos. Note: unlike the dark hero, this section sits on a **light**
   background — so logos likely render in their **natural colors** (no `brightness-0 invert`),
   or as a uniform dark monochrome. Decide with the requester.

## Done when
All 46 missing logos are sourced as transparent-background assets in `public/brand/logos/`, named
by the slugs above, each verified as the correct company. No UI changes required by this brief.
