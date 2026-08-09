import type { Metadata } from "next";
import { Oswald, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/providers/query-provider";
import { RealtimeProvider } from "@/components/providers/realtime-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { NavigationProgress } from "@/components/layout/navigation-progress";

// ============================================
// Root layout — the document, and nothing else
// ============================================
// Two sites live in this app and they don't look anything alike:
//
//   (v1)  the 2026 Casualympics — the light site, its navy chrome, and every
//         page that ran the event. Its URLs are unchanged; only its home page
//         moved, to /2026.
//   (v2)  the next Casualympics — the new front door at /, on the inverted
//         palette (see globals.css).
//
// So the chrome belongs to each site's own layout, not here. This file owns the
// things a *document* has exactly one of: the html/body element, the fonts, and
// the providers (auth, realtime, query cache) that both sites share.

const oswald = Oswald({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Casualympics™",
  description:
    "The single hub for organizing, tracking, and celebrating your community-run Casualympics™ event.",
  keywords: ["casualympics", "community", "sports", "leaderboard"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${oswald.variable} ${plusJakarta.variable} ${jetbrainsMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <QueryProvider>
          <AuthProvider>
            <RealtimeProvider>
              <NavigationProgress />
              {children}
            </RealtimeProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
