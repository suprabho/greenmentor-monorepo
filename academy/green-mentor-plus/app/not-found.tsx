import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-white px-6">
      <div className="max-w-md text-center">
        <p className="gm-eyebrow text-green-700">404</p>
        <h1 className="font-display mt-6 text-[40px] leading-tight tracking-[-0.02em] text-ink md:text-[56px]">
          We couldn&apos;t find that page.
        </h1>
        <p className="mt-4 text-[17px] leading-relaxed text-gray-700">
          The link may be broken or the page may have moved. Head back to the
          homepage or browse the course library.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild variant="primary" size="md">
            <Link href="/">Back to Home</Link>
          </Button>
          <Button asChild variant="outline" size="md">
            <Link href="/#courses">Browse Courses</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
