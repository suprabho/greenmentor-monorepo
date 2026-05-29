# Lead sheet setup (Google Sheets via service account)

Onboarding leads are upserted into a Google Sheet — one row per visitor, keyed
by `leadId`, that fills in as they move through the flow (including people who
drop off before paying). `status` is `in_progress` until Razorpay payment is
verified, then flips to `completed`.

We write to the sheet **directly via the Google Sheets API**, authenticating as
a service account. There is **no Apps Script web app, no `/exec` URL, and no
"Who has access" deployment setting** — the things that historically broke this.

## How it flows

```
client syncLead()  ──▶  /api/lead (Next.js route, server-side)  ──▶  Google Sheets API
```

The route ([app/api/lead/route.ts](../app/api/lead/route.ts)) validates the
payload and calls `upsertLead()` ([lib/lead/sheets.ts](../lib/lead/sheets.ts)),
which signs a service-account JWT, exchanges it for an access token, and
upserts the row. Credentials live only in server env vars — they never reach the
browser.

## Columns written

`leadId · createdAt · updatedAt · status · step · name · email · phone · segment · goals · planId · billingCycle · razorpaySubscriptionId · razorpayPaymentId`

The code writes this header row on first use **and reconciles it on every
write** — if the column layout changes (e.g. a new field is added), the next
write updates the header in place. You never need to add or edit it manually,
and you don't need to swap in a fresh sheet when columns change.

> **Note on column order:** rows are written by position (`A:N`), so the header
> just labels existing columns. If you point at an *old* sheet whose data rows
> were written under a different layout, those old rows stay as-is — only the
> header and new rows follow the current order.

## One-time setup (~5 min)

1. **Create the Google Sheet** (any name). Leave it empty. From its URL, copy
   the **spreadsheet id** — the long token between `/d/` and `/edit`:
   `https://docs.google.com/spreadsheets/d/`**`<THIS_PART>`**`/edit`.
2. **Create a Google Cloud project** (or reuse one) at
   <https://console.cloud.google.com> → enable the **Google Sheets API**
   (APIs & Services → Library → "Google Sheets API" → Enable).
3. **Create a service account**: APIs & Services → Credentials → Create
   credentials → Service account. Name it anything (e.g. `lead-sheet-writer`).
   No roles needed. Create it.
4. **Make a JSON key**: open the service account → Keys → Add key → Create new
   key → **JSON**. A `.json` file downloads. It contains `client_email` and
   `private_key`.
5. **Share the sheet with the service account**: open the Sheet → Share → paste
   the service account's `client_email` (ends in
   `…iam.gserviceaccount.com`) → give it **Editor** → Send. *This is the step
   that grants write access — without it you'll get a 403.*
6. **Set the env vars** (in `.env.local` for local, and in your Vercel/host
   project settings for production) from the JSON key file:

   ```
   GOOGLE_SHEETS_CLIENT_EMAIL=<client_email from the JSON>
   GOOGLE_SHEETS_PRIVATE_KEY="<private_key from the JSON, as one line>"
   GOOGLE_SHEETS_SPREADSHEET_ID=<the id from step 1>
   ```

   > **Private key formatting:** the JSON's `private_key` contains real
   > newlines. Put it on a single line wrapped in double quotes, with each
   > newline written as the two characters `\n`. The code converts `\n` back to
   > real newlines at runtime. (Vercel's env UI accepts the multi-line PEM
   > pasted as-is; locally in `.env*` use the quoted `\n` form.)

That's it — no deployment, no redeploy step, no URL to rotate.

## Verify

With the dev server running and the env vars set:

```bash
curl -sS -X POST http://localhost:3000/api/lead \
  -H 'Content-Type: application/json' \
  -d '{"leadId":"test-1","status":"in_progress","step":"welcome","name":"Test User","email":"test@example.com","phone":"+919876543210","goals":["certification"]}'
# → {"ok":true,"id":"test-1"}
```

A row should appear in the sheet. POST again with the same `leadId` and a
different `step` — it should update the same row, not add a new one. Delete the
test row afterwards.

If `/api/lead` returns `{"ok":true}` but no row appears, the env vars aren't set
(the route silently logs to the console instead — check the dev server output).
If it returns `502`, check the server logs for the Sheets API error — a `403`
there means the sheet isn't shared with the service-account email (step 5).

## Notes

- **Concurrency:** the upsert does a read-then-write, so two simultaneous syncs
  for the *same* leadId could in theory race. Lead volume is low and each
  visitor syncs serially, so this is acceptable in practice; if it ever matters,
  move the write behind a queue.
- **Security:** credentials are server-only env vars and never reach the
  browser. The service account has access to nothing except sheets you
  explicitly share with its email.
- **No public surface:** unlike the old Apps Script web app, there is no
  publicly reachable endpoint to leak or lock down.
