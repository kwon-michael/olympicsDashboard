import { describe, it, expect } from "vitest";
import {
  teamKeyOf,
  findTieGroups,
  unresolvedTieGroups,
  inactiveTiebreaks,
  applyTiebreaks,
  type Tiebreak,
} from "@/lib/tiebreak";
import { computeTeamStandings } from "@/lib/roster";
import { team, score } from "@/lib/test-fixtures";

const a = team({ name: "A", sort_order: 0 });
const b = team({ name: "B", sort_order: 1 });
const c = team({ name: "C", sort_order: 2 });
const d = team({ name: "D", sort_order: 3 });
const teams = [a, b, c, d];

function tiebreak(overrides: Partial<Tiebreak> = {}): Tiebreak {
  const ids = overrides.team_ids ?? [a.id, b.id];
  return {
    id: "tb-1",
    board: "teams",
    tied_rank: 1,
    tied_points: 10,
    note: null,
    decided_by: null,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    ...overrides,
    // Derived from the ids in play, so a caller only ever passes team_ids.
    team_ids: ids,
    team_key: teamKeyOf(ids),
  };
}

/** Standings shorthand: [team, points] pairs turned into ranked rows. */
function standingsOf(pairs: [ReturnType<typeof team>, number][]) {
  return computeTeamStandings(
    teams,
    pairs.map(([t, points]) => score({ team_id: t.id, points }))
  ).filter((s) => pairs.some(([t]) => t.id === s.team.id));
}

describe("teamKeyOf", () => {
  it("is order independent", () => {
    expect(teamKeyOf(["z", "a", "m"])).toBe(teamKeyOf(["m", "z", "a"]));
  });
});

describe("findTieGroups", () => {
  it("finds a two-way tie inside the top 3", () => {
    const standings = standingsOf([
      [a, 10],
      [b, 10],
      [c, 4],
    ]);
    const groups = findTieGroups(standings, "teams", []);
    expect(groups).toHaveLength(1);
    expect(groups[0].rank).toBe(1);
    expect(groups[0].points).toBe(10);
    expect(groups[0].teams.map((t) => t.name)).toEqual(["A", "B"]);
    expect(groups[0].resolution).toBeNull();
  });

  it("finds an N-way tie regardless of how many teams are level", () => {
    const groups = findTieGroups(
      standingsOf([
        [a, 7],
        [b, 7],
        [c, 7],
        [d, 7],
      ]),
      "teams",
      []
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].teams).toHaveLength(4);
  });

  it("ignores ties below the top 3", () => {
    // A alone on 20; B/C/D all level on 2 → tie sits at rank 2, still counted.
    expect(
      findTieGroups(
        standingsOf([
          [a, 20],
          [b, 2],
          [c, 2],
          [d, 2],
        ]),
        "teams",
        []
      )
    ).toHaveLength(1);

    // Push the tie down to 4th: A, B, C clear above it.
    expect(
      findTieGroups(
        standingsOf([
          [a, 20],
          [b, 15],
          [c, 10],
          [d, 5],
        ]),
        "teams",
        []
      )
    ).toHaveLength(0);
  });

  it("ignores teams level on zero so a pre-event board is not one big tie", () => {
    const standings = computeTeamStandings(teams, []);
    expect(findTieGroups(standings, "teams", [])).toHaveLength(0);
  });

  it("attaches a resolution whose team set matches exactly", () => {
    const standings = standingsOf([
      [a, 10],
      [b, 10],
      [c, 4],
    ]);
    const groups = findTieGroups(standings, "teams", [
      tiebreak({ team_ids: [b.id, a.id] }),
    ]);
    expect(groups[0].resolution).not.toBeNull();
    expect(unresolvedTieGroups(standings, "teams", [])).toHaveLength(1);
    expect(
      unresolvedTieGroups(standings, "teams", [
        tiebreak({ team_ids: [b.id, a.id] }),
      ])
    ).toHaveLength(0);
  });

  it("does not match a resolution from a different board", () => {
    const standings = standingsOf([
      [a, 10],
      [b, 10],
    ]);
    const groups = findTieGroups(standings, "teams", [
      tiebreak({ team_ids: [a.id, b.id], board: "solo" }),
    ]);
    expect(groups[0].resolution).toBeNull();
  });

  it("stops matching once a third team joins the tie", () => {
    const two = tiebreak({ team_ids: [b.id, a.id] });
    const groups = findTieGroups(
      standingsOf([
        [a, 10],
        [b, 10],
        [c, 10],
      ]),
      "teams",
      [two]
    );
    expect(groups[0].teams).toHaveLength(3);
    expect(groups[0].resolution).toBeNull();
  });
});

