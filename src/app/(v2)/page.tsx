import Link from "next/link";
import { AttractLine } from "@/components/v2/attract-line";
import { DateSlots } from "@/components/v2/date-slots";
import { PixelIcon, type PixelSpriteName } from "@/components/v2/pixel-icons";
import { ArcadeBackdrop } from "@/components/v2/arcade-backdrop";
import { BootScreen } from "@/components/v2/boot-screen";

// ============================================
// The front door for the next event
// ============================================
// The next one is a spin-off — the Virtualympics, by Casualympics — and it's
// gaming-themed, so the page is a cabinet left in attract mode:
// a marquee, a HUD across the top, a demo playing itself in the background, and
// PRESS START blinking at nobody in particular. Every edge is a whole number of
// pixels and nothing on the page has a curve — the primitives are in the arcade
// block of globals.css and the icons are hand-drawn sprites
// (components/v2/pixel-icons.tsx).
//
// The cabinet takes the whole screen. The hero is the viewport less the header,
// so arriving puts you in front of it rather than beside it, and it boots
// before it plays: the first arrival in a tab gets a loading bar and the power
// cutting into the marquee (components/v2/boot-screen.tsx), and every arrival
// after that goes straight through.
//
// The 2026 home page led with a countdown clock. This one leads with the line
// of attract text a cabinet would show and the opening-ceremony date entered
// into the board underneath it — plainly, in the order somebody arriving wants
// them. For a while there was no date and the board was an empty field with the
// cursor waiting in the first cell; the cells stayed and the cursor went the
// day the date was set, which is the only edit that needed making.
//
// The other half of the page is the archive, which the arcade reframes as a
// stage select. The 2026 site is finished, but it's finished in the sense that a
// season is, and the standings, teams, rules and results are all still live at
// their original URLs. The menu below is the way back into it.

/**
 * The opening ceremony: Sunday 3 January 2027.
 *
 * Split for the display rather than formatted at runtime — the board is nine
 * cells in three groups and this is the shape of it, so a `Date` here would
 * only be taken apart again. The month is the three letters a cabinet has room
 * for, and the day keeps its leading zero because a nine-cell board with a
 * blank in it is a board with a fault.
 */
const OPENING = {
  groups: ["03", "JAN", "2027"],
  weekday: "SUNDAY",
  /** The same date in a sentence, for anyone not looking at the cells. */
  spoken: "The Virtualympics opening ceremony is on Sunday 3 January 2027.",
};

/**
 * The attract line, in order, looping.
 *
 * Four things the page knows, in the order somebody arriving wants them: the
 * date, what the Virtualympics is, what it's like, and where everything from
 * last time still lives. A cabinet's attract text is instructional — no teasing and
 * no jokes, and now that there's a date the page leads with it rather than
 * with the fact that it exists.
 *
 * The weekday used to have a line of its own here. It lost it to the spin-off:
 * the date board already says SUNDAY under the date, and the line the marquee
 * carries instead is whose event this is.
 *
 * Kept inside 26 characters each, which is what a 320px phone fits on one line
 * at this size (see `AttractLine`).
 */
const ATTRACT = [
  "NEXT EVENT 3 JAN 2027",
  "A CASUALYMPICS SPINOFF",
  "THIS ONE IS GAMING THEMED",
  "2026 SITE IS STILL LIVE",
];

/**
 * The 2026 site, page by page — the stage select. Everything here is still live
 * at its own URL; the sprites are the arcade's own, since lucide's line icons
 * read as a different decade next to a bitmap face.
 */
const ARCHIVE_LINKS: { href: string; label: string; sprite: PixelSpriteName }[] =
  [
    { href: "/leaderboard", label: "Leaderboard", sprite: "trophy" },
    { href: "/teams", label: "Teams", sprite: "users" },
    { href: "/rules", label: "Rules", sprite: "book" },
    { href: "/format", label: "Format", sprite: "info" },
    { href: "/schedule", label: "Schedule", sprite: "clock" },
    { href: "/venue", label: "Venue", sprite: "pin" },
    { href: "/photos", label: "Photos", sprite: "camera" },
    { href: "/tug-of-war", label: "Tug of War", sprite: "swords" },
    { href: "/dodgeball", label: "Dodgeball", sprite: "ball" },
  ];

