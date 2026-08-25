import type { Metadata } from "next";
import Link from "next/link";
import { PixelIcon } from "@/components/v2/pixel-icons";

// ============================================
// Casualympics Showdown — the front door
// ============================================
// The next event is a spin-off, and the marquee on the home page says so. This
// is its site, on the inverted palette (see the second block of globals.css).
// It shares the document and the providers with the 2026 site and nothing else:
// no navy navbar, no light background, no countdown to a date anybody knows.
//
// The next event is gaming-themed, so the chrome is a cabinet's: a bitmap face,
// hard 4px edges, sprites instead of line icons, and a marquee bar across the
// top. The palette underneath is untouched — the inversion already lands on
// black glass and phosphor teal, which is the right two colours for this. What
// changed is the *shape* of everything: nothing on these pages has a curve.
//
// Deliberately its own chrome rather than a themed version of the old one. The
// two sites are meant to feel like different places — you should know which one
// you're on before you've read a word of it.

export const metadata: Metadata = {
  title: "Casualympics™ Showdown | Press start",
  description:
    "Insert coin. Casualympics™ Showdown — a spin-off of the 2026 event — is gaming-themed and opens on Sunday 3 January 2027. The 2026 site, leaderboard, teams, rules and results included, is still live.",
};

export default function NextLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // `theme-next` is a marker, not a style: globals.css keys the scrollbar off
    // it with `:has`, since the viewport's scrollbar belongs to <html> and can't
    // be reached from a nested layout any other way.
    <div className="theme-next flex min-h-screen flex-col bg-void font-mono text-bone">
      <header className="sticky top-0 z-40 border-b-4 border-hairline bg-void/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="group flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-signal transition-none group-hover:bg-signal-bright">
              <PixelIcon name="runner" className="h-5 w-5 text-void" />
            </span>
            <span className="font-pixel truncate text-[11px] leading-none sm:text-sm">
              <span className="text-bone">CASUAL</span>
              <span className="text-signal">YMPICS</span>
            </span>
          </Link>

          {/* Hard-edged, and it moves into its own shadow when pressed. */}
          <Link
            href="/2026"
            className="pixel-press pixel-drop font-pixel shrink-0 bg-void px-3 py-2.5 text-[9px] leading-none text-signal ring-2 ring-signal ring-inset hover:bg-signal hover:text-void sm:text-[10px]"
          >
            2026 <span className="hidden sm:inline">SITE</span> &gt;
          </Link>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t-4 border-hairline">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-2 gap-y-2 px-4 py-10 text-center text-[9px] leading-relaxed text-dust sm:px-6 lg:px-8">
          <span className="font-pixel">
            &copy; {new Date().getFullYear()} CASUALYMPICS&trade;
          </span>
          <span
            className="inline-block h-1.5 w-1.5 bg-hairline align-middle"
            aria-hidden
          />
          <span className="font-pixel inline-flex items-center gap-1.5">
            BUILT WITH
            <PixelIcon name="heart" className="h-2.5 w-2.5 text-signal" />
            <span className="sr-only">love</span>
            BY MK
          </span>
        </div>
      </footer>
    </div>
  );
}
