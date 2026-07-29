import type { Metadata } from "next";
import { Inter, Manrope, ABeeZee } from "next/font/google";
import { siteUrl } from "@/lib/share/url";
import "@openuidev/react-ui/styles/index.css";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-manrope",
  weight: ["300", "400", "500", "600", "700"],
});

const abeezee = ABeeZee({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-accent",
  weight: ["400"],
});

const DESCRIPTION =
  "Unified consumer/prosumer ESG platform — Feed, Academy, AI Hub. Convergence vertical slice.";

export const metadata: Metadata = {
  // metadataBase is what turns the relative og:image paths on the shareable
  // /webinars, /jobs and /feed detail pages into the absolute URLs crawlers
  // require. Set NEXT_PUBLIC_SITE_URL in production — see lib/share/url.ts.
  metadataBase: new URL(siteUrl()),
  // No title.template: every page here already spells out its own
  // "X — Green Mentor Pro", so a template would double-suffix them.
  title: "Green Mentor Pro",
  description: DESCRIPTION,
  openGraph: { siteName: "Green Mentor Pro", type: "website", description: DESCRIPTION },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${manrope.variable} ${abeezee.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
