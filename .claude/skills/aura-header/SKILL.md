---
name: aura-header
description: >-
  Generate GreenMentor webinar / newsletter header images (badge, title,
  date/time chips, speaker card) rendered over a live animated "aura"
  background, exported as a pixel-perfect PNG. Trigger when the user asks to
  "make/create a header image", "webinar banner", "newsletter header",
  "event graphic", "fireside chat header", "social header", or references the
  Aura Header Studio. Takes a plain-English brief, picks an aura background,
  writes a config, renders the PNG.
---

# Aura Header Studio — skill

Turn a short brief ("fireside chat with Ankit Todi on energy transition,
June 4, 4–5pm IST, virtual") into a finished header PNG over a real animated
aura background — the same renderer behind the in-app **Community → Tools →
Aura Header Studio** page.

## Where things live

All paths are under the community-engine app:
`green-mentor-pro/community-engine/` (run commands from there).

| Thing | Path |
|---|---|
| Config contract + presets | `lib/header/types.ts` |
| Canonical HTML renderer | `lib/header/render.ts` |
| Screenshot helper | `lib/header/screenshot.ts` |
| CLI renderer (this skill calls it) | `scripts/render-header.ts` |
| In-app editor | `app/header-studio/page.tsx` |

## Workflow

1. **Read `lib/header/types.ts`** to get the exact current `HeaderConfig`
   shape, `SIZE_PRESETS`, and `AURA_PRESETS`. Treat that file as the source of
   truth — do not hardcode fields from memory.

2. **Gather the brief.** Extract: badge/tag, title, optional subtitle,
   meta chips (mode, date, time), speaker(s) (name, role, org, photo, tag),
   brand, target size. Ask only for what's genuinely missing — infer sensible
   defaults for everything else (see "Defaults" below).

   **Multi-speaker headers**: put the roster in `speakers` (an array of the
   same speaker shape, plus optional `tag` like "Host"/"Moderator") with the
   lead instructor FIRST, and pick a `template` (see `TEMPLATE_PRESETS` in
   types.ts):
   - `classic` (default) — single speaker card in the footer; extra roster
     entries collapse to a "+N more" hint.
   - `spotlight` — lead front and center, supporting speakers flanking
     outward; centered headline. 1–6 speakers.
   - `lineup` — conference-style equal columns (tag / name / role /
     portrait); lead column accent-framed. Best at 3–5.
   - `billboard` — big headline top-left, bottom-aligned speaker row on the
     right, lead first and larger. Best at 2–4.
   - `gallery` — large rounded photo cards with name plates; lead card
     accented. Best at 1–4.
   Every grid recomputes card/photo sizes from the roster length, so adding
   or removing a speaker never needs manual layout tweaks. Speakers without
   a photo render an initials monogram tile. Multi-speaker templates want
   vertical room — prefer `newsletter`, `webinar-wide`, `square`, or `story`
   (strips always fall back to the compact single-speaker layout).

3. **Pick an aura background.** Default to the `green-vibrant` preset (verified
   live, on-brand). To choose something else, use the scene-context-graph
   taxonomy (invoke the `scene-context-graph` skill if you need depth):
   - **fluid** → tech / SaaS / data themes (blues, cyans)
   - **aurora** → premium, atmospheric, evening/energy themes (purple→cyan)
   - **ribbon** → elegant, light, corporate
   - **liquid** → creative, abstract, luxury
   The user can paste any slug from `https://aura.promad.design`; the embed URL
   is `https://aura.promad.design/embed/<slug>?hideText=true` (handled by
   `auraEmbedUrl` in types.ts — pass the bare slug or a full URL in `auraSlug`).

4. **Write the config JSON** to a temp file, e.g. `/tmp/header-config.json`.
   Only include fields you're overriding; the script merges over
   `DEFAULT_CONFIG`.

5. **Render** from `green-mentor-pro/community-engine/`:
   ```bash
   npx tsx scripts/render-header.ts --config /tmp/header-config.json --out /tmp/header.png
   ```
   - First run needs the browser: `npx playwright install chromium`.
   - Speaker photo: use an absolute `https://…` URL, OR a `/avatars/…` path
     **with** `--origin http://localhost:3200` while `npm run dev` is running,
     OR a `file://` path. A bare `/avatars/…` path with no origin won't load.
   - Sizes: `--scale 2` (default) is retina-crisp. `--settle 3000` if the aura
     looks flat (gives the animation longer to warm up).

6. **Report** the output path and show the image to the user. Offer tweaks
   (different aura, size, scrim, accent) — re-render by editing the JSON.

## Config example

```json
{
  "sizeId": "newsletter",
  "auraSlug": "green-background-vibrant-abstract-website-header-design",
  "badge": "FIRESIDE CHAT",
  "title": "Navigating Energy Transition for Indian Industries: From Intent to Execution",
  "chips": [
    { "icon": "🎥", "label": "Virtual Mode" },
    { "icon": "📅", "label": "04 June, 2026" },
    { "icon": "⏰", "label": "4:00 – 5:00 PM IST" }
  ],
  "speaker": {
    "name": "Ankit Todi",
    "role": "Chief Sustainability Officer",
    "org": "Mahindra Group",
    "photo": "https://example.com/ankit.jpg"
  },
  "brandId": "greenmentor",
  "brandSub": "Sustainability Simplified",
  "theme": { "scrim": 0.55, "accent": "#07D862", "text": "#FFFFFF" }
}
```

Multi-speaker variant — swap `speaker` for `speakers` (lead first) and pick a
`template`:

```json
{
  "template": "spotlight",
  "speakers": [
    { "name": "Ankit Todi", "role": "Chief Sustainability Officer", "org": "Mahindra Group", "photo": "https://…", "tag": "Host" },
    { "name": "Meera Iyer", "role": "Head of ESG", "org": "Infosys", "photo": "https://…" },
    { "name": "Rohan Shah", "role": "Climate Lead", "org": "Tata Steel", "photo": "https://…" }
  ]
}
```

## Defaults to infer (don't pester the user)

- `sizeId`: `newsletter` (1200×627) unless they ask otherwise. Other presets
  (see `SIZE_PRESETS`): `newsletter-strip` (1100×220 thin banner),
  `webinar-wide` (1600×900, 16:9), `square` (1080×1080 — also the webinar
  square), `wide` (1500×500), `story` (1080×1350). For a webinar that needs
  both a 16:9 and a square, render `webinar-wide` and `square` from the same
  config (just change `sizeId`).
- `auraSlug`: the `green-vibrant` preset.
- `theme`: scrim 0.55, accent `#07D862`, text white. Raise scrim toward 0.75
  for busy backgrounds or long titles; lower toward 0.3 for airy ones.
- `brandId` / `brandSub`: `greenmentor` / "Sustainability Simplified". `brandId`
  picks a lockup from the brand catalog (`lib/header/brands.ts`); GreenMentor is
  the only brand today. Omit `brandSub` to use the brand's own default subline.
- Chip icons: 🎥 virtual · 📍 in-person · 📅 date · ⏰ time · 🎙️ speaker series.
- Omit the speaker block entirely if no person is named.

## Tips

- Keep titles under ~90 chars — the renderer drops the title size automatically
  past that, but very long titles still crowd the speaker row.
- `titleScale` (0.5–2, default 1) multiplies the computed title size. It only
  sets the *starting* size: the rendered document auto-shrinks the headline
  block until nothing overflows, and the speaker stage never gives up its
  space (photos hold ≥ half the canvas in the multi-speaker templates), so a
  big value can't push the photos off.
- `photoFx` styles every speaker photo: `bw: true` renders them black & white
  (non-destructive CSS grayscale); `panel: true` paints a gradient panel
  behind each photo frame — meant for cutout photos with transparent
  backgrounds (in-app the studio's "Cut out BG" button makes those via POST
  `/api/photo/cutout`, a vendored U²-Net model — no external service, and
  stores original / cutout / B&W-cutout variants on the speaker's
  `photoVariants` for its picker). The panel gradient is configurable:
  `gradientType` ("linear" with `gradientAngle`, default 180°, or "radial")
  over `stops` (`{ color, alpha 0–1, at % }`, default light-grey → accent).
  Frame overrides: `radius` (baseline px, canvas-scaled), `border: false`
  hides frame borders, `borderColor` overrides them (lead's accent
  included). B&W cutouts on accent panels reproduce the RIOBook-style
  reference look.
- `newsletter-strip` (1100×220) uses a horizontal layout (badge + title + chips
  on the left, speaker + brand on the right) and clamps the title to 2 lines —
  keep its title short (≤ ~55 chars) and use 1–2 chips so it reads as a banner.
- The in-app editor renders the **identical** markup (`headerDocumentHTML`), so
  if a user wants to fine-tune by hand, point them to
  `/header-studio`.
- For a batch (e.g. a webinar series), loop the render command over multiple
  config files.
