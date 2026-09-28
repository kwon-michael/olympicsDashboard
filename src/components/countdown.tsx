"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ALL_UNITS,
  EVENT_TIME,
  SECOND,
  split,
  spokenRemaining,
  tierFor,
  type Tier,
  type UnitKey,
} from "@/lib/countdown";

// The arithmetic — how far off the event is and which tier that puts us in —
// lives in src/lib/countdown.ts, where it can be tested without a DOM. This
// file is the look of it: how loud each tier gets, and what the clock does when
// there's nothing left to count.
//
// Each step up drops the leading unit as it empties, so the numbers on screen
// are always the ones that still matter. On the morning itself the clock is
// minutes and seconds, at the size the days used to be.

interface TierStyle {
  /** Digits, border and glow all take this colour. */
  accent: string;
  /** Words above the clock, given the clock's leading unit. */
  headline: (lead: number) => string;
  /** Seconds per breath of the glow — shorter reads as more urgent. */
  breath: number;
  /** Units worth showing at this range. */
  units: UnitKey[];
  /** Digit type scale. */
  digits: string;
}

const WHITE = "#FFFFFF";
const GOLD = "var(--color-gold)";
const CORAL = "var(--color-coral)";

// Only the tiers that render a clock. "live" and "archived" have nothing to
// count, and say so in their own words.
const TIERS: Record<Exclude<Tier, "live" | "archived">, TierStyle> = {
  far: {
    accent: WHITE,
    headline: () => "Save the date",
    breath: 0,
    units: ALL_UNITS,
    digits: "text-2xl sm:text-4xl",
  },
  week: {
    accent: GOLD,
    // Never reads "0 days": under 24 hours out is the `day` tier's problem.
    headline: (days) => (days === 1 ? "1 day to go" : `${days} days to go`),
    breath: 3,
    units: ALL_UNITS,
    digits: "text-3xl sm:text-5xl",
  },
  day: {
    accent: CORAL,
    headline: () => "Final 24 hours",
    breath: 2,
    units: ["hours", "minutes", "seconds"],
    digits: "text-4xl sm:text-6xl",
  },
  hour: {
    accent: CORAL,
    headline: () => "Minutes away",
    breath: 1.2,
    units: ["minutes", "seconds"],
    digits: "text-5xl sm:text-7xl",
  },
};

const UNIT_LABELS: Record<UnitKey, string> = {
  days: "Days",
  hours: "Hours",
  minutes: "Min",
  seconds: "Sec",
};

/**
 * Milliseconds until the ceremony — negative once it's behind us — or null
 * before the first client tick.
 *
 * Null rather than a guess: the server has no business rendering a clock, and
 * anything it *did* render would either mismatch on hydration or — since the
 * obvious placeholder is zero — flash "game day is here" at someone visiting a
 * week early. The placeholder below is dashes at full size, so nothing jumps
 * when the real numbers arrive.
 */
function useRemaining(): number | null {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    // Unclamped: how far *past* the ceremony we are is what separates the day
    // itself from the archive. Nothing downstream splits a negative into
    // days/hours — the two past tiers both return before that point.
    const tick = () => setRemaining(EVENT_TIME - Date.now());
    tick();
    const id = setInterval(tick, SECOND);
    return () => clearInterval(id);
  }, []);

  return remaining;
}

/**
 * The hero countdown. Quiet while the event is far off, and progressively louder
 * as it closes in: the digits grow, the palette runs white → gold → coral, a
 * glow behind the card breathes faster, and every changing digit rolls over
 * instead of blinking.
 *
 * All of the motion is decorative. The clock itself is `aria-hidden` — a figure
 * that rewrites itself every second is unusable announced, and re-reading it is
 * never what someone wants — with a single plain-language line behind it
 * instead. Framer's `useReducedMotion` cuts the rolling and the glow for anyone
 * who has asked for less; the tier colours and sizes stay, since those carry the
 * meaning and aren't animation.
 */
