import type { Metadata } from "next";
import { Oswald, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/providers/query-provider";
import { RealtimeProvider } from "@/components/providers/realtime-provider";
import { AnnouncementOverlay } from "@/components/announcements/announcement-overlay";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

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
  title: "Neighborhood Olympics | Digital Command Center",
  description:
    "The single hub for organizing, tracking, and celebrating your community-run neighborhood Olympics event.",
  keywords: ["neighborhood", "olympics", "community", "sports", "leaderboard"],
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
      >
        <QueryProvider>
          <RealtimeProvider>
            <div className="flex flex-col min-h-screen">
              <Navbar />
              <main className="flex-1">{children}</main>
              <Footer />
            </div>
            <AnnouncementOverlay />
          </RealtimeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
