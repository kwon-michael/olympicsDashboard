import { describe, it, expect } from "vitest";
import {
  computeTournamentPoints,
  tournamentPlacements,
  totalsByTeam,
} from "@/lib/tournamentPoints";
import { match } from "@/lib/test-fixtures";

const A = "team-a";
const B = "team-b";
const C = "team-c";
const D = "team-d";

/** A finished group match: `a` beat `b` by the given rounds. */
function played(
  a: string,
  b: string,
  roundsA: number,
  roundsB: number,
  overrides: Parameters<typeof match>[0] = {}
) {
  return match({
    team_a: a,
    team_b: b,
    score_a: roundsA,
    score_b: roundsB,
    winner_id: roundsA > roundsB ? a : b,
    ...overrides,
  });
}

/** The full four-team bracket, A beating B in the final, C beating D for 3rd. */
const finishedBracket = [
  played(A, B, 1, 0, { stage: "final", group_label: null }),
  played(C, D, 1, 0, { stage: "third", group_label: null }),
];

function pointsFor(matches: Parameters<typeof computeTournamentPoints>[0]) {
  return (teamId: string) => computeTournamentPoints(matches).get(teamId);
}

describe("tournamentPlacements", () => {
  it("reads 1st/2nd off the final and 3rd/4th off the third-place match", () => {
    const places = tournamentPlacements(finishedBracket);
    expect(places.get(A)).toBe(1);
    expect(places.get(B)).toBe(2);
    expect(places.get(C)).toBe(3);
    expect(places.get(D)).toBe(4);
  });

  it("leaves everyone unplaced while the bracket is unfinished", () => {
    const places = tournamentPlacements([
      match({ stage: "final", group_label: null, team_a: A, team_b: B }),
    ]);
    expect(places.size).toBe(0);
  });

  it("places the 3rd-place match independently of the final", () => {
    const places = tournamentPlacements([
      match({ stage: "final", group_label: null, team_a: A, team_b: B }),
      played(C, D, 1, 0, { stage: "third", group_label: null }),
    ]);
    expect(places.get(C)).toBe(3);
    expect(places.get(D)).toBe(4);
    expect(places.has(A)).toBe(false);
  });
});

describe("computeTournamentPoints — round wins", () => {
  it("gives a point per round won", () => {
    const points = pointsFor([played(A, B, 2, 1)]);
    expect(points(A)).toMatchObject({ roundWins: 2, roundWinPoints: 2, total: 2 });
    expect(points(B)).toMatchObject({ roundWins: 1, roundWinPoints: 1, total: 1 });
  });

  it("accumulates across every match a team played", () => {
    const points = pointsFor([
      played(A, B, 2, 0),
      played(A, C, 2, 1),
      played(B, C, 1, 2),
    ]);
    expect(points(A)!.roundWins).toBe(4);
    expect(points(B)!.roundWins).toBe(1);
    expect(points(C)!.roundWins).toBe(3);
  });

  it("ignores a scoreline entered before the match has a winner", () => {
    const points = pointsFor([
      match({ team_a: A, team_b: B, score_a: 2, score_b: 0, winner_id: null }),
    ]);
    expect(points(A)!.roundWins).toBe(0);
  });

  it("excludes tiebreaker matches, which only decide placement", () => {
    const points = pointsFor([
      played(A, B, 2, 0),
      played(A, B, 1, 0, { is_tiebreaker: true }),
    ]);
    expect(points(A)!.roundWins).toBe(2);
  });
});

describe("computeTournamentPoints — placement", () => {
  it("pays 5/3/2/1 for 1st through 4th", () => {
    const points = pointsFor(finishedBracket);
    expect(points(A)).toMatchObject({ placement: 1, placementPoints: 5 });
    expect(points(B)).toMatchObject({ placement: 2, placementPoints: 3 });
    expect(points(C)).toMatchObject({ placement: 3, placementPoints: 2 });
    expect(points(D)).toMatchObject({ placement: 4, placementPoints: 1 });
  });

  it("adds placement on top of the round wins earned getting there", () => {
    const points = pointsFor([played(A, B, 2, 1), ...finishedBracket]);
    // 2 group rounds + 1 in the final = 3 round wins, plus 5 for winning.
    expect(points(A)).toMatchObject({ roundWins: 3, total: 8 });
  });

  it("pays nothing for placement while the bracket is unfinished", () => {
    const points = pointsFor([played(A, B, 2, 1)]);
    expect(points(A)).toMatchObject({ placement: null, placementPoints: 0 });
  });
});

