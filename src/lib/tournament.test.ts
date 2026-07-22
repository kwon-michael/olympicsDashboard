import { describe, it, expect } from "vitest";
import {
  assignGroupsInterleaved,
  assignGroupsSnake,
  groupRoundRobin,
  computeGroupStandings,
  groupStageComplete,
  computeQualifiers,
  bracketMatches,
  resolvedWildcard,
  resolvedQualifiers,
  loserOf,
  type GroupStanding,
} from "@/lib/tournament";
import { team, standing, groupMember, match } from "@/lib/test-fixtures";

// Nine teams in standings order (index 0 = 1st place).
const teams = Array.from({ length: 9 }, (_, i) =>
  team({ name: `T${i + 1}`, sort_order: i })
);
const standings = teams.map((t) => standing(t));

describe("assignGroupsInterleaved", () => {
  it("distributes 1,4,7→A / 2,5,8→B / 3,6,9→C with distinct seeds", () => {
    const groups = assignGroupsInterleaved(standings);
    const label = (seed: number) =>
      groups.find((g) => g.seed === seed)!.group_label;
    expect([1, 4, 7].map(label)).toEqual(["A", "A", "A"]);
    expect([2, 5, 8].map(label)).toEqual(["B", "B", "B"]);
    expect([3, 6, 9].map(label)).toEqual(["C", "C", "C"]);
    expect(groups.map((g) => g.seed)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});

describe("assignGroupsSnake", () => {
  it("distributes 1,6,7→A / 2,5,8→B / 3,4,9→C (rows alternate direction)", () => {
    const groups = assignGroupsSnake(standings);
    const label = (seed: number) =>
      groups.find((g) => g.seed === seed)!.group_label;
    expect([1, 6, 7].map(label)).toEqual(["A", "A", "A"]);
    expect([2, 5, 8].map(label)).toEqual(["B", "B", "B"]);
    expect([3, 4, 9].map(label)).toEqual(["C", "C", "C"]);
  });
});

describe("groupRoundRobin", () => {
  it("produces the three pairwise matchups for a group of three", () => {
    expect(groupRoundRobin(["x", "y", "z"])).toEqual([
      ["x", "y"],
      ["x", "z"],
      ["y", "z"],
    ]);
  });
});

describe("computeGroupStandings", () => {
  // Group A: three teams, seeds 1-3.
  const [t1, t2, t3] = teams;
  const members = [
    groupMember({ team_id: t1.id, group_label: "A", seed: 1 }),
    groupMember({ team_id: t2.id, group_label: "A", seed: 2 }),
    groupMember({ team_id: t3.id, group_label: "A", seed: 3 }),
  ];

  it("accumulates round wins from each played match and ranks desc", () => {
    const matches = [
      // t1 beats t2 2-1, t1 beats t3 2-0, t2 beats t3 2-1
      match({
        team_a: t1.id, team_b: t2.id, score_a: 2, score_b: 1, winner_id: t1.id,
      }),
      match({
        team_a: t1.id, team_b: t3.id, score_a: 2, score_b: 0, winner_id: t1.id,
      }),
      match({
        team_a: t2.id, team_b: t3.id, score_a: 2, score_b: 1, winner_id: t2.id,
      }),
    ];
    const groupA = computeGroupStandings(members, matches, teams).find(
      (g) => g.label === "A"
    )!;
    expect(groupA.teams.map((r) => [r.team.name, r.roundWins, r.rank])).toEqual([
      ["T1", 4, 1], // 2 + 2
      ["T2", 3, 2], // 1 + 2
      ["T3", 1, 3], // 0 + 1
    ]);
  });

  it("breaks equal round wins by seed", () => {
    const matches = [
      match({ team_a: t1.id, team_b: t2.id, score_a: 1, score_b: 1, winner_id: t1.id }),
      match({ team_a: t3.id, team_b: t1.id, score_a: 1, score_b: 1, winner_id: t3.id }),
      match({ team_a: t2.id, team_b: t3.id, score_a: 1, score_b: 1, winner_id: t2.id }),
    ];
    const groupA = computeGroupStandings(members, matches, teams).find(
      (g) => g.label === "A"
    )!;
    // All tied on 2 round wins → order falls back to seed 1,2,3.
    expect(groupA.teams.map((r) => r.team.name)).toEqual(["T1", "T2", "T3"]);
    expect(groupA.teams.every((r) => r.rank === 1)).toBe(true);
  });

  it("excludes tiebreaker matches from round-win totals", () => {
    const matches = [
      match({ team_a: t1.id, team_b: t2.id, score_a: 2, score_b: 0, winner_id: t1.id }),
      match({
        team_a: t1.id, team_b: t2.id, score_a: 5, score_b: 0,
        winner_id: t1.id, is_tiebreaker: true,
      }),
    ];
    const groupA = computeGroupStandings(members, matches, teams).find(
      (g) => g.label === "A"
    )!;
    const t1Row = groupA.teams.find((r) => r.team.name === "T1")!;
    expect(t1Row.roundWins).toBe(2); // tiebreaker's 5 is ignored
    expect(t1Row.matchesPlayed).toBe(1);
  });
});

describe("groupStageComplete", () => {
  it("is false until every non-tiebreaker group match has a winner", () => {
    const matches = [
      match({ winner_id: "x" }),
      match({ winner_id: null }),
    ];
    expect(groupStageComplete(matches)).toBe(false);
  });
  it("ignores tiebreaker matches and empty match lists", () => {
    expect(groupStageComplete([])).toBe(false);
    const matches = [
      match({ winner_id: "x" }),
      match({ winner_id: null, is_tiebreaker: true }),
    ];
    expect(groupStageComplete(matches)).toBe(true);
  });
});

describe("computeQualifiers", () => {
  // Build three groups, each with a clear winner and 2nd place.
  const [a1, a2, a3, b1, b2, b3, c1, c2, c3] = teams;

  function buildStandings(
    winsByTeamId: Record<string, number>
  ): GroupStanding[] {
    const members = [
      { label: "A" as const, rows: [a1, a2, a3] },
      { label: "B" as const, rows: [b1, b2, b3] },
      { label: "C" as const, rows: [c1, c2, c3] },
    ];
    return members.map(({ label, rows }, gi) => {
      const withWins = rows
        .map((t, i) => ({
          team: t,
          seed: gi * 3 + i + 1,
          roundWins: winsByTeamId[t.id] ?? 0,
          matchesPlayed: 2,
          rank: 0,
        }))
        .sort((x, y) => y.roundWins - x.roundWins || x.seed - y.seed);
      withWins.forEach((r, i) => {
        r.rank =
          i > 0 && r.roundWins === withWins[i - 1].roundWins
            ? withWins[i - 1].rank
            : i + 1;
      });
      return { label, teams: withWins };
    });
  }

  it("picks the three group winners and the best 2nd-place as wildcard", () => {
    const standings = buildStandings({
      [a1.id]: 4, [a2.id]: 3, [a3.id]: 0,
      [b1.id]: 4, [b2.id]: 2, [b3.id]: 0,
      [c1.id]: 4, [c2.id]: 1, [c3.id]: 0,
    });
    const q = computeQualifiers(standings);
    expect(q.groupWinners.map((t) => t.team.name)).toEqual(["T1", "T4", "T7"]);
    // Best 2nd place is a2 (3 wins).
    expect(q.wildcard?.team.name).toBe("T2");
    expect(q.wildcardTie).toHaveLength(0);
  });

  it("leaves the wildcard undecided when the top two 2nd-place teams tie", () => {
    const standings = buildStandings({
      [a1.id]: 4, [a2.id]: 3, [a3.id]: 0,
      [b1.id]: 4, [b2.id]: 3, [b3.id]: 0, // ties a2
      [c1.id]: 4, [c2.id]: 1, [c3.id]: 0,
    });
    const q = computeQualifiers(standings);
    expect(q.wildcard).toBeNull();
    expect(q.wildcardTie.map((t) => t.team.name).sort()).toEqual(["T2", "T5"]);
  });

  it("auto-resolves a tie when exactly one tied team has solo priority", () => {
    const standings = buildStandings({
      [a1.id]: 4, [a2.id]: 3, [a3.id]: 0,
      [b1.id]: 4, [b2.id]: 3, [b3.id]: 0,
      [c1.id]: 4, [c2.id]: 1, [c3.id]: 0,
    });
    const q = computeQualifiers(standings, new Set([b2.id]));
    expect(q.wildcard?.team.name).toBe("T5");
    expect(q.wildcardByPriority).toBe(true);
    expect(q.wildcardTie).toHaveLength(0);
  });

  it("keeps the tie manual when several tied teams share priority", () => {
    const standings = buildStandings({
      [a1.id]: 4, [a2.id]: 3, [a3.id]: 0,
      [b1.id]: 4, [b2.id]: 3, [b3.id]: 0,
      [c1.id]: 4, [c2.id]: 1, [c3.id]: 0,
    });
    const q = computeQualifiers(standings, new Set([a2.id, b2.id]));
    expect(q.wildcard).toBeNull();
    expect(q.wildcardTie.map((t) => t.team.name).sort()).toEqual(["T2", "T5"]);
    expect(q.wildcardByPriority).toBe(false);
  });
});

describe("resolvedWildcard / resolvedQualifiers", () => {
  const [a1, a2] = teams;
  const gt = (t = a1, over = {}) => ({
    team: t, seed: 1, roundWins: 2, matchesPlayed: 2, rank: 1, ...over,
  });

  it("returns the auto wildcard when there is no tie", () => {
    const q = {
      groupWinners: [gt(teams[0]), gt(teams[3]), gt(teams[6])],
      secondPlace: [],
      wildcard: gt(teams[1]),
      wildcardTie: [],
      wildcardByPriority: false,
    };
    expect(resolvedWildcard(q, null)?.team.name).toBe("T2");
    expect(resolvedQualifiers(q, null)).toHaveLength(4);
  });

  it("uses the admin's chosen team to break a tie", () => {
    const q = {
      groupWinners: [gt(teams[0]), gt(teams[3]), gt(teams[6])],
      secondPlace: [],
      wildcard: null,
      wildcardTie: [gt(a2, { team: a2 }), gt(teams[4], { team: teams[4] })],
      wildcardByPriority: false,
    };
    const state = {
      id: 1, groups_locked: true, bracket_seeded: false,
      wildcard_team_id: a2.id, updated_at: "",
    };
    expect(resolvedWildcard(q, state)?.team.id).toBe(a2.id);
    expect(resolvedQualifiers(q, state)).toHaveLength(4);
  });

  it("returns null while a tie is unresolved", () => {
    const q = {
      groupWinners: [gt(teams[0]), gt(teams[3]), gt(teams[6])],
      secondPlace: [],
      wildcard: null,
      wildcardTie: [gt(a2, { team: a2 }), gt(teams[4], { team: teams[4] })],
      wildcardByPriority: false,
    };
    expect(resolvedWildcard(q, null)).toBeNull();
    expect(resolvedQualifiers(q, null)).toBeNull();
  });
});

describe("bracketMatches", () => {
  it("splits semis (ordered by slot), final, and third", () => {
    const matches = [
      match({ stage: "final", slot: 0 }),
      match({ stage: "semi", slot: 2 }),
      match({ stage: "semi", slot: 1 }),
      match({ stage: "third", slot: 0 }),
    ];
    const view = bracketMatches(matches);
    expect(view.semis.map((m) => m.slot)).toEqual([1, 2]);
    expect(view.final?.stage).toBe("final");
    expect(view.third?.stage).toBe("third");
  });
});

describe("loserOf", () => {
  it("returns the non-winning side of a completed match", () => {
    expect(loserOf(match({ team_a: "x", team_b: "y", winner_id: "x" }))).toBe("y");
    expect(loserOf(match({ team_a: "x", team_b: "y", winner_id: "y" }))).toBe("x");
  });
  it("returns null when the match is unfinished or missing", () => {
    expect(loserOf(match({ team_a: "x", team_b: "y", winner_id: null }))).toBeNull();
    expect(loserOf(null)).toBeNull();
    expect(loserOf(undefined)).toBeNull();
  });
});
