import { decodeJwt } from "jose";

/**
 * Shape of the JWT issued by greenmentor-in-um's POST /user/login (login-user.js).
 * NOTE: `organization` has NO `fiscal_year` — the reporting period is an esg-agents
 * concept, not carried by the legacy token. Also note the refresh-token endpoint
 * DROPS `organization`, so we never re-derive org from a refreshed token.
 */
export interface LegacyJwtClaims {
  user: {
    id: number | string;
    username?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    firstLogin?: boolean;
  };
  organization: {
    id: number | string;
    name?: string;
    company_code?: string;
    date_of_joining?: string;
  };
  member?: {
    id?: number | string;
    role_alias?: string;
    role_type?: string;
    access?: unknown;
    orgPermission?: unknown;
  };
  exp?: number;
  iat?: number;
}

/**
 * Decode (NOT verify) the legacy access token. We trust it because we obtained it
 * directly from -um over HTTPS server-side and then sealed it inside our own
 * encrypted httpOnly cookie. Signature verification with AUTH_KEY is optional and
 * left out to avoid sharing the legacy signing secret with this app.
 */
export function decodeSessionJwt(token: string): LegacyJwtClaims {
  return decodeJwt(token) as unknown as LegacyJwtClaims;
}

/** Unix-seconds expiry of an access token, or 0 if absent. */
export function jwtExp(token: string): number {
  try {
    return decodeSessionJwt(token).exp ?? 0;
  } catch {
    return 0;
  }
}
