import type { Metadata } from "next";
import { Inter, ABeeZee } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
  weight: ["300", "400", "500", "600", "700"],
});

const abeezee = ABeeZee({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-accent",
  weight: ["400"],
});

export const metadata: Metadata = {
  title: {
    default:
      "Greenmentor — World's First Community Led ESG Data & Learning Platform",
    template: "%s · Greenmentor",
  },
  description:
    "GM Academy is the learning surface of Greenmentor — community-led ESG training built with practitioners. GRI, BRSR, CDP, TCFD, SASB, DJSI. Self-paced, expert-led, with live coaching.",
  metadataBase: new URL("https://greenmentor.co"),
  openGraph: {
    title: "Greenmentor — Community-led ESG learning",
    description:
      "Powered by India's biggest ESG community. 3,000+ active students. 6,900+ hours of lectures delivered.",
    type: "website",
  },
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${abeezee.variable}`}>
      <body className="min-h-screen bg-white text-ink">{children}</body>
    </html>
  );
}
