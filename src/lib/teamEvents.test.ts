import { describe, it, expect } from "vitest";
import {
  recorderTeamEvents,
  computeRelayStandings,
  TOURNAMENT_TEAM_EVENT_SLUGS,
} from "@/lib/teamEvents";
import { computeTeamComponentValue, getEventBySlug } from "@/lib/events";

describe("recorderTeamEvents", () => {
  it("includes the two non-tournament team events and excludes the bracketed ones", () => {
    const slugs = recorderTeamEvents.map((e) => e.slug);
    expect(slugs).toContain("tail-grab");
    expect(slugs).toContain("conditioned-relay");
    for (const excluded of TOURNAMENT_TEAM_EVENT_SLUGS) {
      expect(slugs).not.toContain(excluded);
    }
  });
});

describe("computeRelayStandings", () => {
  const scale = [15, 12, 10, 8, 6, 5, 3, 2, 1];

  it("ranks fastest-first and awards points from the scale", () => {
    const standings = computeRelayStandings(
      [
        { teamId: "a", timeCs: 9000 },
        { teamId: "b", timeCs: 8000 },
        { teamId: "c", timeCs: 10000 },
      ],
      scale
    );
    const byTeam = new Map(standings.map((s) => [s.teamId, s]));
    expect(byTeam.get("b")).toMatchObject({ rank: 1, points: 15 });
    expect(byTeam.get("a")).toMatchObject({ rank: 2, points: 12 });
    expect(byTeam.get("c")).toMatchObject({ rank: 3, points: 10 });
  });

  it("shares the placement on a tie and skips the one below", () => {
    const standings = computeRelayStandings(
      [
        { teamId: "a", timeCs: 8000 },
        { teamId: "b", timeCs: 8000 },
        { teamId: "c", timeCs: 9000 },
      ],
      scale
    );
    const byTeam = new Map(standings.map((s) => [s.teamId, s]));
    expect(byTeam.get("a")).toMatchObject({ rank: 1, points: 15 });
    expect(byTeam.get("b")).toMatchObject({ rank: 1, points: 15 });
    expect(byTeam.get("c")).toMatchObject({ rank: 3, points: 10 }); // 2nd skipped
  });

  it("awards 0 beyond the length of the scale", () => {
    const entries = Array.from({ length: 10 }, (_, i) => ({
      teamId: `t${i}`,
      timeCs: 1000 + i,
    }));
    const standings = computeRelayStandings(entries, scale);
    expect(standings.find((s) => s.teamId === "t9")).toMatchObject({
      rank: 10,
      points: 0,
    });
  });
});

describe("computeTeamComponentValue for Tail Grab", () => {
  const components = getEventBySlug("tail-grab")!.teamScoring!.components!;

  it("sums round placements and tails (round 2 tails worth double)", () => {
    // R1: 1st (5) + 3 tails (3) ; R2: 2nd (3) + 4 tails ×2 (8) = 19
    const value = computeTeamComponentValue(components, {
      r1Placement: "1",
      r1Tails: "3",
      r2Placement: "2",
      r2Tails: "4",
    });
    expect(value).toBe(19);
  });

  it("treats blank inputs as zero", () => {
    const value = computeTeamComponentValue(components, {
      r1Placement: "1",
      r1Tails: "",
      r2Placement: "",
      r2Tails: "",
    });
    expect(value).toBe(5);
  });
});
