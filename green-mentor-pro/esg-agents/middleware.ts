import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, PUBLIC_PATHS } from "@/lib/auth/cookie";

/**
 * Edge middleware: cheap presence check only (no decrypt — node:crypto/jose key
 * derivation isn't available on Edge). The authoritative decrypt + token refresh
 * happens in getSession() on the Node side. Unauthenticated requests to protected
 * pages are bounced to /login.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }
  if (req.cookies.get(SESSION_COOKIE)?.value) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Protect app pages; exclude static assets and Next internals.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|css|js)$).*)"],
};
