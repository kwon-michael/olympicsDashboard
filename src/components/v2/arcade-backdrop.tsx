import type { CSSProperties } from "react";
import { PixelIcon } from "@/components/v2/pixel-icons";

// ============================================
// Attract mode — what the cabinet plays to an empty room
// ============================================
// The hero is a screen, and a screen with nobody at it runs the demo. This is
// the demo, and it is two games:
//
//   Galaga      a squadron holding formation, one bug at a time peeling off to
//               dive, and a fighter underneath firing on a straggler
//   Pac-Man     a chomper clearing the pellet line along the floor with three
//               ghosts on its tail
//
// It was four for a while — ducks and the dog crossing the sky, and a Pong
// rally across the middle — and four was a backdrop you watched instead of a
// page you read. Two games, one at the top of the screen and one along the
// floor, leave the middle to the marquee.
//
// They are kept apart by height rather than by luck: the formation is the top
// third, the floor is the floor, and the middle — where the type is — is masked
// out of the sprite layer entirely. Nothing here is allowed to crawl under it.
//
// It is decoration and nothing else — `aria-hidden`, no pointer events, no
// state, no client component. Every moving part is a `translate`, a `transform`
// or a `clip-path` on an absolutely positioned layer, so none of it can reflow
// the page or force the copy above it to repaint; the timing lives in the
// arcade block of globals.css, the artwork in the sprite sheet, and the staging
// is what's here.
//
// Nothing is random. A backdrop that seeded itself from `Math.random()` would
// render one field on the server and a different one in the browser, and React
// would throw the whole subtree away on hydration — so the stars are a written
// list, chosen to look scattered, and the only variation between sprites is a
// duration or a delay written next to it.
//
// It scales by having no fixed size to begin with: stars are placed in percent
// of the layer, every crossing is a percentage of its own track, and the dive
// is measured in `vw`/`vh`. The only breakpoint in here is a step up in sprite
// size, because six bugs at desktop scale would span a phone.

/**
 * A star: `[x, y]` as a percentage of the band it sits in. Two bands are
 * stacked and drift as one, so a Y here is a position within the loop rather
 * than on the screen — anything from 0 to 100 is equally valid.
 *
 * Placed by hand and unevenly on purpose: a generated grid reads as a grid at
 * any density, and the eye picks that out immediately.
 */
type Star = [number, number];

const FAR_STARS: Star[] = [
  [4, 11],
  [17, 46],
  [23, 88],
  [36, 27],
  [48, 66],
  [59, 8],
  [67, 52],
  [78, 91],
  [86, 34],
  [96, 72],
  [11, 63],
  [91, 17],
];

const NEAR_STARS: Star[] = [
  [9, 31],
  [28, 79],
  [41, 14],
  [54, 94],
  [63, 41],
  [74, 68],
  [88, 6],
  [97, 57],
];

/**
 * One drifting layer, as a background per star: a solid-colour gradient sized
 * to a few pixels square and pinned, which is a hard-edged block — where a
 * radial dot would have been a soft one.
 *
 * A star per background layer rather than a star per element keeps the field to
 * two nodes instead of twenty, and the whole layer moves on a single transform.
 */
function starField(stars: Star[], px: number, color: string): CSSProperties {
  return {
    backgroundImage: stars.map(() => `linear-gradient(${color} 0 0)`).join(","),
    backgroundSize: stars.map(() => `${px}px ${px}px`).join(","),
    backgroundPosition: stars.map(([x, y]) => `${x}% ${y}%`).join(","),
  };
}

/** Two identical bands stacked, so the loop's seam falls on a copy of itself. */
function Starfield({
  stars,
  px,
  color,
  duration,
  className,
}: {
  stars: Star[];
  px: number;
  color: string;
  duration: string;
  className: string;
}) {
  const band = starField(stars, px, color);

  return (
    <div
      className={`arcade-stars ${className}`}
      style={{ "--arcade-drift": duration } as CSSProperties}
    >
      <div className="arcade-stars__strip">
        <div className="arcade-stars__band" style={band} />
        <div className="arcade-stars__band" style={band} />
      </div>
    </div>
  );
}

/**
 * The squadron, left to right. `dive` is the delay on a bug's run down the
 * screen; the ones without it hold the line and only bob. Two divers on
 * different clocks means the formation is usually missing somebody, and never
 * the same somebody twice in a row.
 */
const SQUADRON: { bob: string; dive?: string }[] = [
  { bob: "0ms" },
  { bob: "160ms", dive: "0s" },
  { bob: "320ms" },
  { bob: "80ms" },
  { bob: "240ms", dive: "-5.5s" },
  { bob: "400ms" },
];

