// ============================================
// Countdown arithmetic
// ============================================
// The pure half of the 2026 hero clock (see components/countdown.tsx): how far
// off the event is, which tier that puts the page in, and how to say the
// remaining time out loud. No React, no DOM — the component owns the rendering
// and this owns the reckoning, which is the part worth testing.
//
// Note the *two* past tiers. There is a real difference between the event being
// under way and the event being over, and the page had no way to say the second
// one: once the clock ran out it declared "game day is here" and went on
// declaring it, indefinitely. `archived` is where a finished Casualympics ends
// up. The countdown to the *next* one lives on the new front door and is
// deliberately not a clock at all — see components/v2/split-flap.tsx.

/** The 2026 opening ceremony — the moment the hero clock counts down to. */
export const EVENT_TIME = new Date("2026-08-08T10:00:00").getTime();

export const SECOND = 1_000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/**
 * How long "game day is here" holds after the ceremony starts: the whole day
 * and the evening it runs into. Past that the event is over and the page says
 * so instead of shouting about a day that has been and gone.
 */
export const GAME_DAY_TAIL = 16 * HOUR;

/**
 * How close the event is, and therefore how loud the clock gets. The tiers are
 * deliberately coarse: the point is that the page looks *different* the week of
 * — a visitor should feel the change without reading a number — rather than
 * creeping up by an imperceptible amount every hour.
 */
export type Tier = "far" | "week" | "day" | "hour" | "live" | "archived";

export type UnitKey = "days" | "hours" | "minutes" | "seconds";

export const ALL_UNITS: UnitKey[] = ["days", "hours", "minutes", "seconds"];

/**
 * The tier for a signed distance to the ceremony. `remaining` counts down
 * through zero and keeps going negative, which is what separates the day itself
 * (`live`) from everything after it (`archived`).
 */
export function tierFor(remaining: number): Tier {
  if (remaining <= -GAME_DAY_TAIL) return "archived";
  if (remaining <= 0) return "live";
  if (remaining <= HOUR) return "hour";
  if (remaining <= DAY) return "day";
  if (remaining <= 7 * DAY) return "week";
  return "far";
}

/** Break a positive remaining time into the units the clock displays. */
export function split(remaining: number): Record<UnitKey, number> {
  return {
    days: Math.floor(remaining / DAY),
    hours: Math.floor((remaining % DAY) / HOUR),
    minutes: Math.floor((remaining % HOUR) / MINUTE),
    seconds: Math.floor((remaining % MINUTE) / SECOND),
  };
}

/** "3 days", "4 hours", "12 minutes" — the coarse version, for screen readers. */
export function spokenRemaining(parts: Record<UnitKey, number>): string {
  const lead = ALL_UNITS.find((u) => parts[u] > 0) ?? "seconds";
  const n = parts[lead];
  const noun = lead === "minutes" ? "minute" : lead.replace(/s$/, "");
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}
