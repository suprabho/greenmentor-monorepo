import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on every route (pages + API) so the whole app is gated and the
     * session cookie stays fresh — except Next internals and static image
     * assets (e.g. /avatars/*.jpg, /brand/*.svg) which must stay public so the
     * header preview + PNG export can load them.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
