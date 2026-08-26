"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { PixelIcon } from "@/components/v2/pixel-icons";
import { cn } from "@/lib/utils";

// ============================================
// The boot screen — what the cabinet does before it lets you play
// ============================================
// The front door is an arcade cabinet in attract mode, and a cabinet doesn't
// come up in attract mode: it comes up loading. This is that — a black screen
// with the wordmark, a segmented bar filling left to right, a percentage
// counting up beside it, and the machine narrating what it's doing. When it
// reaches the end the power cuts, the screen collapses into a line, and the
// page underneath is already there.
//
// It plays once. Not once ever — once per visit, keyed in `sessionStorage`, so
// the first arrival gets the whole ceremony and everything after it (back from
// the 2026 site, a second look at the page, a link followed and reversed) goes
// straight to the marquee. A loader you have to sit through every time you
// press Back is a toll, not a flourish.
//
// Three details are load-bearing, and all three are about the first paint:
//
//   the markup is server-rendered   so the screen is over the page from the
//                                   very first frame, rather than appearing a
//                                   beat after React wakes up — by which point
//                                   the visitor has already seen the hero and
//                                   the loader is a lie
//   `SKIP` runs before it           an inline script, rendered ahead of the
//                                   overlay, marks the document as already
//                                   booted so CSS can hide the screen in the
//                                   same paint. It writes to <html> rather
//                                   than to anything React owns, which is why
//                                   hydration never sees a node change under it
//   nothing here is real            the bar is not measuring a download. The
//                                   page is a static render and was ready
//                                   before the bar started; the cadence below
//                                   is a written performance, and the honest
//                                   thing to do with a fake loader is keep it
//                                   short

/** Where the "you have already seen this" flag lives, for this tab only. */
const BOOT_KEY = "casualympics:booted";

/**
 * Rendered ahead of the overlay and run by the parser on the way past. If this
 * tab has booted once already it stamps the document, and the rule in
 * globals.css takes the screen out before it is ever painted.
 *
 * Wrapped in try/catch because `sessionStorage` throws outright in some privacy
 * modes rather than coming back empty — and a boot screen is not worth a
 * blank page.
 */
const SKIP = `try{if(sessionStorage.getItem(${JSON.stringify(
  BOOT_KEY
)})==="1")document.documentElement.setAttribute("data-booted","")}catch(e){}`;

/** One frame of the bar. */
const TICK_MS = 70;

/** How long READY sits on screen before the power cuts. */
const READY_MS = 420;

/** Cells in the bar. A factor of 100, so `RUN` divides into whole cells. */
const SEGMENTS = 20;

/**
 * The load, frame by frame, as percentages.
 *
 * Written out rather than counted up, because a real loader does not advance
 * evenly — it takes a run of blocks at once, stalls on something, then catches
 * up. The repeats are those stalls, and they are the whole reason this reads as
 * a machine doing work rather than as a bar being animated. Multiples of five,
 * so every frame lands on a cell boundary and no cell is ever half lit.
 *
 * Twenty-four frames at 70ms is a hair under 1.7s, which is long enough to
 * watch and short enough that nobody arriving for the second time in a new tab
 * resents it.
 */
const RUN = [
  0, 5, 10, 10, 15, 20, 30, 30, 30, 35, 40, 50, 55, 55, 60, 70, 75, 75, 75, 80,
  85, 90, 95, 100,
];

/**
 * What the machine says it is doing, by how far along it is. A cabinet's boot
 * text is a list of subsystems, so this is the arcade's own: the screen, the
 * artwork, the demo it is about to play.
 */
function status(pct: number): string {
  if (pct >= 100) return "READY";
  if (pct >= 75) return "STARTING ATTRACT MODE";
  if (pct >= 50) return "WARMING PHOSPHOR";
  if (pct >= 25) return "LOADING SPRITES";
  return "BOOTING CABINET";
}

/** Where the screen is in its short life. `gone` is unmounted. */
type Stage = "run" | "off" | "gone";

