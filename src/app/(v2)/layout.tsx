import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { RunnerMark } from "@/components/ui/runner-mark";

// ============================================
// The next Casualympics — the front door
// ============================================
// The new site, on the inverted palette (see the second block of globals.css).
// It shares the document and the providers with the 2026 site and nothing else:
// no navy navbar, no light background, no countdown to a date anybody knows.
//
// Deliberately its own chrome rather than a themed version of the old one. The
// two sites are meant to feel like different places — you should know which one
// you're on before you've read a word of it.

export const metadata: Metadata = {
  title: "Casualympics™ | The next one",
  description:
    "Something is coming. The board isn't saying when. The 2026 Casualympics™ site is still live.",
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
    <div className="theme-next flex min-h-screen flex-col bg-void text-bone">
      <header className="sticky top-0 z-40 border-b border-hairline bg-void/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="group flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-signal transition-transform group-hover:scale-110">
              <RunnerMark className="h-5 w-5 text-void" />
            </span>
            <span className="font-display text-lg font-bold tracking-wide">
              <span className="text-bone">CASUAL</span>
              <span className="text-signal">YMPICS</span>
              <span className="align-super text-[10px] font-semibold text-beacon-bright">
                TM
              </span>
            </span>
          </Link>

          <Link
            href="/2026"
            className="flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-2 text-xs font-semibold tracking-wide text-dust uppercase transition-colors hover:border-signal/50 hover:text-signal"
          >
            2026 Site
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-hairline">
        <div className="mx-auto max-w-5xl px-4 py-10 text-center text-xs text-dust sm:px-6 lg:px-8">
          <p>
            &copy; {new Date().getFullYear()} Casualympics&trade;. Built with
            &hearts; by mk.
          </p>
        </div>
      </footer>
    </div>
  );
}
