import { describe, it, expect } from "vitest";
import { computeStandings } from "@/lib/standings";
import { teamKeyOf, type Tiebreak } from "@/lib/tiebreak";
import { team, solo as soloResult, score, match } from "@/lib/test-fixtures";
import { eventIsAscending } from "@/lib/solo";

// Four teams; solo placement points are 7/5/3/2/1 by finishing order.
const a = team({ name: "A", sort_order: 0 });
const b = team({ name: "B", sort_order: 1 });
const c = team({ name: "C", sort_order: 2 });
const d = team({ name: "D", sort_order: 3 });
const teams = [a, b, c, d];

// A distance event, so a bigger value is a better result and the fixtures below
// read naturally. Asserted rather than assumed — if this ever became a timed
// event the expectations here would silently invert.
const EVENT = "standing-long-jump";

function tiebreak(
  board: "teams" | "solo",
  orderedIds: string[],
  note: string | null = null
): Tiebreak {
  return {
    id: `tb-${board}-${orderedIds.join("-")}`,
    board,
    team_key: teamKeyOf(orderedIds),
    team_ids: orderedIds,
    tied_rank: 1,
    tied_points: 0,
    note,
    decided_by: null,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
  };
}

/** Give each team a solo result in one event, so the board is fully ordered. */
function soloValues(values: [ReturnType<typeof team>, number][]) {
  return values.map(([t, value]) =>
    soloResult({ event_slug: EVENT, team_id: t.id, value })
  );
}

function bonusFor(
  standings: ReturnType<typeof computeStandings>,
  t: ReturnType<typeof team>
) {
  return standings.teams.find((s) => s.team.id === t.id)!.bonusPoints;
}

describe("test setup", () => {
  it("uses an event where a higher value is the better result", () => {
    expect(eventIsAscending(EVENT)).toBe(false);
  });
});

describe("computeStandings — solo top 3 after a tiebreak", () => {
  // A clear 1st and 2nd, then B/C/D all level on the same distance → they tie
  // for 3rd and, pre-tiebreak, all three count as top 3.
  const threeWayTieForThird = soloValues([
    [a, 900],
    [b, 300],
    [c, 300],
    [d, 300],
  ]);

  it("gives every tied team the bonus while the tie is unsettled", () => {
    const s = computeStandings(teams, [], threeWayTieForThird, []);
    const top3 = s.solo.filter((r) => r.isTop3).map((r) => r.team.name);
    // A is 1st; B, C, D share 2nd — all four are inside the top 3 places.
    expect(top3.sort()).toEqual(["A", "B", "C", "D"]);
    expect(bonusFor(s, d)).toBe(1);
  });

  it("narrows the bonus to exactly three teams once the tie is settled", () => {
    const s = computeStandings(teams, [], threeWayTieForThird, [
      // External game ordered them C, then B, then D.
      tiebreak("solo", [c.id, b.id, d.id], "Coin toss"),
    ]);

    expect(s.solo.map((r) => [r.team.name, r.rank])).toEqual([
      ["A", 1],
      ["C", 2],
      ["B", 3],
      ["D", 4],
    ]);

    const top3 = s.solo.filter((r) => r.isTop3).map((r) => r.team.name);
    expect(top3).toEqual(["A", "C", "B"]);

    // D lost the tiebreak, so it is outside the top 3 and earns nothing.
    expect(bonusFor(s, d)).toBe(0);
    expect(bonusFor(s, a)).toBe(1);
    expect(bonusFor(s, b)).toBe(1);
    expect(bonusFor(s, c)).toBe(1);
  });

  it("keeps the losing team's solo points intact — only the bonus is withheld", () => {
    const s = computeStandings(teams, [], threeWayTieForThird, [
      tiebreak("solo", [c.id, b.id, d.id]),
    ]);
    const rowD = s.solo.find((r) => r.team.id === d.id)!;
    const rowB = s.solo.find((r) => r.team.id === b.id)!;
    // Still level on solo placement points; only isTop3 and the bonus differ.
    expect(rowD.totalPoints).toBe(rowB.totalPoints);
    expect(rowD.isTop3).toBe(false);
    expect(rowB.isTop3).toBe(true);
  });

  it("removes the withheld bonus from the team leaderboard total", () => {
    // Every team has 10 team-event points, so the bonus is the only difference.
    const scores = teams.map((t) => score({ team_id: t.id, points: 10 }));

    const unsettled = computeStandings(teams, scores, threeWayTieForThird, []);
    expect(
      unsettled.teams.find((s) => s.team.id === d.id)!.totalPoints
    ).toBe(11);

    const settled = computeStandings(teams, scores, threeWayTieForThird, [
      tiebreak("solo", [c.id, b.id, d.id]),
    ]);
    const rowD = settled.teams.find((s) => s.team.id === d.id)!;
    expect(rowD.totalPoints).toBe(10); // the +1 is gone
    expect(rowD.bonusPoints).toBe(0);

    // And the three that stayed inside the top 3 keep theirs.
    for (const t of [a, b, c]) {
      expect(settled.teams.find((s) => s.team.id === t.id)!.totalPoints).toBe(11);
    }
  });

  it("drops a team below the others on the team board once its bonus is withheld", () => {
    const scores = teams.map((t) => score({ team_id: t.id, points: 10 }));
    const settled = computeStandings(teams, scores, threeWayTieForThird, [
      tiebreak("solo", [c.id, b.id, d.id]),
    ]);
    // A/B/C on 11 share rank 1; D alone on 10 is last. Within the 11-point
    // block the order follows the settled solo board — the tiebreak above put C
    // ahead of B, so C is listed first.
    expect(settled.teams.map((s) => [s.team.name, s.rank, s.position])).toEqual([
      ["A", 1, 1],
      ["C", 1, 2],
      ["B", 1, 3],
      ["D", 4, 4],
    ]);
  });
});

