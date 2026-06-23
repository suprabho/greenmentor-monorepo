import "server-only";
import { cookies } from "next/headers";
import { EncryptJWT, jwtDecrypt } from "jose";
import { createHash } from "node:crypto";
import { SESSION_COOKIE } from "./cookie";

/**
 * The app session. The legacy -um tokens are sealed (encrypted) inside one
 * httpOnly cookie — never readable by client JS, never returned in a response
 * body. All esg_* access is keyed by `orgUuid` (the Supabase org); `orgLegacyId`
 * is the greenmentor-in-um organization.id used for -be calls.
 */
export interface SessionData {
  accessToken: string;
  refreshToken: string;
  accessExp: number; // unix seconds
  orgUuid: string;
  orgLegacyId: string;
  orgName: string;
  userLegacyId: string;
  userUuid: string;
  email: string;
  role: string;
  financialYear: string;
}

/** Non-secret projection safe to hand to client UI (no tokens). */
export interface PublicSession {
  orgName: string;
  email: string;
  role: string;
  financialYear: string;
}

const COOKIE_MAX_AGE = 60 * 60 * 24 * 15; // 15d, matches the -um refresh-token lifetime
const REFRESH_SKEW = 5 * 60; // refresh when <5 min of access-token life remains

function key(): Uint8Array {
  const secret = process.env.SESSION_SECRET || "dev-insecure-session-secret-change-me-please";
  return createHash("sha256").update(secret).digest(); // 32 bytes for A256GCM
}

export function publicSession(s: SessionData): PublicSession {
  return { orgName: s.orgName, email: s.email, role: s.role, financialYear: s.financialYear };
}

async function seal(data: SessionData): Promise<string> {
  return new EncryptJWT({ ...data })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime("15d")
    .encrypt(key());
}

async function unseal(token: string): Promise<SessionData | null> {
  try {
    const { payload } = await jwtDecrypt(token, key());
    return payload as unknown as SessionData;
  } catch {
    return null;
  }
}

export async function setSession(data: SessionData): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, await seal(data), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/**
 * Read the current session, transparently refreshing the access token when it is
 * within REFRESH_SKEW of expiry. Because the -um refresh endpoint drops the
 * `organization` claim, org fields are carried forward from the existing session
 * rather than re-derived. Returns null when there is no usable session.
 */
export async function getSession(): Promise<SessionData | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const data = await unseal(raw);
  if (!data) return null;

  const now = Math.floor(Date.now() / 1000);
  if (data.accessExp - now > REFRESH_SKEW) return data;

  // Near or past expiry → try to refresh. Lazy import avoids a server-only cycle.
  const { umRefresh } = await import("./um");
  const { jwtExp } = await import("./jwt");
  const fresh = await umRefresh({ accessToken: data.accessToken, refreshToken: data.refreshToken });
  if (!fresh) {
    // Couldn't refresh: if the access token is already hard-expired, the session is dead.
    return data.accessExp <= now ? null : data;
  }
  const refreshed: SessionData = { ...data, accessToken: fresh, accessExp: jwtExp(fresh) };
  try {
    await setSession(refreshed); // may throw in a Server Component render — fine, see below
  } catch {
    // Server Components can't set cookies; the in-memory refreshed token still serves
    // this request, and middleware / a route handler will persist on the next write.
  }
  return refreshed;
}

/** Throw a 401-style error if unauthenticated (for route handlers / actions). */
export async function requireSession(): Promise<SessionData> {
  const s = await getSession();
  if (!s) throw new Error("Unauthorized");
  return s;
}

/** A sensible default Indian fiscal year (Apr–Mar), e.g. "FY2025-26". */
export function defaultFinancialYear(d: Date = new Date()): string {
  const y = d.getFullYear();
  const startYear = d.getMonth() >= 3 ? y : y - 1; // Apr (month 3) starts the FY
  return `FY${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}
