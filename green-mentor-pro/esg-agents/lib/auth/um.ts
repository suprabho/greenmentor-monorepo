import "server-only";

/**
 * Server-only HTTP client for greenmentor-in-um (the legacy identity service).
 * All calls are server-to-server (no CORS, tokens never touch the browser).
 *   POST /user/login          → { accessToken, refreshToken } | { require2FA }
 *   POST /user/refresh-token   → { access_token }  (behind validateAuth; drops org)
 *   POST /user/logout          → 200  (destroys the auth_stores row)
 */
const base = () => (process.env.UM_API_URL || "").replace(/\/+$/, "");

export interface UmTokens {
  accessToken: string;
  refreshToken: string;
}
export type UmLoginResult = UmTokens | { require2FA: true };

export function isRequire2FA(r: UmLoginResult): r is { require2FA: true } {
  return (r as { require2FA?: boolean }).require2FA === true;
}

/**
 * Peel the legacy response envelope to the object that actually holds the tokens /
 * require2FA flag. -um DOUBLE-wraps: the controller returns { success, data: <X> }
 * around the use-case X = { success, message, data: { accessToken, refreshToken } },
 * so tokens live at body.data.data.* and the 2FA flag at body.data.require2FA.
 */
function unwrap(body: unknown): Record<string, unknown> {
  let cur = body as Record<string, unknown> | undefined;
  let last: Record<string, unknown> = (body ?? {}) as Record<string, unknown>;
  for (let i = 0; i < 4 && cur && typeof cur === "object"; i++) {
    last = cur;
    if ("accessToken" in cur || "access_token" in cur || "require2FA" in cur) return cur;
    cur = cur.data as Record<string, unknown> | undefined;
  }
  return last;
}

function pickTokens(body: unknown): UmTokens | null {
  const d = unwrap(body);
  const accessToken = (d.accessToken ?? d.access_token) as string | undefined;
  const refreshToken = (d.refreshToken ?? d.refresh_token) as string | undefined;
  return accessToken && refreshToken ? { accessToken, refreshToken } : null;
}

export async function umLogin(input: {
  username: string;
  password: string;
  otp?: string;
}): Promise<UmLoginResult> {
  if (!base()) throw new Error("UM_API_URL is not configured");
  const res = await fetch(`${base()}/user/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (body as { message?: string })?.message ?? `login failed (${res.status})`;
    throw new Error(msg);
  }
  // Two-step 2FA: first call returns require2FA with no tokens.
  if (unwrap(body).require2FA) return { require2FA: true };
  const tokens = pickTokens(body);
  if (!tokens) throw new Error("login succeeded but no tokens were returned");
  return tokens;
}

/**
 * Refresh the access token. The endpoint is behind validateAuth, so the (still
 * valid) access token must be sent as the Bearer header and the refresh token in
 * the body. Returns the new access token, or null if refresh failed.
 */
export async function umRefresh(tokens: UmTokens): Promise<string | null> {
  if (!base()) return null;
  try {
    const res = await fetch(`${base()}/user/refresh-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokens.accessToken}`,
      },
      body: JSON.stringify({ refreshToken: tokens.refreshToken, refresh_token: tokens.refreshToken }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = await res.json().catch(() => null);
    const d = unwrap(body);
    return ((d.accessToken ?? d.access_token) as string) ?? null;
  } catch {
    return null;
  }
}

export async function umLogout(accessToken: string): Promise<void> {
  if (!base()) return;
  try {
    await fetch(`${base()}/user/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
  } catch {
    // best-effort — the local cookie is cleared regardless
  }
}