describe("computeStandings — raw boards", () => {
  it("exposes pre-tiebreak boards where tied rows still share a rank", () => {
    const results = soloValues([
      [a, 900],
      [b, 300],
      [c, 300],
      [d, 100],
    ]);
    const s = computeStandings(teams, [], results, [
      tiebreak("solo", [c.id, b.id]),
    ]);
    // Raw keeps the shared rank so a tie is still detectable...
    const rawRanks = s.rawSolo.map((r) => r.rank);
    expect(rawRanks.filter((r) => r === 2)).toHaveLength(2);
    // ...while the resolved board has distinct places in the settled order.
    expect(s.solo.map((r) => [r.team.name, r.rank])).toEqual([
      ["A", 1],
      ["C", 2],
      ["B", 3],
      ["D", 4],
    ]);
  });
});

describe("computeStandings — solo-aware ordering of the team board", () => {
  // The live situation before any team event is played: the solo top 3 hold 1
  // point each from the bonus, everyone else holds 0.
  const soloOrdered = soloValues([
    [a, 900],
    [b, 800],
    [c, 700],
    [d, 600],
  ]);

  it("orders teams level on points by their solo result", () => {
    const s = computeStandings(teams, [], soloOrdered, []);
    // A/B/C on 1pt (bonus), D on 0 — and inside the 1pt block, solo order holds.
    expect(s.teams.map((r) => [r.team.name, r.totalPoints])).toEqual([
      ["A", 1],
      ["B", 1],
      ["C", 1],
      ["D", 0],
    ]);
  });

  it("gives a sequential position while rank stays the strict shared rank", () => {
    const s = computeStandings(teams, [], soloOrdered, []);
    expect(s.teams.map((r) => [r.team.name, r.position, r.rank])).toEqual([
      // position reads as a proper leaderboard...
      ["A", 1, 1],
      ["B", 2, 1], // ...while rank still says "joint 1st"
      ["C", 3, 1],
      ["D", 4, 4],
    ]);
  });

  it("flags every team that shares a point total", () => {
    const s = computeStandings(teams, [], soloOrdered, []);
    expect(s.teams.map((r) => [r.team.name, r.levelOnPoints])).toEqual([
      ["A", true],
      ["B", true],
      ["C", true],
      ["D", false], // sole team on 0
    ]);
  });

  it("orders the zero-point teams by solo result too", () => {
    // Only A is in the solo top 3, so B/C/D all sit on 0 team points but have
    // different solo standings.
    const results = soloValues([
      [a, 900],
      [b, 800],
      [c, 700],
      [d, 600],
    ]);
    const s = computeStandings(teams, [], results, [
      // Settle solo so exactly A, B, C are top 3 — D gets no bonus.
      // (No tie here; this just documents the ordering of the 0-point block.)
    ]);
    const zeroBlock = s.teams.filter((r) => r.totalPoints === 0);
    expect(zeroBlock.map((r) => r.team.name)).toEqual(["D"]);

    // Now a board where three teams share 0 points with distinct solo places.
    const twoTeamBonus = computeStandings(
      teams,
      [score({ team_id: a.id, points: 5 })],
      results,
      []
    );
    const ordered = twoTeamBonus.teams.map((r) => r.team.name);
    // A leads on points; the rest follow in solo order.
    expect(ordered[0]).toBe("A");
    expect(ordered.slice(1)).toEqual(["B", "C", "D"]);
  });

  it("still ranks purely on points — solo order never overtakes a point lead", () => {
    // D is last in solo but has a real team-event score.
    const s = computeStandings(
      teams,
      [score({ team_id: d.id, points: 50 })],
      soloOrdered,
      []
    );
    expect(s.teams[0].team.name).toBe("D");
    expect(s.teams[0].position).toBe(1);
    expect(s.teams[0].rank).toBe(1);
  });

  it("lets a recorded external tiebreaker override the solo ordering", () => {
    const s = computeStandings(teams, [], soloOrdered, [
      // Solo order was A, B, C; the external game said C, A, B.
      tiebreak("teams", [c.id, a.id, b.id], "Rock-paper-scissors"),
    ]);
    expect(s.teams.slice(0, 3).map((r) => [r.team.name, r.position, r.rank])).toEqual([
      ["C", 1, 1],
      ["A", 2, 2],
      ["B", 3, 3],
    ]);
    // Points are still level, and the rows carry the tiebreak mark.
    expect(s.teams.slice(0, 3).every((r) => r.levelOnPoints)).toBe(true);
    expect(s.teams[0].tiebreak).toMatchObject({ position: 1, of: 3 });
  });

  it("keeps position and rank in step once a tiebreak splits the group", () => {
    const s = computeStandings(teams, [], soloOrdered, [
      tiebreak("teams", [c.id, a.id, b.id]),
    ]);
    for (const row of s.teams) {
      expect(row.position).toBe(row.rank);
    }
  });

  it("exposes the solo place and points used for ordering", () => {
    const s = computeStandings(teams, [], soloOrdered, []);
    const rowA = s.teams.find((r) => r.team.id === a.id)!;
    expect(rowA.soloRank).toBe(1);
    expect(rowA.soloPoints).toBeGreaterThan(0);
  });
});