export function Countdown() {
  const remaining = useRemaining();
  const reduceMotion = useReducedMotion();

  const tier = remaining == null ? "far" : tierFor(remaining);
  if (tier === "archived") return <Archived />;
  if (tier === "live") return <GameDay reduceMotion={Boolean(reduceMotion)} />;

  const style = TIERS[tier];
  const parts = remaining == null ? null : split(remaining);
  const headline = parts ? style.headline(parts[style.units[0]]) : "Save the date";
  const glowing = style.breath > 0 && !reduceMotion;

  return (
    <div className="relative inline-block max-w-full">
      {/* Sits behind the card and breathes. Purely decorative, so it never
          intercepts a tap. */}
      {glowing && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -inset-6 rounded-[2rem] blur-2xl"
          style={{ backgroundColor: style.accent }}
          initial={{ opacity: 0.12 }}
          animate={{ opacity: [0.12, 0.32, 0.12] }}
          transition={{
            duration: style.breath,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}

      <div className="relative">
        <p
          className="mb-3 text-[11px] font-bold tracking-[0.25em] uppercase sm:text-xs"
          style={{ color: style.accent }}
        >
          {tier !== "far" && (
            <motion.span
              aria-hidden
              className="mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle"
              style={{ backgroundColor: style.accent }}
              animate={reduceMotion ? undefined : { opacity: [1, 0.25, 1] }}
              transition={{
                duration: style.breath,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          )}
          {headline}
        </p>

        <div
          aria-hidden
          className="inline-flex max-w-full items-center gap-2 rounded-2xl border bg-white/5 px-4 py-4 backdrop-blur-sm sm:gap-5 sm:px-8 sm:py-5"
          style={{
            borderColor:
              tier === "far"
                ? "rgb(255 255 255 / 0.1)"
                : `color-mix(in srgb, ${style.accent} 45%, transparent)`,
          }}
        >
          {style.units.map((unit, i) => (
            <div key={unit} className="flex items-center gap-2 sm:gap-5">
              {i > 0 && (
                <span
                  className={cn(
                    "font-light text-white/20",
                    tier === "hour" ? "text-3xl sm:text-5xl" : "text-lg sm:text-2xl"
                  )}
                >
                  :
                </span>
              )}
              <Digit
                value={parts?.[unit] ?? null}
                label={UNIT_LABELS[unit]}
                accent={style.accent}
                size={style.digits}
                roll={!reduceMotion}
              />
            </div>
          ))}
        </div>
      </div>

      <p className="sr-only">
        {parts
          ? `${spokenRemaining(parts)} until the Casualympics.`
          : "Loading the countdown to the Casualympics."}
      </p>
    </div>
  );
}

/**
 * One unit of the clock. The number is keyed on its own value, so React swaps
 * the element whenever it changes and the new one rolls up into place — the
 * seconds tick, the minutes turn over, and the days sit perfectly still.
 */
function Digit({
  value,
  label,
  accent,
  size,
  roll,
}: {
  value: number | null;
  label: string;
  accent: string;
  size: string;
  roll: boolean;
}) {
  const text = value == null ? "––" : String(value).padStart(2, "0");

  return (
    <div className="text-center">
      {/* Clips the incoming digit so it rises into the slot rather than
          appearing above it. */}
      <div className="overflow-hidden">
        <motion.p
          key={text}
          initial={roll ? { y: "70%", opacity: 0 } : false}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            "font-mono font-bold tabular-nums leading-none",
            size
          )}
          style={{ color: accent }}
        >
          {text}
        </motion.p>
      </div>
      <p className="mt-1.5 text-[9px] tracking-widest text-white/40 uppercase sm:text-[10px]">
        {label}
      </p>
    </div>
  );
}

/**
 * The event is behind us. There is nothing left to count, so the clock stands
 * down and points at the thing people actually come back for — the final
 * standings. The countdown to the next event — the Virtualympics — lives on
 * the new front door at `/`, and is deliberately not a clock at all — it's the date on a
 * board, not a number counting down to it (see components/v2/date-slots.tsx).
 */
function Archived() {
  const eventDate = new Date(EVENT_TIME).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="inline-flex flex-col items-center gap-3">
      <p className="text-[11px] font-bold tracking-[0.25em] text-white/40 uppercase sm:text-xs">
        {eventDate}
      </p>
      <p className="font-display text-2xl font-bold tracking-tight text-gold uppercase sm:text-4xl">
        That&apos;s a wrap
      </p>
      <Link
        href="/leaderboard"
        className="mt-1 inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
      >
        Final standings
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

/** The clock has run out. No numbers left to show — just say so, loudly. */
function GameDay({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <div className="relative inline-block">
      {!reduceMotion && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -inset-8 rounded-full bg-gold blur-3xl"
          initial={{ opacity: 0.15 }}
          animate={{ opacity: [0.15, 0.4, 0.15] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      <motion.p
        className="relative font-display text-3xl font-bold tracking-tight text-gold uppercase sm:text-5xl"
        initial={reduceMotion ? false : { scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        Game day is here
      </motion.p>
    </div>
  );
}
