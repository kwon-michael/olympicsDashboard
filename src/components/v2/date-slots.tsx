// ============================================
// Date slots — the opening ceremony, entered
// ============================================
// The date, one character to a cell, grouped the way a date is read: day,
// month, year. The cells are the cabinet's own furniture — a black panel in a
// hairline bezel, lit from inside, behind the same glass as everything else on
// the screen.
//
// This began as an empty field with a cursor waiting in the first cell, because
// there was no date to show. There is one now, so the field is filled in and
// the cursor is gone: a caret parked next to a value that is already entered is
// a machine waiting for something nobody is going to type.
//
// The day/month/year captions went with the cursor. They were there to make an
// empty row of boxes legible, and `03 JAN 2027` does not need to be told which
// end is the year. The weekday took their place, which is the one thing the
// date itself doesn't say and the first thing anybody asks.
//
// No state, no client component, no timers.

export interface DateSlotsProps {
  /**
   * The date, already split for display: one group per run of cells, in
   * reading order. Each character gets its own cell, so `["03", "JAN",
   * "2027"]` is nine cells in three groups.
   */
  groups: string[];
  /** The line under the date — the weekday. */
  caption: string;
  /**
   * What the block says to a screen reader. The cells are hidden from it:
   * announced one character at a time, a date in nine boxes is nine
   * meaningless letters.
   */
  label: string;
}

export function DateSlots({ groups, caption, label }: DateSlotsProps) {
  return (
    <div>
      <div aria-hidden>
        <div className="flex items-start justify-center gap-3 sm:gap-5">
          {groups.map((group) => (
            <div key={group} className="flex gap-1 sm:gap-1.5">
              {[...group].map((char, i) => (
                <span
                  key={`${char}${i}`}
                  className="pixel-slot pixel-glow font-pixel flex h-9 w-6 items-center justify-center text-sm leading-none text-signal sm:h-14 sm:w-10 sm:text-2xl"
                >
                  {char}
                </span>
              ))}
            </div>
          ))}
        </div>

        <p className="font-pixel mt-4 text-center text-[8px] leading-none text-dust sm:mt-5 sm:text-[10px]">
          {caption}
        </p>
      </div>

      <span className="sr-only">{label}</span>
    </div>
  );
}
