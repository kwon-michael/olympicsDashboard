import Link from "next/link";
import { Flame } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-navy text-white/60 border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-coral rounded-lg flex items-center justify-center">
                <Flame className="w-4 h-4 text-white" />
              </div>
              <span className="font-display text-lg font-bold tracking-wide">
                <span className="text-white">CASUAL</span>
                <span className="text-coral">YMPICS</span>
              </span>
              <span className="text-[10px] text-gold align-super font-semibold">
                TM
              </span>
            </div>
            <p className="text-sm max-w-md">
              The digital command center for your community&apos;s greatest
              sporting event. Track scores, join teams, and celebrate together.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-display text-sm text-white font-semibold mb-3 uppercase tracking-wide">
              Quick Links
            </h4>
            <div className="flex flex-col gap-2 text-sm">
              <Link href="/leaderboard" className="hover:text-white transition-colors">
                Leaderboard
              </Link>
              <Link href="/teams" className="hover:text-white transition-colors">
                Teams
              </Link>
              <Link href="/rules" className="hover:text-white transition-colors">
                Game Rules
              </Link>
            </div>
          </div>

          {/* Info */}
          <div>
            <h4 className="font-display text-sm text-white font-semibold mb-3 uppercase tracking-wide">
              Get Involved
            </h4>
            <div className="flex flex-col gap-2 text-sm">
              <Link href="/signup" className="hover:text-white transition-colors">
                Sign Up
              </Link>
              <Link href="/teams/create" className="hover:text-white transition-colors">
                Create a Team
              </Link>
              <Link href="/dashboard" className="hover:text-white transition-colors">
                My Dashboard
              </Link>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 mt-8 pt-8 text-center text-xs">
          <p>
            &copy; {new Date().getFullYear()} Casualympics&trade;. Built with
            &hearts; by mk for the community.
          </p>
        </div>
      </div>
    </footer>
  );
}
