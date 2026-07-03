# header-render-service

Warm-browser render microservice for GreenMentor aura headers, deployed on Fly.io.

## Why

The header export ("Render") is a real headless-Chromium screenshot of a live
cross-origin **WebGL** aura iframe. Running that on a Vercel serverless Lambda meant
paying Chromium cold-start extraction on every invocation and rendering software
WebGL under a hard `maxDuration` — which overran the limit
(`FUNCTION_INVOCATION_TIMEOUT`).

This service keeps **one Chromium warm** across requests and uses the **full
Playwright build** (no `@sparticuz/chromium`, so none of its bin-tracing or
version-mismatch pitfalls). `community-engine`'s `/api/header/export` route generates
the header HTML exactly as before and POSTs it here; this service just drives the
browser and returns the encoded image. It owns **zero** product logic.

## API

Auth: every `POST /shot` must send `x-render-secret: <HEADER_RENDER_SECRET>`.

- `GET /health` → `200 ok`
- `POST /shot` → image bytes (`image/png` | `image/webp`)

  ```jsonc
  {
    "html": "<!doctype html>…",  // required — the full header document
    "width": 1200,                // required — CSS width
    "height": 627,                // required — CSS height
    "dpr": 2,                     // optional (default 2)
    "selector": "#header",        // optional (default "#header")
    "settleMs": 2600,             // optional aura warm-up (default 2600)
    "format": "png",              // optional "png" | "webp" (default "png")
    "quality": 90                 // optional WebP quality (default 90)
  }
  ```

## Deploy (manual — same topology as the efdb backend, no CI)

From this directory:

```bash
fly launch --no-deploy          # first time only, if the app doesn't exist yet
fly secrets set HEADER_RENDER_SECRET=<generate a strong value>
fly deploy
```

Then, on the **`greenmentor-community-tools`** Vercel project (Production + Preview):

```
HEADER_RENDER_URL    = https://greenmentor-header-render.fly.dev
HEADER_RENDER_SECRET = <same value as the Fly secret>
```

With `HEADER_RENDER_URL` set, the export route proxies here. Unset (e.g. local dev),
it falls back to rendering in-process with local Playwright.

## Env

| var                    | default | notes                                   |
| ---------------------- | ------- | --------------------------------------- |
| `PORT`                 | `8080`  | Fly `internal_port` matches this.       |
| `HEADER_RENDER_SECRET` | —       | Required; `/shot` rejects all if unset. |
| `RENDER_CONCURRENCY`   | `3`     | Max concurrent renders per machine.     |

## Local run

```bash
npm install
HEADER_RENDER_SECRET=dev npm start
# then: curl -sS -X POST localhost:8080/shot -H 'x-render-secret: dev' \
#   -H 'content-type: application/json' -d @payload.json --output out.png
```

## Keep in sync

The Docker base image tag (`mcr.microsoft.com/playwright:vX.Y.Z-jammy`) **must** match
the `playwright` version in `package.json`. Bump both together.
