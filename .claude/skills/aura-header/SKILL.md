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
   meta chips (mode, date, time), speaker (name, role, org, photo), brand,
   target size. Ask only for what's genuinely missing — infer sensible
   defaults for everything else (see "Defaults" below).

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
  "brand": "GreenMentor",
  "brandSub": "Sustainability Simplified",
  "theme": { "scrim": 0.55, "accent": "#07D862", "text": "#FFFFFF" }
}
```

## Defaults to infer (don't pester the user)

- `sizeId`: `newsletter` (1200×627) unless they say square/story/wide.
- `auraSlug`: the `green-vibrant` preset.
- `theme`: scrim 0.55, accent `#07D862`, text white. Raise scrim toward 0.75
  for busy backgrounds or long titles; lower toward 0.3 for airy ones.
- `brand` / `brandSub`: "GreenMentor" / "Sustainability Simplified".
- Chip icons: 🎥 virtual · 📍 in-person · 📅 date · ⏰ time · 🎙️ speaker series.
- Omit the speaker block entirely if no person is named.

## Tips

- Keep titles under ~90 chars — the renderer drops the title size automatically
  past that, but very long titles still crowd the speaker row.
- The in-app editor renders the **identical** markup (`headerDocumentHTML`), so
  if a user wants to fine-tune by hand, point them to
  `/header-studio`.
- For a batch (e.g. a webinar series), loop the render command over multiple
  config files.
