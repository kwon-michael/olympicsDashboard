import { describe, expect, it } from "vitest";
import {
  DAY,
  GAME_DAY_TAIL,
  HOUR,
  MINUTE,
  SECOND,
  split,
  spokenRemaining,
  tierFor,
} from "@/lib/countdown";

describe("tierFor", () => {
  it("is quiet while the event is more than a week out", () => {
    expect(tierFor(30 * DAY)).toBe("far");
    expect(tierFor(7 * DAY + SECOND)).toBe("far");
  });

  it("steps up through the final week, day and hour", () => {
    expect(tierFor(7 * DAY)).toBe("week");
    expect(tierFor(2 * DAY)).toBe("week");
    expect(tierFor(DAY)).toBe("day");
    expect(tierFor(90 * MINUTE)).toBe("day");
    expect(tierFor(HOUR)).toBe("hour");
    expect(tierFor(30 * SECOND)).toBe("hour");
  });

  it("is live from the ceremony until the day is over", () => {
    expect(tierFor(0)).toBe("live");
    expect(tierFor(-HOUR)).toBe("live");
    // The last moment that still counts as game day.
    expect(tierFor(-GAME_DAY_TAIL + SECOND)).toBe("live");
  });

  it("archives the event once game day has run out", () => {
    // The bug this exists to prevent: the old clock had no tier past `live`, so
    // a finished Casualympics kept announcing "game day is here" forever.
    expect(tierFor(-GAME_DAY_TAIL)).toBe("archived");
    expect(tierFor(-2 * DAY)).toBe("archived");
    expect(tierFor(-365 * DAY)).toBe("archived");
  });
});

describe("split", () => {
  it("breaks a remaining time into display units", () => {
    expect(split(2 * DAY + 3 * HOUR + 4 * MINUTE + 5 * SECOND)).toEqual({
      days: 2,
      hours: 3,
      minutes: 4,
      seconds: 5,
    });
  });

  it("empties the leading units as the event closes in", () => {
    expect(split(45 * SECOND)).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 45,
    });
  });
});

describe("spokenRemaining", () => {
  it("speaks only the largest unit that still has a value", () => {
    expect(spokenRemaining(split(3 * DAY + 5 * HOUR))).toBe("3 days");
    expect(spokenRemaining(split(5 * HOUR + 20 * MINUTE))).toBe("5 hours");
    expect(spokenRemaining(split(12 * MINUTE))).toBe("12 minutes");
  });

  it("says one of a thing rather than 1 things", () => {
    expect(spokenRemaining(split(DAY + HOUR))).toBe("1 day");
    expect(spokenRemaining(split(MINUTE))).toBe("1 minute");
  });

  it("falls back to seconds when everything is empty", () => {
    expect(spokenRemaining(split(0))).toBe("0 seconds");
  });
});
