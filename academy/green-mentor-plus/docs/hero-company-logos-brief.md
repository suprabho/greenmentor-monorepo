# Task: Replace instructor company text pills with logos in the Hero

## Goal
In the hero, the row labeled **"Instructors with experience at"** currently renders the
companies as styled text pills. Replace them with monochrome white **company logos** that sit
on the dark-teal hero background, matching the visual treatment already used by the **"Backed By"**
row directly below it.

## Context: what exists today

- **Component:** [components/marketing/Hero.tsx](../components/marketing/Hero.tsx) — the pill row is at
  lines ~86–100:
  ```tsx
  <div className="mt-12 rounded-md border border-white/10 bg-teal-800/40 p-5 md:p-6 backdrop-blur-3xl">
    <p className="gm-eyebrow text-green-100">Instructors with experience at</p>
    <div className="mt-4 flex flex-wrap gap-2">
      {instructorCompanies.map((co) => (
        <span
          key={co}
          className="rounded-full bg-green-100 px-3 py-1 text-[12px] font-semibold text-teal-900"
        >
          {co}
        </span>
      ))}
    </div>
  </div>
  ```

- **Data:** [lib/data/instructors.ts](../lib/data/instructors.ts) exports
  `instructorCompanies: string[]` = `["EY", "KPMG", "PwC", "Harvard", "Boeing", "Coca-Cola", "BCG"]`.
  It is consumed **only** by `Hero.tsx`.

- **Existing monochrome-logo pattern** to copy — the "Backed By" row in the same file (lines ~104–124):
  ```tsx
  {/* eslint-disable-next-line @next/next/no-img-element */}
  <img
    src="/brand/partner-iitb.png"
    alt="IIT-B Innovation Centre"
    className="h-8 w-auto object-contain brightness-0 invert"
  />
  ```
  The `brightness-0 invert` filter flattens any logo to solid white — this is the key trick that
  makes mismatched-color logos look consistent on the teal background.

- **Assets:** logos live in [public/brand/](../public/brand/) and are referenced as `/brand/<file>`.
  The only instructor logo that already exists is **KPMG** → `/brand/partner-kpmg.png`.
  Missing: EY, PwC, Harvard, Boeing, Coca-Cola, BCG.

- **Conventions:** plain `<img>` tags are used throughout (not `next/image`); each is preceded by
  `{/* eslint-disable-next-line @next/next/no-img-element */}`. `next.config.ts` has **no** remote
  image config, so do not introduce remote-hosted images. Tailwind v4, no `tailwind.config`. The
  project uses **pnpm** (`pnpm-lock.yaml` present).

## Steps

### 1. Source the logos (local assets only)
For each missing company — **EY, PwC, Harvard, Boeing, Coca-Cola, BCG** — obtain an official
logo and place it in `public/brand/logos/`. Requirements:

- Prefer **SVG**; PNG with transparent background is acceptable.
- Single-color or full-color is fine — the `brightness-0 invert` filter will flatten it to white,
  so what matters is a **transparent background** and clean edges.
- Name files `logos/<slug>.svg` using a lowercase slug: `ey`, `pwc`, `harvard`, `boeing`,
  `coca-cola`, `bcg`.
- For KPMG, reuse the existing `/brand/partner-kpmg.png` (do not re-source it).

> **Brand/legal note:** these are third-party trademarks. Use them only to truthfully indicate
> instructor experience, use official marks, and don't distort aspect ratios. Flag to the requester
> if any mark (e.g. the Coca-Cola script) becomes unrecognizable as flat white — those may read
> better without the `brightness-0 invert` filter.

### 2. Update the data model
Change `instructorCompanies` in [lib/data/instructors.ts](../lib/data/instructors.ts) from
`string[]` to a typed array of objects so each entry carries its logo path and accessible label:

```ts
export type InstructorCompany = {
  /** Display / alt name. */
  name: string;
  /** Public path to a transparent-background logo, e.g. "/brand/logos/ey.svg". */
  logo: string;
};

export const instructorCompanies: InstructorCompany[] = [
  { name: "EY", logo: "/brand/logos/ey.svg" },
  { name: "KPMG", logo: "/brand/partner-kpmg.png" },
  { name: "PwC", logo: "/brand/logos/pwc.svg" },
  { name: "Harvard", logo: "/brand/logos/harvard.svg" },
  { name: "Boeing", logo: "/brand/logos/boeing.svg" },
  { name: "Coca-Cola", logo: "/brand/logos/coca-cola.svg" },
  { name: "BCG", logo: "/brand/logos/bcg.svg" },
];
```

### 3. Update the Hero component
Replace the text-pill `map` (Hero.tsx ~lines 90–98) with logo images. Keep the surrounding
container/label. Render each logo with the same monochrome treatment as the "Backed By" row:

```tsx
<div className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-5">
  {instructorCompanies.map((co) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={co.name}
      src={co.logo}
      alt={co.name}
      className="h-7 w-auto object-contain opacity-90 brightness-0 invert md:h-8"
    />
  ))}
</div>
```

Notes:
- `h-7 md:h-8` normalizes height; `w-auto object-contain` preserves each logo's aspect ratio.
- `flex-wrap` + `gap-x-8 gap-y-5` spaces logos like a logo wall rather than tight pills.
- Keep `key` stable — switch it from `co` to `co.name`.
- The unused `bg-green-100`/text styling on the old pills goes away. The wrapping
  `bg-teal-800/40` card and the `gm-eyebrow` label stay as-is.

### 4. Verify
- `pnpm dev` (or `pnpm build`) — must compile with no TypeScript errors.
- Load the homepage; confirm all 7 logos render (no broken-image icons), appear white, share a
  consistent height, and wrap cleanly on mobile widths.
- Check the browser console for 404s on any `/brand/logos/*` path.
- Confirm the "Backed By" row below is unchanged.

## Done when
All seven instructor logos render as consistent monochrome white marks in the hero, the data is
typed, the build is clean, and there are no missing-asset 404s.