/**
 * The chase, front to back. Each ghost rides the same animation as the chomper
 * and is simply parked further back along it — a fixed offset rather than a
 * delay, which matters: a delay is a fraction of the *lane*, so the pack that
 * strings out nicely across a desktop closes into one clump on a phone. An
 * offset is a distance, and a distance is the same distance everywhere.
 *
 * Three of them now, at full strength and a different colour each. Ghosts you
 * can only just make out are a smudge along the bottom of the screen; ghosts
 * you can see are the reason anybody looks down there.
 */
const CHASE: { offset: string; tone: string }[] = [
  { offset: "-translate-x-9 sm:-translate-x-12", tone: "text-signal-bright" },
  { offset: "-translate-x-18 sm:-translate-x-24", tone: "text-beacon-bright" },
  { offset: "-translate-x-27 sm:-translate-x-36", tone: "text-bone" },
];

export function ArcadeBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {/* Two fields at different speeds. The far one is dimmer, smaller and
          slower, which is the only depth cue a flat backdrop gets. */}
      <Starfield
        stars={FAR_STARS}
        px={2}
        color="var(--color-dust)"
        duration="26s"
        className="opacity-40"
      />
      <Starfield
        stars={NEAR_STARS}
        px={3}
        color="var(--color-signal-deep)"
        duration="15s"
        className="opacity-50"
      />

      <div className="arcade-cast">
        {/* The formation, up in the top margin where the marquee isn't. */}
        <div className="absolute inset-x-0 top-[7%] flex justify-center">
          <div className="arcade-squadron flex items-start gap-4 sm:gap-7">
            {SQUADRON.map(({ bob, dive }) => (
              <PixelIcon
                key={bob}
                name="alien"
                className={
                  dive
                    ? "arcade-diver h-4 w-4 text-signal-deep sm:h-5 sm:w-5"
                    : "arcade-alien h-4 w-4 text-dust/70 sm:h-5 sm:w-5"
                }
                style={
                  {
                    animationDelay: dive ?? bob,
                    ...(dive ? { "--arcade-dive": "13s" } : null),
                  } as CSSProperties
                }
              />
            ))}
          </div>
        </div>

        {/* The fighter, the round it fires, and the straggler it's firing at.

            The column is the whole engagement: its top is the bug's height and
            its bottom is the ship's nose, so the round's travel is the gap
            between the two and never needs measuring. The bug, the burst and
            the round all run the same 2.6s, which is the only reason the hit
            lands where it does — nothing here knows about anything else. */}
        <div
          className="absolute top-[11%] right-[7%] bottom-[22%] w-6 sm:right-[9%] sm:w-8"
          style={{ "--arcade-shot": "2.6s" } as CSSProperties}
        >
          <div className="arcade-shot">
            <span className="absolute top-full left-1/2 block h-3 w-[3px] -translate-x-1/2 bg-signal-bright sm:h-4" />
          </div>

          <span className="absolute -top-2 left-1/2 flex h-5 w-5 -translate-x-1/2 items-center justify-center sm:h-6 sm:w-6">
            <PixelIcon
              name="alien"
              className="arcade-hit h-4 w-4 text-signal-deep sm:h-5 sm:w-5"
            />
            <PixelIcon
              name="burst"
              className="arcade-burst absolute inset-0 h-full w-full text-bone"
            />
          </span>

          <div className="absolute inset-x-0 top-full flex justify-center">
            <PixelIcon
              name="ship"
              className="arcade-ship h-5 w-6 text-bone/65 sm:h-7 sm:w-8"
            />
          </div>
        </div>

        {/* The floor. The lane is as wide as the screen and the pellets are
            clipped away under the chomper's mouth as it goes — see the note on
            `.arcade-chase` in globals.css for why that lines up without a
            single measurement. */}
        <div
          className="absolute inset-x-0 bottom-6 h-6 sm:bottom-7 sm:h-8"
          style={{ "--arcade-lap": "13s" } as CSSProperties}
        >
          <div className="arcade-pellets absolute inset-0 text-dust/55" />

          {/* Two heads in the same box, the shut one switched on and off over
              the open one. The pair is dimmed by the wrapper rather than by
              each sprite: at 80% each, the half of the head they both draw
              would come out denser than the mouth only one of them draws, and
              the chomp would flicker between two weights of the same shape. */}
          <div className="arcade-chase">
            <span className="absolute top-1/2 right-full block h-6 w-6 -translate-y-1/2 text-bone opacity-80 sm:h-8 sm:w-8">
              <PixelIcon
                name="chomper"
                className="absolute inset-0 h-full w-full"
              />
              <PixelIcon
                name="chomperShut"
                className="arcade-chomp absolute inset-0 h-full w-full"
              />
            </span>
          </div>

          {CHASE.map(({ offset, tone }) => (
            <div key={offset} className="arcade-chase">
              <PixelIcon
                name="ghost"
                className={`absolute top-1/2 right-full h-6 w-6 -translate-y-1/2 sm:h-8 sm:w-8 ${offset} ${tone}`}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
