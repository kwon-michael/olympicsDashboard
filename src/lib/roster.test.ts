import { describe, it, expect } from "vitest";
import { computeTeamStandings, playerPointsMap } from "@/lib/roster";
import { team, score } from "@/lib/test-fixtures";

describe("computeTeamStandings", () => {
  const a = team({ name: "A", sort_order: 0 });
  const b = team({ name: "B", sort_order: 1 });
  const c = team({ name: "C", sort_order: 2 });
  const teams = [a, b, c];

  it("sums every score attached to a team", () => {
    const scores = [
      score({ team_id: a.id, points: 10 }),
      score({ team_id: a.id, points: 5 }),
      score({ team_id: b.id, points: 8 }),
    ];
    const standings = computeTeamStandings(teams, scores);
    const byName = Object.fromEntries(
      standings.map((s) => [s.team.name, s.totalPoints])
    );
    expect(byName).toMatchObject({ A: 15, B: 8, C: 0 });
  });

  it("ranks by total desc, breaking equal totals by sort_order", () => {
    const scores = [
      score({ team_id: a.id, points: 5 }),
      score({ team_id: b.id, points: 5 }),
      score({ team_id: c.id, points: 9 }),
    ];
    const standings = computeTeamStandings(teams, scores);
    // C (9) first; A and B tie at 5 but A has the lower sort_order.
    expect(standings.map((s) => [s.team.name, s.rank])).toEqual([
      ["C", 1],
      ["A", 2],
      ["B", 2],
    ]);
  });

  it("adds the solo bonus into the total and ranking but not scoreCount", () => {
    const scores = [score({ team_id: a.id, points: 5 })];
    const bonus = new Map([[a.id, 1]]);
    const standings = computeTeamStandings(teams, scores, bonus);
    const rowA = standings.find((s) => s.team.id === a.id)!;
    expect(rowA.totalPoints).toBe(6);
    expect(rowA.bonusPoints).toBe(1);
    expect(rowA.scoreCount).toBe(1); // bonus is not a score
  });

  it("counts scores independent of point value", () => {
    const scores = [
      score({ team_id: a.id, points: 0 }),
      score({ team_id: a.id, points: 3 }),
    ];
    const rowA = computeTeamStandings(teams, scores).find(
      (s) => s.team.id === a.id
    )!;
    expect(rowA.scoreCount).toBe(2);
  });

  it("returns a zeroed row for every team when there are no scores", () => {
    const standings = computeTeamStandings(teams, []);
    expect(standings).toHaveLength(3);
    expect(standings.every((s) => s.totalPoints === 0 && s.rank >= 1)).toBe(true);
  });
});

describe("playerPointsMap", () => {
  it("maps each player id to its summed points, ignoring team-only scores", () => {
    const scores = [
      score({ player_id: "p1", points: 4 }),
      score({ player_id: "p1", points: 6 }),
      score({ player_id: "p2", points: 3 }),
      score({ player_id: null, points: 99 }),
    ];
    const map = playerPointsMap(scores);
    expect(map.get("p1")).toBe(10);
    expect(map.get("p2")).toBe(3);
    expect(map.has("null")).toBe(false);
    expect(map.size).toBe(2);
  });
});
