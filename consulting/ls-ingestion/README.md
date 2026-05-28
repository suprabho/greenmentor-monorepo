# Greenmentor Bill Ingestion — Local Setup

Runs the full MVP locally with real Claude extraction and real EFDB lookup.
No Vercel deployment needed. Everything on localhost.

## Architecture

```
Browser (localhost:3000)
    │
    ├── /efdb/*  ──────proxy──────►  EFDB FastAPI  (localhost:8000)
    │                                     │
    │                                     └── PostgreSQL (local or Supabase)
    │
    └── /anthropic/*  ──proxy──►  api.anthropic.com
              (API key injected here — never in browser)
```

## Setup

### 1. Start EFDB backend

```bash
cd efdb/backend
cp .env.example .env        # fill in DATABASE_URL, SECRET_KEY etc.
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Verify: http://localhost:8000/api/health → {"status":"ok"}
Verify: http://localhost:8000/api/emission-factors/public?q=diesel&country=IN

### 2. Start Greenmentor frontend

```bash
cd greenmentor-local
cp .env.example .env
# Add your ANTHROPIC_API_KEY to .env
npm install
npm run dev
```

Open: http://localhost:3000

### 3. Add India emission factors to EFDB

Open the EFDB UI at http://localhost:8000 (or efdb-kappa.vercel.app) and add:

| canonical_activity_name              | ef_total_co2e | unit           | scope   | country | source                        |
|--------------------------------------|---------------|----------------|---------|---------|-------------------------------|
| electricity purchased — India grid   | 0.757         | kg CO2e / kWh  | Scope 2 | IN      | CEA CO2 Baseline v20.0        |
| diesel combustion — road/stationary  | 2.68          | kg CO2e / litre| Scope 1 | IN      | IPCC 2006 Guidelines          |
| petrol combustion                    | 2.31          | kg CO2e / litre| Scope 1 | IN      | IPCC 2006 Guidelines          |
| CNG combustion — natural gas         | 2.21          | kg CO2e / kg   | Scope 1 | IN      | IPCC 2006 Guidelines          |
| LPG combustion                       | 1.611         | kg CO2e / litre| Scope 1 | IN      | IPCC 2006 Guidelines          |
| HSD fuel oil combustion              | 2.77          | kg CO2e / litre| Scope 1 | IN      | IPCC 2006 Guidelines          |
| coal combustion — bituminous         | 2.42          | kg CO2e / kg   | Scope 1 | IN      | IPCC 2006 Guidelines          |

### 4. Test the integration

```bash
# EFDB public endpoint live?
curl "http://localhost:8000/api/emission-factors/public?q=diesel&country=IN&scope=Scope+1"
# Should return items[] with India diesel factor

# Claude API reachable?
curl -X POST http://localhost:3000/anthropic/v1/messages \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-sonnet-4-6","max_tokens":10,"messages":[{"role":"user","content":"hi"}]}'
# Should return a response (API key injected by proxy)
```

## How the proxy works

The Vite dev server acts as a middleman:

- `GET /efdb/emission-factors/public` → forwards to `http://localhost:8000/api/emission-factors/public`
- `POST /anthropic/v1/messages` → forwards to `https://api.anthropic.com/v1/messages` AND injects your `ANTHROPIC_API_KEY` header

This means:
- No CORS issues (same origin: localhost:3000)
- API key never sent to browser — Vite injects it at the proxy layer
- EFDB on HTTP localhost works fine (no mixed-content issue)

## When to deploy to Vercel

Only needed when you want to share with external users (companies submitting bills,
govt reviewers). At that point:
- Frontend → Vercel (with ANTHROPIC_API_KEY as env var, proxy stays the same)
- EFDB backend → your existing Vercel deployment
- Update EFDB CORS to include your Vercel frontend URL
