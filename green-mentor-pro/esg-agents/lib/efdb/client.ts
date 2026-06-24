/**
 * Shared HTTP client for the EFDB FastAPI service (consulting/efdb).
 *
 * Holds the cached service-login JWT and the GET/parse helpers used across the
 * app (emission-factor lookups in toolHandlers, document parsing on upload).
 * Configure via env:
 *   EFDB_API_URL                 e.g. http://localhost:8000
 *   EFDB_EMAIL / EFDB_PASSWORD   service login for the Bearer token
 */

export const efdbBase = () => (process.env.EFDB_API_URL || "").replace(/\/+$/, "");

// Cached JWT (EFDB tokens last ~8h). Re-login on 401.
let _token: string | null = null;

export async function efdbLogin(): Promise<string | null> {
  const base = efdbBase();
  const email = process.env.EFDB_EMAIL;
  const password = process.env.EFDB_PASSWORD;
  if (!base || !email || !password) return null;
  try {
    const res = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return data?.access_token ?? null;
  } catch {
    return null;
  }
}

export interface EfdbGet {
  ok: boolean;
  status: number;
  body: unknown;
}

export async function efdbGet(pathWithQuery: string): Promise<EfdbGet> {
  const base = efdbBase();
  if (!base) return { ok: false, status: 0, body: null };
  if (!_token) _token = await efdbLogin();
  if (!_token) return { ok: false, status: 401, body: null };
  const call = () => fetch(`${base}${pathWithQuery}`, { headers: { Authorization: `Bearer ${_token}` } });
  try {
    let res = await call();
    if (res.status === 401) {
      _token = await efdbLogin(); // token expired — re-login once
      if (!_token) return { ok: false, status: 401, body: null };
      res = await call();
    }
    return { ok: res.ok, status: res.status, body: await res.json().catch(() => null) };
  } catch {
    return { ok: false, status: 0, body: null };
  }
}

export interface ParsedDoc {
  markdown: string;
  page_count: number;
  parser: string;
  used_ocr: boolean;
  source_format?: string;
}

/**
 * Normalize a document to markdown via EFDB's POST /ingestion/parse (the shared
 * liteparse + markitdown layer). Returns null when EFDB is unconfigured or
 * unreachable; throws Error with the server message on a 4xx (e.g. 415
 * unsupported file type) so callers can surface it.
 */
export async function efdbParseDocument(
  bytes: Uint8Array | Blob,
  filename: string,
  mime: string,
): Promise<ParsedDoc | null> {
  const base = efdbBase();
  if (!base) return null;
  if (!_token) _token = await efdbLogin();
  if (!_token) return null;

  const blob = bytes instanceof Blob ? bytes : new Blob([bytes as BlobPart], { type: mime || "application/octet-stream" });
  const call = () => {
    const form = new FormData();
    form.append("file", blob, filename);
    return fetch(`${base}/ingestion/parse`, {
      method: "POST",
      headers: { Authorization: `Bearer ${_token}` },
      body: form,
    });
  };
  try {
    let res = await call();
    if (res.status === 401) {
      _token = await efdbLogin(); // token expired — re-login once
      if (!_token) return null;
      res = await call();
    }
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.detail ?? `EFDB parse failed (HTTP ${res.status})`);
    }
    return (await res.json()) as ParsedDoc;
  } catch (e) {
    // Network/parse-shape failures → null (treated as "skipped"); explicit 4xx
    // errors (thrown above) propagate so the caller can show the reason.
    if (e instanceof Error && /EFDB parse failed|unsupported|spreadsheet/i.test(e.message)) throw e;
    return null;
  }
}
