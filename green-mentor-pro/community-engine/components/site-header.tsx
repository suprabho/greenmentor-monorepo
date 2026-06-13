import Link from "next/link";
import { Leaf, SignOut } from "@phosphor-icons/react/dist/ssr";

/** Top navigation shown on every signed-in page (hidden on /login). */
export function SiteHeader({ email }: { email: string }) {
  return (
    <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-[9px] bg-teal-900 text-green-500">
            <Leaf size={17} weight="fill" />
          </span>
          <span className="text-[14px] font-semibold tracking-tight text-ink">Community</span>
        </Link>
        <nav className="flex items-center gap-1 text-[13px] font-medium">
          <Link
            href="/"
            className="rounded-pill px-3 py-1.5 text-gray-600 transition-colors hover:bg-gray-100 hover:text-ink"
          >
            Tools
          </Link>
          <Link
            href="/library"
            className="rounded-pill px-3 py-1.5 text-gray-600 transition-colors hover:bg-gray-100 hover:text-ink"
          >
            Saved
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          {email && (
            <span className="hidden text-[12.5px] text-gray-600 sm:block">{email}</span>
          )}
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-pill border border-gray-200 px-3 py-1.5 text-[12.5px] font-semibold text-gray-700 transition-colors hover:bg-gray-100"
            >
              <SignOut size={14} /> Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
