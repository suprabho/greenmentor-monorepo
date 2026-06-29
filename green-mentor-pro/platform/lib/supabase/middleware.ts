import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Unlike community-engine (which gates the whole app), the platform is largely
 * public per the convergence plan — anonymous read on Feed, viz-demo, ESG Buddy.
 * Only these prefixes require a signed-in user; everything else stays open. The
 * session cookie is still refreshed on every matched request.
 */
const PROTECTED_PATHS = ["/profile", "/onboarding", "/ai-hub/engagements"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run other code between createServerClient and getUser() — it keeps
  // the session refresh reliable (per Supabase SSR guidance).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  // Already signed in? Skip the login screen and go to the app. Honor a safe
  // `?next=` (e.g. the protected-path bounce that sent us here) so a freshly
  // set session lands where it was headed instead of falling back to the feed.
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    const nextParam = url.searchParams.get("next");
    url.pathname = nextParam && nextParam.startsWith("/") ? nextParam : "/feed";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
