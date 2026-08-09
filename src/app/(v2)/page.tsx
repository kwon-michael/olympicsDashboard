import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CircleDot,
  Clock,
  Info,
  MapPin,
  Swords,
  Trophy,
  Users,
} from "lucide-react";
import { SplitFlapBoard } from "@/components/v2/split-flap";

// ============================================
// The front door for the next Casualympics
// ============================================
// There is no date yet, and this page is built around not having one rather than
// around apologising for it. The 2026 home page led with a countdown clock; this
// one leads with a board that clatters, settles on a word, and goes back to
// clattering — an event you can feel coming and can't schedule around.
//
// The other half of the page is the archive: the 2026 site is finished, but it's
// finished in the sense that a season is, and the standings, teams, rules and
// results are all still live at their original URLs. The widget below is the way
// back into it.

/**
 * What the word board is allowed to settle on. All eleven characters or fewer —
 * the board's width — and none of them narrow anything down.
 */
const TEASERS = [
  "SOON",
  "NOT YET",
  "ANY DAY NOW",
  "NO DATE YET",
  "STAY READY",
  "TRAIN NOW",
  "PATIENCE",
  "COMING",
  "TBA",
];

/**
 * Shaped exactly like a date — two digits, a three-letter month, a year — and
 * handed no phrases at all, so it shuffles for good and never resolves. It is
 * the most specific-looking thing on the page and says the least.
 */
const DATE_MASK = "## AAA ####";

/** The 2026 site, page by page. Everything here is still live at its own URL. */
const ARCHIVE_LINKS = [
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/teams", label: "Teams", icon: Users },
  { href: "/rules", label: "Rules", icon: BookOpen },
  { href: "/format", label: "Format", icon: Info },
  { href: "/schedule", label: "Schedule", icon: Clock },
  { href: "/venue", label: "Venue", icon: MapPin },
  { href: "/tug-of-war", label: "Tug of War", icon: Swords },
  { href: "/dodgeball", label: "Dodgeball", icon: CircleDot },
];

export default function NextHomePage() {
  return (
    <div>
      {/* Hero + the board */}
      <section className="relative overflow-hidden border-b border-hairline">
        {/* A fine grid instead of the old site's soft blobs — this one should
            read as a machine, not a sunrise. Decorative only. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "linear-gradient(var(--color-hairline) 1px, transparent 1px), linear-gradient(90deg, var(--color-hairline) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage:
              "radial-gradient(ellipse 80% 60% at 50% 35%, #000 40%, transparent 100%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 80% 60% at 50% 35%, #000 40%, transparent 100%)",
          }}
        />

        <div className="relative mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 sm:py-24 lg:px-8">
          <p className="mb-8 inline-flex items-center gap-2 rounded-full border border-hairline px-4 py-1.5 text-[11px] font-semibold tracking-[0.25em] text-dust uppercase">
            <span className="h-1.5 w-1.5 rounded-full bg-signal" />
            The next one
          </p>

          <h1 className="font-display text-[clamp(2.75rem,13vw,8rem)] leading-none font-bold tracking-tight break-words">
            <span className="text-bone">CASUAL</span>
            <span className="text-signal">YMPICS</span>
            <span className="align-super text-[0.35em] text-beacon-bright">
              ™
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-md text-base leading-relaxed text-dust sm:text-lg">
            An event is coming. Sonner than you think.
          </p>

          {/* The word board — settles on something unhelpful, then breaks up */}
          <div className="mt-14">
            <SplitFlapBoard
              mask="AAAAAAAAAAA"
              phrases={TEASERS}
              label="The date of the next Casualympics has not been announced."
            />
          </div>

          {/* The date board — same machine, no phrases, so it never lands */}
          <div className="mt-8">
            <p className="mb-3 text-[10px] font-bold tracking-[0.3em] text-dust uppercase">
              Opening ceremony
            </p>
            <SplitFlapBoard
              mask={DATE_MASK}
              label="The opening ceremony date is unannounced."
              cellClassName="h-7 w-4 text-[10px] sm:h-12 sm:w-9 sm:text-xl"
            />
            <p className="mx-auto mt-5 max-w-sm text-xs leading-relaxed text-dust/70">
              Day, month, year. Check back.
              It will stop shuffling eventually.
            </p>
          </div>
        </div>
      </section>

      {/* The archive widget — the way back into the 2026 site */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="overflow-hidden rounded-2xl border border-hairline bg-panel">
          <div className="flex flex-col gap-4 border-b border-hairline p-6 sm:flex-row sm:items-center sm:p-8">
            <div className="min-w-0 flex-1">
              <p className="mb-2 inline-flex items-center gap-2 text-[10px] font-bold tracking-[0.25em] text-signal uppercase">
                <span className="h-1.5 w-1.5 rounded-full bg-signal" />
                Still live
              </p>
              <h2 className="font-display text-2xl font-bold text-bone sm:text-3xl">
                CASUALYMPICS 2026
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-dust">
                Click through to the 2026 site for the leaderboard, teams, rules, schedule and venue information. All of it is still live at its original URLs.
              </p>
            </div>
            <Link
              href="/2026"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-signal px-5 py-3 text-sm font-semibold text-void transition-colors hover:bg-signal-bright"
            >
              Open the 2026 site
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-px bg-hairline sm:grid-cols-4">
            {ARCHIVE_LINKS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="group flex items-center gap-2.5 bg-panel px-4 py-4 transition-colors hover:bg-void"
              >
                <Icon className="h-4 w-4 shrink-0 text-dust transition-colors group-hover:text-signal" />
                <span className="truncate text-sm font-semibold text-bone">
                  {label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
