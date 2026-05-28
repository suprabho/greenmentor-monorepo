# Lead sheet setup (Google Sheets via Apps Script)

Onboarding leads are upserted into a Google Sheet — one row per visitor, keyed
by `leadId`, that fills in as they move through the flow (including people who
drop off before paying). `status` is `in_progress` until Razorpay payment is
verified, then flips to `completed`.

## How it flows

```
client syncLead()  ──▶  /api/lead (Next.js route, server-side)  ──▶  Apps Script /exec  ──▶  Google Sheet
```

The Apps Script `/exec` URL lives only in the server env (`SHEETS_WEBHOOK_URL`),
so it never reaches the browser. `/api/lead` validates the payload, then POSTs
`{ secret, lead }` to the script.

## Columns written

`leadId · createdAt · updatedAt · status · step · name · email · segment · goals · planId · billingCycle · razorpaySubscriptionId · razorpayPaymentId`

The script auto-creates this header row on first write — you don't need to add
it manually.

## One-time setup (~5 min)

1. Create a new Google Sheet (any name). Leave it empty.
2. **Extensions → Apps Script**. Delete the stub `Code.gs` contents and paste
   the script below. Save.
3. *(Optional but recommended)* Set `SHARED_SECRET` in the script to a random
   string, and put the same value in the app's `SHEETS_WEBHOOK_SECRET` env var.
4. **Deploy → New deployment → ⚙ → Web app**:
   - **Execute as:** Me
   - **Who has access:** Anyone
   - Deploy, authorize when prompted, and copy the **Web app URL** (ends in
     `/exec`).
5. Paste that URL into the app env as `SHEETS_WEBHOOK_URL` (e.g. in
   `.env.local`, and in your Vercel/host project settings for production).

> Re-deploying code changes: use **Deploy → Manage deployments → ✏ Edit →
> Version: New version**. Editing the existing deployment keeps the same
> `/exec` URL, so you don't have to update the env var.

## Verify

With the dev server running:

```bash
curl -sS -X POST http://localhost:3000/api/lead \
  -H 'Content-Type: application/json' \
  -d '{"leadId":"test-1","status":"in_progress","step":"welcome","name":"Test User","email":"test@example.com","goals":["certification"]}'
# → {"ok":true,"id":"test-1"}
```

A row should appear in the sheet. POST again with the same `leadId` and a
different `step` — it should update the same row, not add a new one. Delete the
test row afterwards.

## The Apps Script

Paste this into the Apps Script editor (`Code.gs`):

```javascript
/**
 * GreenMentor — onboarding lead sink.
 * Upserts one row per leadId into the first sheet of the bound spreadsheet.
 * Deploy as a Web App (Execute as: Me, Who has access: Anyone) and put the
 * /exec URL in the app's SHEETS_WEBHOOK_URL env var.
 */

// Must match SHEETS_WEBHOOK_SECRET in the app's env. Leave "" to disable.
const SHARED_SECRET = "";

const HEADERS = [
  "leadId",
  "createdAt",
  "updatedAt",
  "status",
  "step",
  "name",
  "email",
  "segment",
  "goals",
  "planId",
  "billingCycle",
  "razorpaySubscriptionId",
  "razorpayPaymentId",
];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000); // serialize concurrent upserts
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (SHARED_SECRET && payload.secret !== SHARED_SECRET) {
      return json({ ok: false, error: "unauthorized" });
    }

    const lead = payload.lead || {};
    if (!lead.leadId) {
      return json({ ok: false, error: "missing leadId" });
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
      sheet.setFrozenRows(1);
    }

    const now = new Date().toISOString();
    const goals = Array.isArray(lead.goals)
      ? lead.goals.join(", ")
      : lead.goals || "";

    // Find an existing row by leadId (column A).
    const lastRow = sheet.getLastRow();
    let rowIndex = -1;
    if (lastRow >= 2) {
      const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (let i = 0; i < ids.length; i++) {
        if (ids[i][0] === lead.leadId) {
          rowIndex = i + 2;
          break;
        }
      }
    }

    const isNew = rowIndex === -1;
    const createdAt = isNew
      ? now
      : sheet.getRange(rowIndex, 2).getValue() || now;

    const row = [
      lead.leadId,
      createdAt,
      now, // updatedAt
      lead.status || "in_progress",
      lead.step || "",
      lead.name || "",
      lead.email || "",
      lead.segment || "",
      goals,
      lead.planId || "",
      lead.billingCycle || "",
      lead.razorpaySubscriptionId || "",
      lead.razorpayPaymentId || "",
    ];

    if (isNew) {
      sheet.appendRow(row);
    } else {
      sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
    }

    return json({ ok: true, leadId: lead.leadId, updated: !isNew });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
```

## Notes

- **Concurrency:** `LockService` serializes writes so two simultaneous syncs
  for different leads can't clobber each other's row.
- **Redirects:** Apps Script web apps 302 to a `googleusercontent.com` URL on
  POST. Node's `fetch` (used by `/api/lead`) follows that by default and the
  write still happens — no special handling needed.
- **Security:** an "Anyone" web app is reachable by anyone who has the `/exec`
  URL. Since the URL is server-only and the optional `SHARED_SECRET` gates
  writes, a leak alone can't spam the sheet. For stronger guarantees, move to a
  service-account + Sheets API integration later.
