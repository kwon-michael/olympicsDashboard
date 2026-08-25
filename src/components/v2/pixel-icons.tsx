// ============================================
// Pixel sprites — the arcade front door's icon set
// ============================================
// The 2026 site draws its icons from lucide: even strokes, rounded caps, drawn
// on curves. Next to a bitmap face those read as a different decade, so the
// arcade pages (app/(v2)) use these instead — every icon on a whole-pixel grid,
// no stroke, no curve, no anti-aliasing.
//
// Each sprite is authored as a grid of characters: `#` is a lit pixel and
// anything else is off. That means the artwork is legible in the source as the
// thing it draws, and editing one is a matter of moving a `#`, which is the
// only reason a hand-drawn icon set is maintainable at all.
//
// Sprites use `currentColor` and scale to whatever box they're given, exactly
// like the lucide icons they replace, so a caller still sizes and colours one
// with `className="h-4 w-4 text-signal"`. `.pixel-sprite` (globals.css) is what
// stops the renderer smoothing the edges on the way up.

/**
 * Horizontal runs of lit pixels, one per unbroken stretch in a row.
 *
 * A rect per lit pixel would be correct and wasteful — an 8×8 sprite would cost
 * sixty-four nodes and the archive grid renders nine of them. Merging each row's
 * runs brings a typical sprite down to a dozen or so, and because runs are only
 * ever merged along a row the output is pixel-identical either way.
 */
function runs(rows: string[]): { x: number; y: number; w: number }[] {
  const out: { x: number; y: number; w: number }[] = [];

  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (row[x] !== "#") {
        x += 1;
        continue;
      }
      let w = 1;
      while (row[x + w] === "#") w += 1;
      out.push({ x, y, w });
      x += w;
    }
  });

  return out;
}

/**
 * The sprite sheet. Every grid is square and 8×8 unless it needs the room —
 * the runner leans, so it gets 9×9 — and the renderer takes the viewBox from
 * the grid it's handed, so a sprite can be any size without anyone being told.
 */
export const PIXEL_SPRITES = {
  /** Leaderboard. Cup, handles, stem, base. */
  trophy: [
    ".######.",
    "########",
    "##....##",
    ".######.",
    "..####..",
    "...##...",
    "..####..",
    ".######.",
  ],
  /** Teams. Two figures, shoulder to shoulder. */
  users: [
    "........",
    ".##..##.",
    ".##..##.",
    "........",
    "###..###",
    "###..###",
    "###..###",
    "###..###",
  ],
  /** Rules. An open book, spine down the middle. */
  book: [
    "########",
    "#..##..#",
    "#..##..#",
    "#..##..#",
    "#..##..#",
    "#..##..#",
    "#..##..#",
    "########",
  ],
  /** Format. A lowercase i knocked out of a filled box. */
  info: [
    "########",
    "#......#",
    "#..##..#",
    "#......#",
    "#..##..#",
    "#..##..#",
    "#......#",
    "########",
  ],
  /** Schedule. A clock face with both hands cut out of it. */
  clock: [
    "..####..",
    ".##.###.",
    "###.####",
    "###.####",
    "####...#",
    "########",
    ".######.",
    "..####..",
  ],
  /** Venue. Map marker, hole through the head. */
  pin: [
    "..####..",
    ".######.",
    "###..###",
    "###..###",
    ".######.",
    "..####..",
    "...##...",
    "...##...",
  ],
  /** Photos. Body, viewfinder, flash, and a round lens. */
  camera: [
    "........",
    ".###..#.",
    "########",
    "###..###",
    "##....##",
    "##....##",
    "###..###",
    "########",
  ],
  /** Tug of War. Crossed blades — the versus mark. */
  swords: [
    "#......#",
    ".#....#.",
    "..#..#..",
    "...##...",
    "...##...",
    "..#..#..",
    ".#....#.",
    "##....##",
  ],
  /** Dodgeball. */
  ball: [
    "..####..",
    ".##..##.",
    "##....##",
    "#......#",
    "#......#",
    "##....##",
    ".##..##.",
    "..####..",
  ],
  /** The brand mark, redrawn. A figure mid-stride, leaning into the run. */
  runner: [
    ".....##..",
    ".....##..",
    "..#####..",
    ".##..##..",
    "....##...",
    "...####..",
    "..##..##.",
    ".##....##",
    "##.......",
  ],
  /** Credits, and the one place the arcade still says something sincerely. */
  heart: [
    ".##..##.",
    "########",
    "########",
    "########",
    ".######.",
    "..####..",
    "...##...",
    "........",
  ],
  /** Insert coin. */
  coin: [
    "..####..",
    ".#....#.",
    "#..##..#",
    "#.####.#",
    "#.####.#",
    "#..##..#",
    ".#....#.",
    "..####..",
  ],
  /** Attract mode. A squadron bug, drawn head-on with its wings out. */
  alien: [
    "..#...#..",
    "...#.#...",
    "..#####..",
    ".##.#.##.",
    "#########",
    "#.#####.#",
    "#.#...#.#",
    "..##.##..",
  ],
  /** Attract mode. The chaser: two eyes, and a skirt with three legs. */
  ghost: [
    "..####..",
    ".######.",
    "##.##.##",
    "##.##.##",
    "########",
    "########",
    "########",
    "##.##.##",
  ],
  /** Attract mode. Mouth open, facing right — the wedge narrows to the centre. */
  chomper: [
    "..####..",
    ".######.",
    "#######.",
    "#####...",
    "#####...",
    "#######.",
    ".######.",
    "..####..",
  ],
  /** The same head with the mouth shut. Alternating the two is the chomp. */
  chomperShut: [
    "..####..",
    ".######.",
    "########",
    "#######.",
    "#######.",
    "########",
    ".######.",
    "..####..",
  ],
  /** Attract mode. The fighter, nose up — it sits under the squadron. */
  ship: [
    "....#....",
    "...###...",
    "...###...",
    "..#####..",
    ".#######.",
    "#########",
    "##.###.##",
    "#.......#",
  ],
  /** Attract mode. A hit, one frame of it. */
  burst: [
    "...#...",
    ".#.#.#.",
    "..###..",
    "###.###",
    "..###..",
    ".#.#.#.",
    "...#...",
  ],
  /** A pad: d-pad left, two buttons right, grips underneath. */
  gamepad: [
    "..######..",
    "##########",
    "##.####.##",
    "#...######",
    "##.####.##",
    "##########",
    "##......##",
  ],
} as const;

export type PixelSpriteName = keyof typeof PIXEL_SPRITES;

export interface PixelIconProps {
  /** Which sprite to draw. */
  name: PixelSpriteName;
  /** Sized and coloured by the caller, lucide-style: `h-4 w-4 text-signal`. */
  className?: string;
  /** For the callers that stagger a sprite: an animation delay, a custom
      property. Nothing here styles itself — this only forwards. */
  style?: React.CSSProperties;
}

export function PixelIcon({ name, className, style }: PixelIconProps) {
  const rows = PIXEL_SPRITES[name];
  const width = Math.max(...rows.map((row) => row.length));

  return (
    <svg
      viewBox={`0 0 ${width} ${rows.length}`}
      fill="currentColor"
      className={`pixel-sprite ${className ?? ""}`}
      style={style}
      aria-hidden="true"
    >
      {runs([...rows]).map(({ x, y, w }) => (
        <rect key={`${x}:${y}`} x={x} y={y} width={w} height={1} />
      ))}
    </svg>
  );
}
