import type { Metadata } from "next";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

// ============================================
// The 2026 site
// ============================================
// Everything that ran the 2026 Casualympics: the public pages, the captain
// dashboard, the admin tools and the auth flow. This is the chrome that used to
// live in the root layout — navy navbar, footer, min-height column — and it now
// wraps only this site, so the new front door at / doesn't inherit it.
//
// `(v1)` is a route group: it changes nothing about the URLs. /leaderboard,
// /teams, /admin and the rest are exactly where they were, which matters because
// they're in people's history and in links that were shared on the day. The one
// page that did move is the home page, from / to /2026.

export const metadata: Metadata = {
  title: "Casualympics™ 2026 | Digital Command Center",
  description:
    "The 2026 Casualympics™ — final standings, teams, results, rules and schedule.",
};

export default function ArchiveLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
