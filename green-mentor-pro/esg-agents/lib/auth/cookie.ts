/**
 * Edge-safe constants shared between middleware (Edge runtime) and the Node-only
 * session module. This file must NOT import node:crypto / jose / next/headers so it
 * stays importable from middleware.ts.
 */
export const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME || "gm_session";

/** Paths that never require a session (login UI + the auth API itself + the no-auth demo). */
export const PUBLIC_PATHS = ["/login", "/api/auth", "/demo"];