describe("applyTiebreaks", () => {
  it("reorders a tied group and gives it sequential ranks", () => {
    const standings = standingsOf([
      [a, 10],
      [b, 10],
      [c, 10],
      [d, 4],
    ]);
    // Raw standings share rank 1; D follows at 4.
    expect(standings.map((s) => [s.team.name, s.rank])).toEqual([
      ["A", 1],
      ["B", 1],
      ["C", 1],
      ["D", 4],
    ]);

    const applied = applyTiebreaks(standings, "teams", [
      tiebreak({ team_ids: [c.id, a.id, b.id], note: "Coin toss" }),
    ]);
    expect(applied.map((s) => [s.team.name, s.rank])).toEqual([
      ["C", 1],
      ["A", 2],
      ["B", 3],
      ["D", 4], // unchanged: competition ranking already skipped 2 and 3
    ]);
  });

  it("leaves point totals untouched", () => {
    const standings = standingsOf([
      [a, 10],
      [b, 10],
    ]);
    const applied = applyTiebreaks(standings, "teams", [
      tiebreak({ team_ids: [b.id, a.id] }),
    ]);
    expect(applied.map((s) => s.totalPoints)).toEqual([10, 10]);
  });

  it("marks each resolved row with its finishing position", () => {
    const applied = applyTiebreaks(
      standingsOf([
        [a, 10],
        [b, 10],
      ]),
      "teams",
      [tiebreak({ team_ids: [b.id, a.id], note: "Sudden-death race" })]
    );
    expect(applied[0].tiebreak).toEqual({
      position: 1,
      of: 2,
      note: "Sudden-death race",
    });
    expect(applied[1].tiebreak?.position).toBe(2);
  });

  it("leaves unresolved ties sharing a rank and unmarked", () => {
    const applied = applyTiebreaks(
      standingsOf([
        [a, 10],
        [b, 10],
      ]),
      "teams",
      []
    );
    expect(applied.map((s) => s.rank)).toEqual([1, 1]);
    expect(applied.every((s) => s.tiebreak === undefined)).toBe(true);
  });

  it("does not mutate the input array", () => {
    const standings = standingsOf([
      [a, 10],
      [b, 10],
    ]);
    applyTiebreaks(standings, "teams", [tiebreak({ team_ids: [b.id, a.id] })]);
    expect(standings.map((s) => [s.team.name, s.rank])).toEqual([
      ["A", 1],
      ["B", 1],
    ]);
  });

  it("resolves a tie that is not at rank 1", () => {
    const applied = applyTiebreaks(
      standingsOf([
        [a, 20],
        [b, 8],
        [c, 8],
        [d, 3],
      ]),
      "teams",
      [tiebreak({ team_ids: [c.id, b.id], tied_rank: 2 })]
    );
    expect(applied.map((s) => [s.team.name, s.rank])).toEqual([
      ["A", 1],
      ["C", 2],
      ["B", 3],
      ["D", 4],
    ]);
  });

  it("still applies after both tied teams gain the same points", () => {
    // Recorded while level on 10; now level on 12. Same set → still applies.
    const applied = applyTiebreaks(
      standingsOf([
        [a, 12],
        [b, 12],
      ]),
      "teams",
      [tiebreak({ team_ids: [b.id, a.id], tied_points: 10 })]
    );
    expect(applied.map((s) => s.team.name)).toEqual(["B", "A"]);
  });

  it("has no effect once the teams are no longer level", () => {
    const applied = applyTiebreaks(
      standingsOf([
        [a, 12],
        [b, 10],
      ]),
      "teams",
      [tiebreak({ team_ids: [b.id, a.id] })]
    );
    expect(applied.map((s) => [s.team.name, s.rank])).toEqual([
      ["A", 1],
      ["B", 2],
    ]);
    expect(applied.every((s) => s.tiebreak === undefined)).toBe(true);
  });

  it("handles two separate ties on one board", () => {
    const e = team({ name: "E", sort_order: 4 });
    const all = [...teams, e];
    const standings = computeTeamStandings(all, [
      score({ team_id: a.id, points: 10 }),
      score({ team_id: b.id, points: 10 }),
      score({ team_id: c.id, points: 5 }),
      score({ team_id: d.id, points: 5 }),
      score({ team_id: e.id, points: 1 }),
    ]);
    const applied = applyTiebreaks(standings, "teams", [
      tiebreak({ id: "tb-1", team_ids: [b.id, a.id] }),
      tiebreak({ id: "tb-2", team_ids: [d.id, c.id] }),
    ]);
    expect(applied.map((s) => [s.team.name, s.rank])).toEqual([
      ["B", 1],
      ["A", 2],
      ["D", 3],
      ["C", 4],
      ["E", 5],
    ]);
  });
});

describe("inactiveTiebreaks", () => {
  it("flags stored rows that no longer match a live tie", () => {
    const standings = standingsOf([
      [a, 10],
      [b, 10],
    ]);
    const live = tiebreak({ id: "live", team_ids: [b.id, a.id] });
    const stale = tiebreak({ id: "stale", team_ids: [c.id, d.id] });
    const groups = findTieGroups(standings, "teams", [live, stale]);
    expect(inactiveTiebreaks([live, stale], groups).map((t) => t.id)).toEqual([
      "stale",
    ]);
  });
});