export default function NextHomePage() {
  return (
    <div>
      {/* The boot sequence — the loading bar the cabinet runs before it drops
          into attract mode. First arrival in a tab only; everything after it
          lands straight on the marquee. It renders here, first, because its
          inline script has to reach the parser before the overlay does. */}
      <BootScreen />

      {/* The screen. `crt-screen` lays scanlines and a phosphor wash over
          everything inside it, so this section is the glass and the rest of the
          page sits outside the cabinet.

          It is the whole viewport, less the header sitting above it — a cabinet
          is a screen you stand in front of, not a banner you scroll past, and
          the archive below is something you go looking for rather than
          something that shares the first screenful with the marquee. `svh`
          rather than `vh` so a phone's disappearing browser chrome doesn't
          leave the hero an address bar taller than the window. */}
      <section className="crt-screen relative flex min-h-[calc(100svh-4rem)] flex-col overflow-hidden border-b-4 border-hairline">
        {/* An 8px pixel grid instead of the old site's soft blobs — the same
            job the 56px hairline grid did, on the arcade's own scale, so it
            reads as a screen rather than a drawing. Decorative only. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage:
              "linear-gradient(var(--color-hairline) 1px, transparent 1px), linear-gradient(90deg, var(--color-hairline) 1px, transparent 1px)",
            backgroundSize: "8px 8px",
            maskImage:
              "radial-gradient(ellipse 80% 60% at 50% 35%, #000 40%, transparent 100%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 80% 60% at 50% 35%, #000 40%, transparent 100%)",
          }}
        />

        {/* Attract mode: the starfield, the squadron and the chase. Sits under
            everything below it in the same stacking context, purely because it
            comes first in the source. */}
        <ArcadeBackdrop />

        {/* The HUD. A cabinet puts the current player's score against the best
            one anybody has managed — which, here, is genuinely the 2026 event:
            the score to beat is the last one that actually happened. */}
        <div className="font-pixel relative shrink-0 border-b-4 border-hairline">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 text-[8px] leading-none sm:px-6 sm:text-[10px] lg:px-8">
            <p className="flex items-center gap-2 text-signal">
              <PixelIcon name="coin" className="h-3 w-3" />
              <span>
                1UP <span className="text-bone">????</span>
              </span>
            </p>
            <p className="text-dust">
              HI-SCORE <span className="text-beacon-bright">2026</span>
            </p>
          </div>
        </div>

        {/* The screen's contents, centred in whatever is left of it after the
            HUD. `flex-1` and `justify-center` rather than a stack of padding:
            the block has to sit in the middle of a 700px laptop window and a
            1200px desktop one alike, and only one of those is a number this
            file could have guessed. */}
        <div className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-4 py-12 text-center sm:px-6 sm:py-16 lg:px-8">
          {/* `w-fit` because the badge is a flex item now and would otherwise
              stretch to the width of the screen, taking its background with
              it. */}
          <p className="font-pixel mx-auto mb-12 flex w-fit items-center gap-2.5 bg-void px-5 py-3 text-[9px] leading-none text-dust ring-2 ring-hairline ring-inset sm:text-[11px]">
            <PixelIcon name="gamepad" className="h-3 w-4 text-signal sm:h-3.5 sm:w-5" />
            THE NEXT ONE
          </p>

          {/* The marquee: the event's own name on one line and whose event it
              is under it, which is the shape every arcade spin-off's title card
              has ever taken.

              A bitmap face is exactly one em wide per glyph, so the sizes here
              are arithmetic rather than guesses. Thirteen characters cost a
              knowable 13em: at 6.4vw that's 83% of the viewport, which clears
              the section's padding at every width and still leaves room for the
              shadow hanging off the right edge, and the cap stops it at 5.5rem
              — 13em, or 71.5rem, inside the 80rem container it sits in with
              4.5rem spare for the padding, the screen-print shadow and the
              splash hanging off the corner. Both numbers came down a notch when
              the name went from twelve characters to thirteen; the container is
              already as wide as this page's grid goes, so the title gives way
              rather than the layout. It has been widened twice before for this
              same reason, 64rem to 72rem to 80rem, and the HUD above was
              widened with it each time so the cabinet's chrome still lines up.

              BY CASUALYMPICS is the splash: the small tilted line a title
              screen drops on the corner of its own logo. It rests *on* the
              wordmark rather than sitting under it, hung off the bottom-right
              where the last letters are, and it throbs on a two-frame count.
              It is carrying a second job now that the title no longer names the
              parent event: it is the only thing on the page that says whose
              spin-off this is.

              The wordmark's own span is what it's positioned against —
              `inline-block`, so the box shrink-wraps to those twelve characters
              and `right` means the end of the word rather than the end of the
              page. Everything about the tag is in the title's own em, so the
              two scale together; the one exception is the floor on its font
              size, because a fifth of 22px is four pixels of bitmap face and
              nobody has ever read that. A fifth rather than the quarter it was:
              fifteen characters at a quarter would lie across most of the
              wordmark, and a splash is a mark on a logo rather than a second
              line of it.

              That floor is also why it drops below the corner on a phone
              instead of resting on it. Held to a legible nine pixels against a
              wordmark only 270px wide, the tag stops being a mark on the logo
              and starts being a line written across it — so at that size it
              hangs off the bottom-right instead, and takes the corner back at
              `sm`, where the title is big enough to carry it.

              `nowrap` on both is the belt to those braces — a fallback face
              that measures wider must overhang the screen rather than break a
              word in half. */}
          <h1 className="font-pixel mx-auto text-[clamp(1.1rem,6.4vw,5.5rem)] leading-[1.2] font-normal tracking-normal">
            <span className="relative inline-block">
              <span className="pixel-marquee block whitespace-nowrap">
                <span className="text-bone">VIRTUAL</span>
                <span className="text-signal">YMPICS</span>
                <span className="sr-only">™</span>
              </span>
              <span className="absolute right-[-0.15em] bottom-[-0.42em] rotate-[-12deg] sm:right-[-0.1em] sm:bottom-[0.05em]">
                <span className="pixel-splash block text-[max(9px,0.2em)] leading-none whitespace-nowrap text-bone">
                  BY CASUALYMPICS
                </span>
              </span>
            </span>
          </h1>

          {/* The attract line — one message at a time, typed out, held, and
              replaced by the next. It says everything the page used to spend
              two boards and a paragraph not saying. */}
          <AttractLine
            lines={ATTRACT}
            label="The Virtualympics, a Casualympics spin-off event, is on Sunday 3 January 2027. It is gaming themed, and the 2026 site is still live."
            className="mt-12 text-[10px] sm:text-base"
          />

          {/* The date, entered. This block spent a while as an empty field with
              a cursor in the first cell, which was the honest way to draw a
              date nobody had set; the cells stayed and the cursor went the
              moment there was something to put in them. */}
          <div className="mt-16">
            <p className="font-pixel mb-6 text-[9px] leading-none text-dust sm:text-xs">
              OPENING CEREMONY
            </p>
            <DateSlots
              groups={OPENING.groups}
              caption={OPENING.weekday}
              label={OPENING.spoken}
            />
          </div>

          {/* Attract mode. Deliberately not a link: a cabinet blinks this at an
              empty room, and a click target that spends half its life invisible
              is a worse affordance than the CONTINUE button further down. The
              global reduced-motion rule settles it on `opacity: 1`. */}
          <p
            className="font-pixel pixel-blink pixel-glow mt-16 text-xs leading-none text-beacon-bright sm:text-base"
            aria-hidden
          >
            PRESS START
          </p>
        </div>
      </section>

      {/* Stage select — the way back into the 2026 site.

          Deliberately the quiet half of the page. It is a menu of somewhere
          you have already been, so it sits in a much narrower column than the
          hero (48rem against the screen's 80rem), a step down in every type
          size, and in hairline rather than accent. Now that the cabinet takes
          the whole viewport this is below the fold outright, which is the same
          decision made twice: somebody who came here for the next event should
          meet the cabinet first and go looking for this. */}
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <h2 className="font-pixel mb-5 flex items-center gap-2.5 text-[9px] leading-none text-dust sm:text-[11px]">
          <span className="text-signal-deep" aria-hidden>
            &gt;
          </span>
          SELECT STAGE
        </h2>

        {/* `pixel-box` draws its frame in box-shadow, which takes no layout —
            hence the 4px margin, so the notched border has somewhere to land.
            It frames in hairline, which is the whole point here: an accent
            frame made this the lit thing on the page, and the lit thing on the
            page is the marquee. */}
        <div className="pixel-box m-1 bg-panel">
          <div className="flex flex-col gap-4 border-b-4 border-hairline p-4 sm:flex-row sm:items-center sm:p-5">
            <div className="min-w-0 flex-1">
              <p className="font-pixel mb-3 flex items-center gap-2 text-[7px] leading-none text-dust sm:text-[9px]">
                <span
                  className="inline-block h-1.5 w-1.5 bg-signal-deep"
                  aria-hidden
                />
                STAGE CLEARED &mdash; STILL LIVE
              </p>
              <h3 className="font-pixel text-[10px] leading-[1.6] text-bone sm:text-xs">
                CASUALYMPICS 2026
              </h3>
              <p className="mt-2.5 text-[11px] leading-relaxed text-dust/80 sm:text-xs">
                Still live at its original URLs — leaderboard, teams, rules,
                schedule and venue.
              </p>
            </div>
            {/* Outlined rather than filled. A solid accent button here was
                pulling the eye past the hero to the archive, which is exactly
                backwards; this is the same quiet control as the one in the
                header, and it goes solid on hover like the menu rows below. */}
            <Link
              href="/2026"
              className="pixel-press pixel-drop font-pixel inline-flex shrink-0 items-center justify-center gap-2 bg-void px-4 py-3 text-[9px] leading-none text-signal ring-2 ring-signal ring-inset hover:bg-signal hover:text-void"
            >
              CONTINUE
              <span aria-hidden>&gt;</span>
            </Link>
          </div>

          {/* The menu itself. Hover inverts the row the way a cabinet's
              highlight bar does, and the `>` is the cursor sitting next to
              whichever entry you're on.

              A bitmap face is exactly one em per character, so the longest
              label here costs a knowable 11em and the two-column layout has to
              be sized against it rather than guessed at: at a 320px viewport a
              column is ~142px, which leaves the label 8px per character and not
              a pixel more. Hence the smaller mobile step — and the cursor
              dropping out below `sm`, where it was spending its 16px on a hover
              state that a touch screen never enters anyway. */}
          <div className="grid grid-cols-2 gap-1 bg-hairline sm:grid-cols-3">
            {ARCHIVE_LINKS.map(({ href, label, sprite }) => (
              <Link
                key={href}
                href={href}
                className="group font-pixel flex items-center gap-2.5 bg-panel px-2.5 py-3.5 text-[8px] leading-[1.5] text-dust hover:bg-signal hover:text-void sm:gap-2.5 sm:px-3 sm:py-3 sm:text-[9px]"
              >
                <span
                  className="hidden w-1.5 shrink-0 text-signal opacity-0 group-hover:text-void group-hover:opacity-100 sm:inline-block"
                  aria-hidden
                >
                  &gt;
                </span>
                <PixelIcon
                  name={sprite}
                  className="h-3 w-3 shrink-0 text-dust/70 group-hover:text-void sm:h-3.5 sm:w-3.5"
                />
                <span className="min-w-0 break-words uppercase">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
