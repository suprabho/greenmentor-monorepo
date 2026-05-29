import crypto from "node:crypto";

/**
 * Direct Google Sheets writer for onboarding leads — no Apps Script web app,
 * no /exec URL, no "Who has access" deployment setting. Authenticates as a
 * service account (JWT → OAuth token) and upserts one row per leadId via the
 * Sheets REST API. See docs/lead-sheet-setup.md.
 *
 * Zero npm dependencies: the JWT is signed with Node's crypto and every call
 * uses global fetch (Node 18+).
 */

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets";

// Column layout — must stay in this order; rows are written by position.
const HEADERS = [
  "leadId",
  "createdAt",
  "updatedAt",
  "status",
  "step",
  "name",
  "email",
  "phone",
  "segment",
  "goals",
  "planId",
  "billingCycle",
  "razorpaySubscriptionId",
  "razorpayPaymentId",
] as const;

export type SheetLead = {
  leadId: string;
  status?: string;
  step?: string;
  name?: string;
  email?: string;
  phone?: string;
  segment?: string | null;
  goals?: string[] | string;
  planId?: string | null;
  billingCycle?: string;
  razorpaySubscriptionId?: string | null;
  razorpayPaymentId?: string | null;
};

export function sheetsConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SHEETS_CLIENT_EMAIL &&
      process.env.GOOGLE_SHEETS_PRIVATE_KEY &&
      process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
  );
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Mint a short-lived access token by signing a service-account JWT (RS256). */
async function getAccessToken(): Promise<string> {
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL as string;
  // Env vars store the PEM with literal "\n"; turn those back into newlines.
  const privateKey = (process.env.GOOGLE_SHEETS_PRIVATE_KEY as string).replace(
    /\\n/g,
    "\n",
  );

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: clientEmail,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${header}.${claims}`;
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(unsigned)
    .sign(privateKey);
  const assertion = `${unsigned}.${base64url(signature)}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) {
    throw new Error(`token exchange failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("token exchange returned no token");
  return data.access_token;
}

async function api(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<unknown> {
  const res = await fetch(`${SHEETS_API}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`Sheets API ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function getValues(
  id: string,
  token: string,
  range: string,
): Promise<string[][]> {
  const data = (await api(
    `${id}/values/${encodeURIComponent(range)}`,
    token,
  )) as { values?: string[][] };
  return data.values ?? [];
}

/**
 * Upsert one lead row keyed by leadId. Creates the header row on first use,
 * appends a new row for an unseen leadId, or updates the existing row in place
 * (preserving its original createdAt).
 */
export async function upsertLead(lead: SheetLead): Promise<{ updated: boolean }> {
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID as string;
  const token = await getAccessToken();

  // First tab's title — needed for A1 ranges; don't assume it's "Sheet1".
  const meta = (await api(`${id}?fields=sheets.properties.title`, token)) as {
    sheets?: { properties?: { title?: string } }[];
  };
  const title = meta.sheets?.[0]?.properties?.title;
  if (!title) throw new Error("spreadsheet has no sheets");

  // Reconcile the header row to the current column layout. Writing it only
  // when empty means a later column addition (e.g. phone) never reaches an
  // existing sheet — rows are written by position, so the new field silently
  // lands under a stale label until someone swaps in a fresh sheet. Rewriting
  // whenever it drifts makes schema changes propagate to every sheet on the
  // next write, with no manual sheet-swapping.
  const headerRow = await getValues(id, token, `${title}!A1:N1`);
  const current = headerRow[0] ?? [];
  const headerMatches =
    current.length === HEADERS.length &&
    HEADERS.every((h, i) => current[i] === h);
  if (!headerMatches) {
    await api(
      `${id}/values/${encodeURIComponent(`${title}!A1:N1`)}?valueInputOption=RAW`,
      token,
      { method: "PUT", body: JSON.stringify({ values: [HEADERS] }) },
    );
  }

  const now = new Date().toISOString();
  const goals = Array.isArray(lead.goals)
    ? lead.goals.join(", ")
    : lead.goals || "";

  // Locate an existing row by leadId (column A, from row 2 down).
  const ids = await getValues(id, token, `${title}!A2:A`);
  let rowIndex = -1;
  for (let i = 0; i < ids.length; i++) {
    if (ids[i]?.[0] === lead.leadId) {
      rowIndex = i + 2;
      break;
    }
  }
  const isNew = rowIndex === -1;

  let createdAt = now;
  if (!isNew) {
    const existing = await getValues(id, token, `${title}!B${rowIndex}:B${rowIndex}`);
    createdAt = existing[0]?.[0] || now;
  }

  const row = [
    lead.leadId,
    createdAt,
    now, // updatedAt
    lead.status || "in_progress",
    lead.step || "",
    lead.name || "",
    lead.email || "",
    lead.phone || "",
    lead.segment || "",
    goals,
    lead.planId || "",
    lead.billingCycle || "",
    lead.razorpaySubscriptionId || "",
    lead.razorpayPaymentId || "",
  ];

  if (isNew) {
    await api(
      `${id}/values/${encodeURIComponent(`${title}!A:N`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      token,
      { method: "POST", body: JSON.stringify({ values: [row] }) },
    );
  } else {
    await api(
      `${id}/values/${encodeURIComponent(`${title}!A${rowIndex}:N${rowIndex}`)}?valueInputOption=RAW`,
      token,
      { method: "PUT", body: JSON.stringify({ values: [row] }) },
    );
  }

  return { updated: !isNew };
}