export function BootScreen() {
  const reduceMotion = useReducedMotion();

  // The server frame is the first one: an empty bar at 0%. That is what the
  // first paint shows and what hydration matches, so there is no flash of a
  // half-loaded bar and no mismatch to reconcile.
  const [frame, setFrame] = useState(0);
  const [stage, setStage] = useState<Stage>("run");

  useEffect(() => {
    let seen = false;
    try {
      seen = window.sessionStorage.getItem(BOOT_KEY) === "1";
    } catch {
      // Storage is unavailable — treat it as a first visit and play the boot.
      // The alternative is suppressing it forever in a browser that is only
      // refusing to remember things.
    }

    // Somebody who has asked for less motion is asking for less of exactly
    // this: an animation between them and the page. They get the page.
    //
    // The attribute goes on first and the unmount follows a tick later, and the
    // order is the point: the CSS rule keyed off `data-booted` takes the screen
    // out of the paint immediately, so nothing is on screen while React gets
    // round to removing the node. (For a returning visitor the inline script
    // stamped it before this component ever rendered; this is the
    // reduced-motion path catching up.)
    if (seen || reduceMotion) {
      document.documentElement.setAttribute("data-booted", "");
      const done = setTimeout(() => setStage("gone"), 0);
      return () => clearTimeout(done);
    }

    // Marked at the start rather than at the end, deliberately. Leaving
    // half-way through and coming back means you have already sat through most
    // of it; replaying it from zero would be the machine forgetting.
    try {
      window.sessionStorage.setItem(BOOT_KEY, "1");
    } catch {
      // Nothing to do — see above.
    }

    let index = 0;
    let cut: ReturnType<typeof setTimeout> | undefined;

    const id = setInterval(() => {
      index += 1;
      if (index < RUN.length) {
        setFrame(index);
        return;
      }
      clearInterval(id);
      cut = setTimeout(() => setStage("off"), READY_MS);
    }, TICK_MS);

    return () => {
      clearInterval(id);
      clearTimeout(cut);
    };
  }, [reduceMotion]);

  if (stage === "gone") {
    return (
      // The script still ships, and it still has to run on a visit that never
      // renders the overlay: it is what stamps the document for the paint
      // *before* this component exists. Rendering it here too keeps the node
      // in the same place in the tree across both states.
      <script dangerouslySetInnerHTML={{ __html: SKIP }} />
    );
  }

  const pct = RUN[frame];
  const lit = (pct / 100) * SEGMENTS;

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: SKIP }} />

      {/* `boot-screen` is the hook for the two rules in globals.css — hide it
          for a tab that has booted, and hold the page still while it hasn't.
          `crt-screen` lays the same scanlines over it as the hero, so the
          loader and the thing it uncovers are on one piece of glass. */}
      <div
        role="status"
        className={cn(
          "boot-screen crt-screen fixed inset-0 z-[100] flex flex-col items-center justify-center gap-8 bg-void px-6",
          stage === "off" && "boot-off pointer-events-none"
        )}
        onAnimationEnd={(event) => {
          // Only the power cut ends. The blinking line below runs forever and
          // never fires this, but a child's animation would bubble here if one
          // ever did.
          if (event.target === event.currentTarget) setStage("gone");
        }}
      >
        {/* One sentence, once. The bar, the percentage and the subsystem
            narration are a performance for the eye; announced, they would be a
            counter shouting numbers over a page that is already loaded. */}
        <p className="sr-only">Loading Casualympics Showdown.</p>

        <div aria-hidden className="w-full max-w-lg">
          <p className="font-pixel mb-2 text-center text-xs leading-none sm:text-lg">
            <span className="text-bone">CASUAL</span>
            <span className="text-signal">YMPICS</span>
          </p>
          <p className="font-pixel mb-10 text-center text-[8px] leading-none text-dust sm:text-[10px]">
            SHOWDOWN
          </p>

          {/* The bar. A frame in accent rather than hairline: on a screen with
              nothing else on it, the loader is allowed to be the lit thing.
              `pixel-box` draws that frame in box-shadow and takes no layout,
              hence the 4px margin for it to land in. */}
          <div className="pixel-box m-1 bg-panel p-1.5 [--pixel-edge:var(--color-signal-deep)]">
            <div className="flex gap-[3px]">
              {Array.from({ length: SEGMENTS }, (_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-3.5 flex-1 sm:h-5",
                    // The leading cell is brighter than the ones behind it —
                    // the head of the bar, still being written.
                    i < lit - 1
                      ? "bg-signal"
                      : i < lit
                        ? "bg-signal-bright"
                        : "bg-hairline"
                  )}
                />
              ))}
            </div>
          </div>

          {/* What it is doing, and how far in. The percentage keeps its leading
              zeros for the same reason the date board does: a readout that
              changes width is a readout that jitters, and three cells that are
              always three cells never move the line under them. */}
          <div className="font-pixel mt-4 flex items-center justify-between gap-4 text-[8px] leading-none sm:text-[10px]">
            <span className="flex min-w-0 items-center gap-2 text-dust">
              <PixelIcon name="coin" className="h-2.5 w-2.5 shrink-0 text-signal" />
              <span className="truncate">{status(pct)}</span>
            </span>
            <span className="shrink-0 text-signal">
              {String(pct).padStart(3, "0")}%
            </span>
          </div>
        </div>

        {/* The warning every cartridge era printed over its own save screen.
            Blinking on the same 1.1s count as PRESS START on the page behind
            it, so the machine keeps one clock across both screens. */}
        <p
          aria-hidden
          className="font-pixel pixel-blink text-center text-[7px] leading-[1.8] text-dust/60 sm:text-[9px]"
        >
          DO NOT TURN OFF THE POWER
        </p>
      </div>
    </>
  );
}
