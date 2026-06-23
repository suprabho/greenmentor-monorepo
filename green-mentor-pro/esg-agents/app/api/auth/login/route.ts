import { NextResponse } from "next/server";
import { umLogin, isRequire2FA } from "@/lib/auth/um";
import { decodeSessionJwt, jwtExp } from "@/lib/auth/jwt";
import { setSession, defaultFinancialYear, type SessionData } from "@/lib/auth/session";
import { resolveOrg } from "@/lib/tenancy/orgMapping";

export const runtime = "nodejs"; // node:crypto (session sealing) + service-role client

/**
 * POST { username, password, otp? }.
 * → { require2FA: true } when -um asks for an OTP (re-POST with otp), or
 * → { ok: true } after sealing the session cookie (no tokens in the body).
 */
export async function POST(req: Request) {
  const { username, password, otp } = await req.json().catch(() => ({}));
  if (!username || !password) {
    return NextResponse.json({ error: "username and password are required" }, { status: 400 });
  }

  try {
    const result = await umLogin({ username, password, otp });
    if (isRequire2FA(result)) return NextResponse.json({ require2FA: true });

    const claims = decodeSessionJwt(result.accessToken);
    const org = await resolveOrg(claims);

    const session: SessionData = {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      accessExp: jwtExp(result.accessToken),
      orgUuid: org.orgUuid,
      orgLegacyId: org.orgLegacyId,
      orgName: org.orgName,
      userLegacyId: String(claims.user.id),
      userUuid: org.userUuid,
      email: claims.user.email ?? "",
      role: org.role,
      financialYear: defaultFinancialYear(),
    };
    await setSession(session);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "login failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
