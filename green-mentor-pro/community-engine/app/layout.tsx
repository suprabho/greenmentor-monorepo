import type { Metadata } from "next";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";
import { isAdmin } from "@/lib/auth/admin";

export const metadata: Metadata = {
  title: "GreenMentor — Community Engine",
  description:
    "Standalone maker tools for the GreenMentor community team, built on the GreenMentor design system.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {user && <SiteHeader email={user.email ?? ""} isAdmin={isAdmin(user.email)} />}
        {/* Page padding lives in the (shell) route group's layout — full-screen
            surfaces (the share-cards studio, the export render page) opt out
            by living outside the group. */}
        {children}
      </body>
    </html>
  );
}