describe("computeStandings — team board tiebreaks", () => {
  it("orders a team tie without changing any total", () => {
    const scores = [
      score({ team_id: a.id, points: 12 }),
      score({ team_id: b.id, points: 12 }),
      score({ team_id: c.id, points: 4 }),
    ];
    const s = computeStandings(teams, scores, [], [
      tiebreak("teams", [b.id, a.id], "Sudden-death race"),
    ]);
    expect(s.teams.slice(0, 2).map((r) => [r.team.name, r.rank])).toEqual([
      ["B", 1],
      ["A", 2],
    ]);
    expect(s.teams.slice(0, 2).map((r) => r.totalPoints)).toEqual([12, 12]);
    expect(s.teams[0].tiebreak).toMatchObject({ position: 1, of: 2 });
  });
});

describe("computeStandings — tournament points", () => {
  const row = (s: ReturnType<typeof computeStandings>, t: typeof a) =>
    s.teams.find((r) => r.team.id === t.id)!;

  /** A finished match: `x` beat `y` by the given rounds. */
  const played = (
    x: typeof a,
    y: typeof a,
    roundsX: number,
    roundsY: number,
    extra: Parameters<typeof match>[0] = {}
  ) =>
    match({
      team_a: x.id,
      team_b: y.id,
      score_a: roundsX,
      score_b: roundsY,
      winner_id: roundsX > roundsY ? x.id : y.id,
      ...extra,
    });

  it("adds round wins to the team total", () => {
    const s = computeStandings(teams, [], [], [], {
      tug: [played(a, b, 2, 1)],
    });
    expect(row(s, a).totalPoints).toBe(2);
    expect(row(s, a).tournamentPoints).toBe(2);
    expect(row(s, b).totalPoints).toBe(1);
  });

  it("counts dodgeball eliminations but not tug ones", () => {
    // B ends the two rounds with 3 then 4 alive out of 6 → A put out 5.
    const m = played(a, b, 2, 0, { survivors_b: [3, 4] });
    const asDodgeball = computeStandings(teams, [], [], [], { dodgeball: [m] });
    const asTug = computeStandings(teams, [], [], [], { tug: [m] });
    expect(row(asDodgeball, a).totalPoints).toBe(2 + 5);
    expect(row(asTug, a).totalPoints).toBe(2);
  });

  it("measures eliminations against the size each team fielded", () => {
    const m = played(a, b, 1, 0, { survivors_b: [2] });
    const full = computeStandings(teams, [], [], [], { dodgeball: [m] });
    const short = computeStandings(teams, [], [], [], {
      dodgeball: [m],
      teamSizes: new Map([[b.id, 4]]),
    });
    expect(row(full, a).totalPoints).toBe(1 + 4);
    expect(row(short, a).totalPoints).toBe(1 + 2);
  });

  it("adds both tournaments together", () => {
    const s = computeStandings(teams, [], [], [], {
      tug: [played(a, b, 2, 0)],
      dodgeball: [played(a, c, 2, 1, { survivors_b: [4, 5, 5] })],
    });
    expect(row(s, a).totalPoints).toBe(2 + 2 + 4);
    expect(row(s, a).tug!.total).toBe(2);
    expect(row(s, a).dodgeball!.total).toBe(6);
  });

  it("stacks on manual scores and the solo bonus", () => {
    // A wins every solo event, so it takes the +1 top-3 bonus as well.
    const s = computeStandings(
      teams,
      [score({ team_id: a.id, points: 10 })],
      soloValues([
        [a, 500],
        [b, 400],
        [c, 300],
        [d, 200],
      ]),
      [],
      { tug: [played(a, b, 2, 0)] }
    );
    const rowA = row(s, a);
    expect(rowA.bonusPoints).toBe(1);
    expect(rowA.tournamentPoints).toBe(2);
    expect(rowA.totalPoints).toBe(10 + 1 + 2);
  });

  it("reorders the board as results come in", () => {
    const scores = [
      score({ team_id: a.id, points: 5 }),
      score({ team_id: b.id, points: 5 }),
    ];
    const before = computeStandings(teams, scores, [], []);
    // B wins the final; A goes out in the semis and places nowhere.
    const after = computeStandings(teams, scores, [], [], {
      dodgeball: [
        played(b, a, 1, 0, { stage: "semi", group_label: null }),
        played(b, c, 1, 0, { stage: "final", group_label: null }),
      ],
    });
    expect(before.teams[0].totalPoints).toBe(before.teams[1].totalPoints);
    expect(after.teams[0].team.name).toBe("B");
    expect(row(after, b).totalPoints).toBe(5 + 2 + 5);
  });

  it("leaves the board on solo + manual points when no tournament is passed", () => {
    const s = computeStandings(teams, [score({ team_id: a.id, points: 3 })], [], []);
    expect(row(s, a).totalPoints).toBe(3);
    expect(row(s, a).tournamentPoints).toBe(0);
    expect(row(s, a).tug).toBeNull();
  });
});
