# EFDB — Emission Factor Database

Internal GHG emission factor database with AI-powered ingestion and natural-language retrieval.

---

## Prerequisites

- **Docker Desktop** (running)
- **An Anthropic API key** (`sk-ant-...`)

That's it. No Python or Node needed locally.

---

## First-time setup

### 1. Copy and configure environment

```bash
cd efdb
cp .env.example .env
```

Open `.env` and fill in:

```env
ANTHROPIC_API_KEY=sk-ant-your-key-here
JWT_SECRET=generate-a-random-32-char-string-here
POSTGRES_PASSWORD=choose-a-strong-password
```

Generate a JWT secret quickly:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Start the stack

```bash
docker compose up --build
```

First build takes ~3–5 minutes (pulling images, installing dependencies).
Subsequent starts take ~15 seconds.

### 3. Create the first admin user

`/auth/register` requires an existing admin, so the first admin is bootstrapped
via a CLI script. Once the stack is running, open a new terminal:

```bash
docker compose exec backend python -m scripts.create_admin \
  admin@yourcompany.com "Your Name" yourpassword
```

The script is idempotent — re-running it promotes an existing user to admin and
resets their password.

### 3b. (Optional) Google sign-in via Supabase Auth

Google login is brokered by Supabase Auth: the frontend runs
`signInWithOAuth({ provider: 'google' })`, lands on `/auth/callback`, and the
backend exchanges the Supabase access token for an EFDB JWT at `POST
/auth/oauth`. Only emails that already have an EFDB account can sign in —
accounts are still provisioned by admins, same as passwords. Leave the
`SUPABASE_*` vars empty to hide the Google button entirely.

One-time setup:

1. **Google Cloud Console** → APIs & Services → Credentials → Create OAuth
   client ID (type: Web application). Add the authorized redirect URI:
   `https://<project-ref>.supabase.co/auth/v1/callback`
2. **Supabase dashboard** → Authentication → Sign In / Providers → Google →
   enable, paste the Google client ID + secret.
3. **Supabase dashboard** → Authentication → URL Configuration → add to the
   redirect allowlist:
   - `http://localhost:5173/auth/callback`
   - `https://<your-vercel-domain>/auth/callback`
4. Fill `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `VITE_SUPABASE_URL` /
   `VITE_SUPABASE_ANON_KEY` in `.env` (dev). For prod, set the first two as Fly
   secrets on `efdb-api` and the `VITE_*` pair as Vercel env vars.

### 4. Open the app

| Service | URL |
|---------|-----|
| **Frontend** | http://localhost:5173 |
| **API docs** | http://localhost:8000/docs |
| **Database** | localhost:5432 (user: `efdb`, db: `efdb`) |

---

## Daily workflow

```bash
# Start
docker compose up

# Stop
docker compose down

# Rebuild after dependency changes
docker compose up --build

# View logs
docker compose logs -f backend
docker compose logs -f frontend
```

---

## Using the app

### Adding emission factors

1. Log in as **admin**
2. Click **Upload** in the top bar
3. Upload a PDF, Excel/CSV, or paste a URL to a public source document
4. Review the AI-identified tables and confirm the extraction
5. Review extracted records (paginated, 50/page) — approve, edit, or reject each
6. Click **Commit** — approved records are saved to the database

### Finding emission factors

**Table view:** Use the filter bar to search by activity, year, country, scope, source type, confidence, or GWP version. Click any row to see full details in the side panel.

**AI Chat:** Click **AI Chat** in the top bar. Ask in plain English:
- *"What emission factor should I use for diesel road freight in India for 2023?"*
- *"Recommend a UK grid electricity EF for Scope 2"*
- *"What's the best CH4 factor for natural gas combustion?"*

### Exporting

Click **Export CSV** in the table footer to download filtered results.

---

## Project structure

```
efdb/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app entry point
│   │   ├── config.py            # Settings from .env
│   │   ├── database.py          # SQLAlchemy async engine
│   │   ├── models/              # Database models
│   │   ├── routers/             # API endpoints (auth, EFs, ingestion, chat)
│   │   ├── schemas/             # Pydantic request/response schemas
│   │   └── services/
│   │       ├── extraction/      # PDF, Excel, URL extraction agents
│   │       ├── chat_agent.py    # AI chat with tool-calling
│   │       ├── confidence_score.py
│   │       ├── conflict_detection.py
│   │       └── embeddings.py
│   └── migrations/              # Alembic database migrations
├── frontend/
│   └── src/
│       ├── pages/               # LoginPage, MainPage, IngestionPage
│       ├── components/
│       │   ├── table/           # EFTable, FilterBar, SidePanel
│       │   ├── chat/            # ChatPanel
│       │   └── layout/          # TopBar
│       ├── lib/                 # api.ts, utils.ts
│       ├── stores/              # auth.ts (Zustand)
│       └── types/               # emission-factor.ts
├── docker-compose.yml
├── .env.example
└── EFDB.md                      # Full product requirements document
```

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.12, FastAPI, SQLAlchemy 2.0 (async) |
| Database | PostgreSQL 16 + pgvector (semantic search) |
| AI | Anthropic Claude API (Opus 4.6 for extraction, Sonnet 4.6 for chat) |
| Migrations | Alembic |
| PDF parsing | PyMuPDF (text) + Claude vision (scanned pages) |
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS + shadcn/ui components |
| State | TanStack Query (server) + Zustand (auth) |
| Table | TanStack Table v8 |

---

## Notes

- **Scanned PDFs** are handled natively by Claude's vision capability — no OCR library needed.
- **Semantic search** uses pgvector with deterministic embeddings by default. For production-quality synonym matching, replace `generate_embedding()` in `services/embeddings.py` with a real embedding API call (e.g., OpenAI `text-embedding-3-small`).
- **Confidence scores** are recalculated automatically when a record is edited. Bulk recalculation after weight changes will be added in Phase 2 (admin config panel).
- The **3 placeholder fields** in the schema are: `gwp_version` (GWP version/AR baseline), `custom_tags` (free-form tags), and `additional_notes` (catch-all text).
