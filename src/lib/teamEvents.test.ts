import { describe, it, expect } from "vitest";
import {
  recorderTeamEvents,
  recorderScoreLabel,
  computeRelayStandings,
  computeTeamEventStandings,
  TOURNAMENT_TEAM_EVENT_SLUGS,
} from "@/lib/teamEvents";
import { computeTeamComponentValue, getEventBySlug } from "@/lib/events";
import { team, score } from "@/lib/test-fixtures";

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

describe("computeTeamEventStandings", () => {
  const tailGrab = getEventBySlug("tail-grab")!;
  const relay = getEventBySlug("conditioned-relay")!;
  const a = team({ name: "A", sort_order: 0 });
  const b = team({ name: "B", sort_order: 1 });
  const c = team({ name: "C", sort_order: 2 });
  const teams = [a, b, c];

  /** A row as the team-event recorder writes it: label = the event's name. */
  const result = (
    event: typeof tailGrab,
    teamId: string,
    points: number,
    metadata: Record<string, unknown>
  ) =>
    score({
      team_id: teamId,
      label: recorderScoreLabel(event),
      points,
      metadata,
    });

  it("ranks a component event by points and breaks the total down per component", () => {
    const rows = computeTeamEventStandings(tailGrab, teams, [
      result(tailGrab, a.id, 8, { r1Placement: "2", r1Tails: "5" }),
      result(tailGrab, b.id, 19, {
        r1Placement: "1",
        r1Tails: "3",
        r2Placement: "2",
        r2Tails: "4",
      }),
    ]);
    expect(rows.map((r) => [r.team.name, r.rank, r.points])).toEqual([
      ["B", 1, 19],
      ["A", 2, 8],
    ]);
    // Round 2 tails are worth double, and unrecorded components read as a dash.
    expect(rows[0].components.map((x) => [x.display, x.points])).toEqual([
      ["1st", 5],
      ["3", 3],
      ["2nd", 3],
      ["4", 8],
    ]);
    expect(rows[1].components.map((x) => x.display)).toEqual([
      "2nd",
      "5",
      "—",
      "—",
    ]);
  });

  it("ranks a timed event fastest-first and formats the recorded time", () => {
    const rows = computeTeamEventStandings(relay, teams, [
      result(relay, a.id, 12, { timeRaw: "1:24.55", timeCs: 8455 }),
      result(relay, b.id, 15, { timeRaw: "1:22.10", timeCs: 8210 }),
    ]);
    expect(rows.map((r) => [r.team.name, r.rank, r.time, r.points])).toEqual([
      ["B", 1, "1:22.10", 15],
      ["A", 2, "1:24.55", 12],
    ]);
  });

  it("shares a place on a tie and skips the one below", () => {
    const rows = computeTeamEventStandings(relay, teams, [
      result(relay, a.id, 15, { timeCs: 8000 }),
      result(relay, b.id, 15, { timeCs: 8000 }),
      result(relay, c.id, 10, { timeCs: 9000 }),
    ]);
    expect(rows.map((r) => r.rank)).toEqual([1, 1, 3]);
  });

  it("includes only teams with a recorded result, ignoring other labels", () => {
    const rows = computeTeamEventStandings(tailGrab, teams, [
      result(tailGrab, a.id, 5, { r1Placement: "1" }),
      score({ team_id: b.id, label: "Manual bonus", points: 99 }),
    ]);
    expect(rows.map((r) => r.team.name)).toEqual(["A"]);
  });

  it("reports the stored points rather than recomputing them", () => {
    // The stored value is what feeds the team total, so the board must agree
    // with it even if it drifts from the raw inputs.
    const rows = computeTeamEventStandings(tailGrab, teams, [
      result(tailGrab, a.id, 4, { r1Placement: "1" }),
    ]);
    expect(rows[0].points).toBe(4);
    expect(rows[0].components[0].points).toBe(5);
  });
});
