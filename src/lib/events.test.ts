import { describe, it, expect } from "vitest";
import {
  parseInputToDbValue,
  formatDbValue,
  getUnitLabel,
  getSoloPlacementPoints,
  getRelayPlacementPoints,
  computeTeamComponentValue,
  getScoringInputBySlug,
  teamEvents,
  type TeamScoreComponent,
} from "@/lib/events";

describe("parseInputToDbValue", () => {
  describe("time → centiseconds", () => {
    it("parses bare seconds", () => {
      expect(parseInputToDbValue("12.34", "time")).toBe(1234);
    });
    it("parses mm:ss", () => {
      expect(parseInputToDbValue("1:23.45", "time")).toBe(8345); // 83.45s
    });
    it("rounds to the nearest centisecond", () => {
      expect(parseInputToDbValue("10.006", "time")).toBe(1001);
    });
    it("rejects zero, negative, and garbage", () => {
      expect(parseInputToDbValue("0", "time")).toBeNull();
      expect(parseInputToDbValue("-5", "time")).toBeNull();
      expect(parseInputToDbValue("abc", "time")).toBeNull();
      expect(parseInputToDbValue("1:2:3", "time")).toBeNull();
      expect(parseInputToDbValue("1:xx", "time")).toBeNull();
    });
  });

  describe("distance → centimeters", () => {
    it("parses meters", () => {
      expect(parseInputToDbValue("3.45", "distance")).toBe(345);
    });
    it("rejects zero, negative, and garbage", () => {
      expect(parseInputToDbValue("0", "distance")).toBeNull();
      expect(parseInputToDbValue("-1", "distance")).toBeNull();
      expect(parseInputToDbValue("", "distance")).toBeNull();
    });
  });

  describe("points → integer", () => {
    it("rounds to an integer and allows zero", () => {
      expect(parseInputToDbValue("7", "points")).toBe(7);
      expect(parseInputToDbValue("0", "points")).toBe(0);
      expect(parseInputToDbValue("4.6", "points")).toBe(5);
    });
    it("rejects negatives and garbage", () => {
      expect(parseInputToDbValue("-1", "points")).toBeNull();
      expect(parseInputToDbValue("x", "points")).toBeNull();
    });
  });
});

describe("formatDbValue", () => {
  it("formats sub-minute times as seconds", () => {
    expect(formatDbValue(1234, "time")).toBe("12.34s");
  });
  it("formats times ≥ 60s as m:ss.cc with zero-padding", () => {
    expect(formatDbValue(8345, "time")).toBe("1:23.45");
    expect(formatDbValue(6005, "time")).toBe("1:00.05");
  });
  it("formats distance in meters", () => {
    expect(formatDbValue(345, "distance")).toBe("3.45m");
  });
  it("passes points through", () => {
    expect(formatDbValue(9, "points")).toBe("9");
  });
});

describe("parse ↔ format round-trip", () => {
  it("time survives a round-trip", () => {
    const db = parseInputToDbValue("1:23.45", "time")!;
    expect(formatDbValue(db, "time")).toBe("1:23.45");
  });
  it("distance survives a round-trip", () => {
    const db = parseInputToDbValue("3.45", "distance")!;
    expect(formatDbValue(db, "distance")).toBe("3.45m");
  });
});

describe("getUnitLabel", () => {
  it("labels each mode", () => {
    expect(getUnitLabel("time")).toBe("Time");
    expect(getUnitLabel("distance")).toBe("Distance");
    expect(getUnitLabel("points")).toBe("Points");
  });
});

describe("getSoloPlacementPoints", () => {
  it("awards 7/5/3/2/1 for places 1–5", () => {
    expect([1, 2, 3, 4, 5].map(getSoloPlacementPoints)).toEqual([7, 5, 3, 2, 1]);
  });
  it("awards 0 for 6th and beyond", () => {
    expect(getSoloPlacementPoints(6)).toBe(0);
    expect(getSoloPlacementPoints(99)).toBe(0);
  });
});

describe("getRelayPlacementPoints", () => {
  it("awards the full 9-deep scale", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map(getRelayPlacementPoints)).toEqual([
      15, 12, 10, 8, 6, 5, 3, 2, 1,
    ]);
  });
  it("awards 0 below the scale", () => {
    expect(getRelayPlacementPoints(10)).toBe(0);
    expect(getRelayPlacementPoints(0)).toBe(0);
  });
});

describe("computeTeamComponentValue", () => {
  const components: TeamScoreComponent[] = [
    {
      key: "placement",
      label: "Placement",
      kind: "placement",
      placementPoints: [5, 3, 2, 1],
    },
    { key: "wins", label: "Round Wins", kind: "tally", pointsEach: 1 },
    { key: "elims", label: "Eliminations (×2)", kind: "tally", pointsEach: 2 },
  ];

  it("sums placement + tallies", () => {
    // 1st place (5) + 2 wins (2) + 3 elims × 2 (6) = 13
    expect(
      computeTeamComponentValue(components, {
        placement: "1",
        wins: "2",
        elims: "3",
      })
    ).toBe(13);
  });

  it("treats blank and invalid inputs as zero", () => {
    expect(
      computeTeamComponentValue(components, {
        placement: "",
        wins: "abc",
        elims: "  ",
      })
    ).toBe(0);
  });

  it("scores an out-of-range placement as zero", () => {
    expect(computeTeamComponentValue(components, { placement: "9" })).toBe(0);
  });

  it("ignores negative tallies", () => {
    expect(computeTeamComponentValue(components, { wins: "-4" })).toBe(0);
  });

  it("matches the real Tug of War config (placement + round wins)", () => {
    const tug = teamEvents.find((e) => e.slug === "tug-of-war")!;
    const value = computeTeamComponentValue(tug.teamScoring!.components!, {
      placement: "1",
      roundWins: "6",
    });
    expect(value).toBe(5 + 6);
  });
});

describe("getScoringInputBySlug", () => {
  it("resolves known event slugs", () => {
    expect(getScoringInputBySlug("100m")).toBe("time");
    expect(getScoringInputBySlug("standing-long-jump")).toBe("distance");
    expect(getScoringInputBySlug("garbage-basketball")).toBe("points");
  });
  it("falls back to points for unknown slugs", () => {
    expect(getScoringInputBySlug("does-not-exist")).toBe("points");
  });
});
