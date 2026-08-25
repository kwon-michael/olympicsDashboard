"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

// ============================================
// The attract line — what the cabinet says between demos
// ============================================
// One line of text under the marquee, typed out a character at a time, held
// long enough to read, cleared, and replaced by the next one. A cabinet with
// nobody at it does exactly this: it has three or four things to tell you and
// it cycles them until somebody puts a coin in.
//
// Typed rather than faded or slid in, because a bitmap display has no way to
// half-draw a character — it either wrote it or it didn't. The cursor is the
// block cursor a terminal leaves at the end of a line (`.pixel-cursor`), solid
// while the line is being written and blinking once it's finished, which is
// the one piece of state a terminal has ever had.
//
// Everything about the timing is a whole character or a whole line. Nothing
// interpolates, nothing eases, and the box never changes size — see `width`
// below for why that costs no measurement.

/** Milliseconds per character. About as fast as a cabinet writes. */
const TYPE_MS = 55;

/** How long a finished line sits before it clears. */
const HOLD_MS = 2800;

/** The dark beat between one line clearing and the next starting. */
const BLANK_MS = 400;

/** Where the line is in its cycle. */
type Phase = "type" | "hold" | "blank";

export interface AttractLineProps {
  /**
   * The messages, in order, looping. Each one is a whole line — they are never
   * wrapped, so keep them inside about 26 characters, which is what a 320px
   * phone fits at this size.
   */
  lines: string[];
  /**
   * What the line says to a screen reader — the whole cycle, once, as a
   * sentence. The visible text is hidden from it: a line that rewrites itself
   * every few seconds is unreadable announced, and reading four fragments of
   * marquee shouting isn't the same as being told the thing they add up to.
   */
  label: string;
  className?: string;
}

export function AttractLine({ lines, label, className }: AttractLineProps) {
  const reduceMotion = useReducedMotion();

  // The lines travel into the effect joined, not as an array: a caller writing
  // the list inline hands over a new array on every render, and an effect
  // restarting on each of those would retype the line under you. A string is
  // also something `useEffect` can actually compare. The separator can't turn
  // up inside a line — these are marquee copy, letters and spaces.
  const script = lines.join("|");

  // The first frame is rendered on the server, where there is no clock: it
  // shows the opening line, whole. That hydrates without a mismatch, is what
  // anyone with JS off or reduced motion on keeps looking at, and means the
  // page never flashes an empty line before the typing starts. The effect
  // below picks up from there — already holding line one — rather than
  // rewinding to a single character.
  const [shown, setShown] = useState(lines[0] ?? "");
  const [writing, setWriting] = useState(false);

  // How many characters the line being typed will end up being — not how many
  // are on screen yet. It's what the box is sized to, and it is what centres
  // each line rather than left-aligning them all to a common edge. See the note
  // above the box below.
  const [slot, setSlot] = useState(lines[0]?.length ?? 0);

  useEffect(() => {
    if (reduceMotion) return;
    const messages = script.split("|");

    let index = 0;
    let cut = messages[0].length;
    let phase: Phase = "hold";
    let until = Date.now() + HOLD_MS;

    const tick = () => {
      // A screen nobody is looking at doesn't need to be writing on itself.
      if (typeof document !== "undefined" && document.hidden) return;
      const now = Date.now();

      if (phase === "type") {
        cut += 1;
        setShown(messages[index].slice(0, cut));
        if (cut >= messages[index].length) {
          phase = "hold";
          until = now + HOLD_MS;
          setWriting(false);
        }
        return;
      }

      if (now < until) return;

      if (phase === "hold") {
        phase = "blank";
        until = now + BLANK_MS;
        setShown("");
        // The box takes the *next* line's width now, while the line is empty,
        // so the only thing that moves when it resizes is a cursor with nothing
        // next to it. Do it a beat later, when the typing starts, and the first
        // character would land and then slide.
        setSlot(messages[(index + 1) % messages.length].length);
        return;
      }

      index = (index + 1) % messages.length;
      cut = 0;
      phase = "type";
      setWriting(true);
    };

    const id = setInterval(tick, TYPE_MS);
    return () => clearInterval(id);
  }, [script, reduceMotion]);

  // The box is *this* line's length plus the cursor, centred — which is the
  // whole of how the line centres itself. Sized to the longest line instead,
  // every message would start at the same left edge and the short ones would
  // hang left of a page that is otherwise centred down the middle.
  //
  // The width is stated rather than measured: this face is exactly one em per
  // character and `ch` is one character advance, so `22ch` *is* twenty-two
  // characters at whatever size the line is being rendered — on a phone, on a
  // desktop, and on the fallback face too.
  //
  // Left-aligned inside that box, which matters as much as the centring does:
  // the text grows rightwards off the edge the finished line will start at, so
  // characters land where they will stay. Centre the text instead and every
  // character already typed slides left as the next one arrives.

  return (
    <p
      className={cn(
        "font-pixel mx-auto text-left leading-[2] text-dust",
        className
      )}
      style={{ width: `${slot + 1}ch` }}
    >
      <span aria-hidden>{shown}</span>
      <span
        aria-hidden
        className={cn(
          "ml-[0.15em] inline-block h-[0.9em] w-[0.7em] translate-y-[0.1em] bg-signal",
          !writing && "pixel-cursor"
        )}
      />
      <span className="sr-only">{label}</span>
    </p>
  );
}