describe("computeTournamentPoints — eliminations", () => {
  // Teams of 6. A's eliminations come from B's survivor counts, and vice versa.
  //   A: (6-1) + (6-4) [vs B] + (6-2) + (6-5) [vs C] = 5 + 2 + 4 + 1 = 12
  //   B: (6-4) + (6-6) = 2 + 0 = 2
  const matches = [
    played(A, B, 2, 1, { survivors_a: [4, 6, null], survivors_b: [1, 4, null] }),
    played(A, C, 2, 0, { survivors_a: [5, 5], survivors_b: [2, 5] }),
  ];

  it("derives a point per opponent left un-alive at the end of a round", () => {
    const points = computeTournamentPoints(matches, { eliminations: true });
    expect(points.get(A)).toMatchObject({
      eliminations: 12,
      eliminationPoints: 12,
      roundWins: 4,
      total: 16,
    });
    expect(points.get(B)).toMatchObject({ eliminations: 2, total: 3 });
  });

  it("ignores them entirely when the tournament doesn't count them (Tug of War)", () => {
    const points = computeTournamentPoints(matches);
    expect(points.get(A)).toMatchObject({
      eliminations: 0,
      eliminationPoints: 0,
      total: 4,
    });
  });

  it("counts survivors recorded before the result is in", () => {
    const points = computeTournamentPoints(
      [match({ team_a: A, team_b: B, survivors_b: [3] })],
      { eliminations: true }
    );
    expect(points.get(A)).toMatchObject({
      eliminations: 3,
      roundWins: 0,
      total: 3,
    });
  });

  it("skips rounds left uncounted rather than reading them as a wipeout", () => {
    const points = computeTournamentPoints(
      [played(A, B, 2, 0, { survivors_b: [2, null] })],
      { eliminations: true }
    );
    // Only the counted round pays out: 6 - 2 = 4, not 4 + 6.
    expect(points.get(A)!.eliminations).toBe(4);
  });

  it("treats a match with no tally at all as zero", () => {
    const points = computeTournamentPoints([played(A, B, 2, 0)], {
      eliminations: true,
    });
    expect(points.get(A)!.eliminations).toBe(0);
  });

  it("counts a full wipeout as the whole team", () => {
    const points = computeTournamentPoints(
      [played(A, B, 1, 0, { survivors_b: [0] })],
      { eliminations: true }
    );
    expect(points.get(A)!.eliminations).toBe(6);
  });

  it("measures a short-handed team against the size it actually fielded", () => {
    const options = {
      eliminations: true,
      teamSizes: new Map([[B, 4]]),
    };
    const points = computeTournamentPoints(
      [played(A, B, 1, 0, { survivors_b: [1] })],
      options
    );
    // 4 fielded, 1 alive → 3 out, not the 5 a default team of six would imply.
    expect(points.get(A)!.eliminations).toBe(3);
  });

  it("never reads more survivors than a team has as negative eliminations", () => {
    const points = computeTournamentPoints(
      [played(A, B, 1, 0, { survivors_b: [9] })],
      { eliminations: true }
    );
    expect(points.get(A)!.eliminations).toBe(0);
  });
});

describe("computeTournamentPoints — teams with no result", () => {
  it("omits a team that hasn't appeared in a match", () => {
    expect(computeTournamentPoints([played(A, B, 2, 0)]).has(C)).toBe(false);
  });

  it("includes a team scheduled but not yet played, on zero", () => {
    const points = computeTournamentPoints([match({ team_a: A, team_b: B })]);
    expect(points.get(A)).toMatchObject({ roundWins: 0, total: 0 });
  });
});

describe("totalsByTeam", () => {
  it("adds a team's two tournaments together", () => {
    const tug = computeTournamentPoints([played(A, B, 2, 1)]);
    const dodgeball = computeTournamentPoints(
      [played(A, C, 2, 0, { survivors_a: [5, 5], survivors_b: [3, 3] })],
      { eliminations: true }
    );
    const totals = totalsByTeam(tug, dodgeball);
    // A: 2 tug round wins + 2 dodgeball round wins + (6-3) + (6-3) eliminations.
    expect(totals.get(A)).toBe(2 + 2 + 6);
    // B only played the tug match, and only its round win counts there.
    expect(totals.get(B)).toBe(1);
    // C lost 2-0 but still put two of A's players out.
    expect(totals.get(C)).toBe(0 + 2);
  });
});
