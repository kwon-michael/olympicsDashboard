"use client";

import { useEffect, useMemo, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

// ============================================
// Split-flap board — the clacker
// ============================================
// A mechanical departure board that refuses to tell you the departure time.
//
// The 2026 site had a countdown clock: an exact date, ticking down to the
// second. This is the opposite of that, deliberately. The board clatters away
// like it knows something, settles just long enough to say a word, and goes back
// to shuffling. You can tell an event is coming. You cannot tell when.
//
// Two boards run on the home page and they behave differently, which is the
// whole trick:
//
//   * the word board settles, every few seconds, on one of a list of phrases —
//     that's the "something is coming" half;
//   * the date board is given a mask shaped like a date (`## ### ####`) and no
//     phrases at all, so it never settles on anything — that's the "but not
//     when" half. It reads as a real date the entire time you can't read it.
//
// The flip itself is CSS (`.flap` in globals.css); this file only decides which
// character each cell should be showing.

/** How often the board re-evaluates itself. Cells flip on their own cadence. */
const TICK_MS = 90;

/** A cell waits this long, picked per flip, before changing again. */
const FLIP_GAP_MS = [70, 230] as const;

/** How long the board clatters before it settles on a phrase. */
const SCRAMBLE_MS = [2400, 5200] as const;

/** Delay between one cell locking onto the phrase and the next — left to right. */
const SETTLE_STEP_MS = 120;

/** How long a settled phrase is legible before the board breaks it up again. */
const HOLD_MS = 2400;

const DIGITS = "0123456789";
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * One position on the board. `gap` is a fixed character — a space or a
 * separator — that never gets a flap of its own, so the board can be shaped
 * like the thing it's pretending to display.
 */
type Slot =
  | { kind: "digit" }
  | { kind: "letter" }
  | { kind: "gap"; char: string };

/**
 * Read a board shape out of a mask string: `#` is a digit flap, `A` is a letter
 * flap, and anything else is printed as-is between them. `"## ### ####"` is a
 * date — day, month, year — which is exactly what the date board never manages
 * to finish saying.
 */
function parseMask(mask: string): Slot[] {
  return [...mask].map((c) => {
    if (c === "#") return { kind: "digit" as const };
    if (c === "A") return { kind: "letter" as const };
    return { kind: "gap" as const, char: c };
  });
}

function randomChar(slot: Slot): string {
  const pool = slot.kind === "digit" ? DIGITS : LETTERS;
  return pool[Math.floor(Math.random() * pool.length)];
}

function randomBetween([lo, hi]: readonly [number, number]): number {
  return lo + Math.random() * (hi - lo);
}

/** Centre a phrase in the board's width, so it settles in the middle. */
function centre(phrase: string, width: number): string {
  const text = phrase.slice(0, width);
  const left = Math.floor((width - text.length) / 2);
  return " ".repeat(left) + text + " ".repeat(width - text.length - left);
}

/**
 * What the board is doing right now.
 *
 * `scramble` is the resting state — the board is only ever *passing through*
 * the other two. A board with no phrases stays in `scramble` for good, which is
 * how the date board is built: same machine, one empty list.
 */
type Phase =
  | { kind: "scramble"; until: number }
  | { kind: "settle"; target: string; from: number }
  | { kind: "hold"; target: string; until: number };

export interface SplitFlapBoardProps {
  /** Board shape: `#` digit flap, `A` letter flap, anything else a fixed gap. */
  mask: string;
  /** Phrases the board may settle on. Omit — or leave empty — and it never does. */
  phrases?: string[];
  /**
   * What the board says to a screen reader. The flaps themselves are hidden:
   * a row of characters rewriting itself several times a second is unreadable
   * announced, and this board is deliberately meaningless anyway — the sentence
   * is the meaning.
   */
  label: string;
  /**
   * Size of a single flap. A board has to fit its width on the narrowest phone
   * without wrapping — a departure board that runs onto a second line stops
   * reading as one, so the default is sized for eleven cells across 360px and
   * grows from there.
   */
  cellClassName?: string;
  className?: string;
}

export function SplitFlapBoard({
  mask,
  phrases,
  label,
  // Eleven cells at 20px plus ten 4px gaps is 260px, inside the 288px a 320px
  // phone leaves after the page gutter. `flex-wrap` below is the backstop, not
  // the plan.
  cellClassName = "h-10 w-5 text-base sm:h-20 sm:w-14 sm:text-4xl",
  className,
}: SplitFlapBoardProps) {
  const slots = useMemo(() => parseMask(mask), [mask]);
  const reduceMotion = useReducedMotion();

  // The phrase list travels into the effect as a single joined string rather
  // than as an array. Two reasons, both about identity: a caller writing
  // `phrases={["SOON"]}` inline hands over a new array on every render, and an
  // effect that restarted on each of those would reset the board mid-word; and
  // a string is something `useEffect` can compare properly. Phrases are board
  // copy — letters and spaces — so the separator can't appear inside one.
  const phraseKey = (phrases ?? []).join("|");

  // The first frame is rendered on the server, where there is no board and no
  // randomness to be had. It shows the opening phrase — or a row of question
  // marks when there are no phrases — which is a truthful still of what the
  // board means, hydrates without a mismatch, and is what someone who asked for
  // reduced motion (or has JS off) keeps looking at.
  const resting = useMemo(() => {
    const first = phraseKey.split("|")[0];
    return first
      ? centre(first, slots.length)
      : slots.map((s) => (s.kind === "gap" ? s.char : "?")).join("");
  }, [phraseKey, slots]);

  const [chars, setChars] = useState<string>(resting);

  useEffect(() => {
    if (reduceMotion) return;
    const phrases = phraseKey ? phraseKey.split("|") : [];

    // Live board state, kept in refs: it changes on every tick and none of it
    // should re-render anything by itself. Only `chars` does that.
    let phase: Phase = { kind: "scramble", until: 0 };
    const nextFlip = slots.map(() => 0);
    let current = [...resting];

    const scrambleFrom = (now: number): Phase => ({
      kind: "scramble",
      until: now + randomBetween(SCRAMBLE_MS),
    });

    const tick = () => {
      // A board nobody is looking at doesn't need to clatter.
      if (typeof document !== "undefined" && document.hidden) return;
      const now = Date.now();

      if (phase.kind === "scramble" && now >= phase.until) {
        phase =
          phrases.length > 0
            ? {
                kind: "settle",
                target: centre(
                  phrases[Math.floor(Math.random() * phrases.length)],
                  slots.length
                ),
                from: now,
              }
            : scrambleFrom(now);
      }

      if (phase.kind === "settle") {
        // Cells lock left to right; once the last one lands the phrase holds.
        const locked = Math.floor((now - phase.from) / SETTLE_STEP_MS);
        if (locked >= slots.length) {
          phase = { kind: "hold", target: phase.target, until: now + HOLD_MS };
        }
      }

      if (phase.kind === "hold" && now >= phase.until) {
        phase = scrambleFrom(now);
      }

      const settledUpTo =
        phase.kind === "settle"
          ? Math.floor((now - phase.from) / SETTLE_STEP_MS)
          : phase.kind === "hold"
            ? slots.length
            : 0;
      const target = phase.kind === "scramble" ? null : phase.target;

      const next = slots.map((slot, i) => {
        if (slot.kind === "gap") return slot.char;
        // Locked: showing its share of the phrase, and done flipping. A space
        // here is the phrase's own padding — a cell that has landed on blank.
        if (target && i < settledUpTo) return target[i];
        // Still loose. Each cell keeps its own clock so the board rattles
        // unevenly, the way a real one does, instead of strobing in lockstep.
        if (now < nextFlip[i]) return current[i];
        nextFlip[i] = now + randomBetween(FLIP_GAP_MS);
        return randomChar(slot);
      });

      current = next;
      setChars(next.join(""));
    };

    const id = setInterval(tick, TICK_MS);
    return () => clearInterval(id);
  }, [slots, phraseKey, resting, reduceMotion]);

  return (
    <div className={cn("inline-flex max-w-full flex-wrap justify-center gap-1 sm:gap-1.5", className)}>
      <span aria-hidden className="inline-flex flex-wrap justify-center gap-1 sm:gap-1.5">
        {slots.map((slot, i) => {
          const char = chars[i] ?? " ";

          // Board furniture: the mask's own separators. They keep the shape of
          // whatever the board is imitating — a date, here — without ever
          // getting a panel of their own or a flip.
          if (slot.kind === "gap") {
            return (
              <span
                key={i}
                className={cn(
                  "inline-flex items-center justify-center font-mono font-bold text-dust/50",
                  slot.char === " " ? "w-2 sm:w-5" : cellClassName
                )}
              >
                {slot.char === " " ? "" : slot.char}
              </span>
            );
          }

          // A flap that has landed on blank — the padding either side of a
          // settled phrase. It holds its width so the board doesn't breathe in
          // and out as words of different lengths come and go.
          if (char === " ") {
            return <span key={i} className={cn("inline-block", cellClassName)} />;
          }

          return <Flap key={i} char={char} className={cellClassName} />;
        })}
      </span>
      <span className="sr-only">{label}</span>
    </div>
  );
}

/**
 * One flap. The character is keyed on itself, so React swaps the element the
 * moment it changes and the CSS flip replays from the start — the animation is
 * driven entirely by the character being different, with nothing to reset.
 */
function Flap({ char, className }: { char: string; className?: string }) {
  return (
    <span
      className={cn(
        "flap inline-flex items-center justify-center font-mono font-bold text-bone tabular-nums",
        className
      )}
    >
      <span key={char} className="flap-char">
        {char}
      </span>
    </span>
  );
}
