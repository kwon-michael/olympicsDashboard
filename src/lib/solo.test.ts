import { describe, it, expect } from "vitest";
import {
  eventIsAscending,
  computeEventStandings,
  computeSoloTeamStandings,
  soloBonusByTeam,
  soloPriorityTeamIds,
  SOLO_BONUS_POINTS,
} from "@/lib/solo";
import { soloEvents } from "@/lib/events";
import { team, solo } from "@/lib/test-fixtures";

describe("eventIsAscending", () => {
  it("is true only for timed events (lower is better)", () => {
    expect(eventIsAscending("100m")).toBe(true);
    expect(eventIsAscending("200m")).toBe(true);
    expect(eventIsAscending("standing-long-jump")).toBe(false); // distance
    expect(eventIsAscending("garbage-basketball")).toBe(false); // points
  });
});

describe("computeEventStandings", () => {
  const a = team({ name: "A", sort_order: 0 });
  const b = team({ name: "B", sort_order: 1 });
  const c = team({ name: "C", sort_order: 2 });
  const teams = [a, b, c];

  it("ranks a distance event highest-first and awards 7/5/3", () => {
    const results = [
      solo({ event_slug: "standing-long-jump", team_id: a.id, value: 300 }),
      solo({ event_slug: "standing-long-jump", team_id: b.id, value: 350 }),
      solo({ event_slug: "standing-long-jump", team_id: c.id, value: 250 }),
    ];
    const rows = computeEventStandings("standing-long-jump", results, teams);
    expect(rows.map((r) => [r.team.name, r.rank, r.points])).toEqual([
      ["B", 1, 7],
      ["A", 2, 5],
      ["C", 3, 3],
    ]);
  });

  it("ranks a timed event lowest-first (fastest wins)", () => {
    const results = [
      solo({ event_slug: "100m", team_id: a.id, value: 1300 }),
      solo({ event_slug: "100m", team_id: b.id, value: 1250 }),
      solo({ event_slug: "100m", team_id: c.id, value: 1400 }),
    ];
    const rows = computeEventStandings("100m", results, teams);
    expect(rows.map((r) => r.team.name)).toEqual(["B", "A", "C"]);
  });

  it("shares the higher placement on a tie and skips the next (standard competition ranking)", () => {
    const results = [
      solo({ event_slug: "100m", team_id: a.id, value: 1200 }),
      solo({ event_slug: "100m", team_id: b.id, value: 1200 }), // tie for 1st
      solo({ event_slug: "100m", team_id: c.id, value: 1300 }),
    ];
    const rows = computeEventStandings("100m", results, teams);
    // Two tied for 1st each get 7; next team is 3rd (not 2nd) and gets 3.
    expect(rows.map((r) => [r.rank, r.points])).toEqual([
      [1, 7],
      [1, 7],
      [3, 3],
    ]);
  });

  it("ignores results from other events and unknown teams", () => {
    const results = [
      solo({ event_slug: "100m", team_id: a.id, value: 1200 }),
      solo({ event_slug: "200m", team_id: b.id, value: 1100 }), // other event
      solo({ event_slug: "100m", team_id: "ghost", value: 1000 }), // unknown team
    ];
    const rows = computeEventStandings("100m", results, teams);
    expect(rows.map((r) => r.team.name)).toEqual(["A"]);
  });

  it("formats the display value in the event's unit", () => {
    const results = [
      solo({ event_slug: "100m", team_id: a.id, value: 1234 }),
    ];
    expect(computeEventStandings("100m", results, teams)[0].display).toBe(
      "12.34s"
    );
  });
});

describe("computeSoloTeamStandings", () => {
  const a = team({ name: "A", sort_order: 0 });
  const b = team({ name: "B", sort_order: 1 });
  const c = team({ name: "C", sort_order: 2 });
  const d = team({ name: "D", sort_order: 3 });
  const teams = [a, b, c, d];

  it("sums placement points across all solo events", () => {
    const results = [
      // 100m: A fastest (7), B (5), C (3)
      solo({ event_slug: "100m", team_id: a.id, value: 1200 }),
      solo({ event_slug: "100m", team_id: b.id, value: 1300 }),
      solo({ event_slug: "100m", team_id: c.id, value: 1400 }),
      // shotput (distance): C farthest (7), B (5), A (3)
      solo({ event_slug: "shotput", team_id: a.id, value: 100 }),
      solo({ event_slug: "shotput", team_id: b.id, value: 200 }),
      solo({ event_slug: "shotput", team_id: c.id, value: 300 }),
    ];
    const standings = computeSoloTeamStandings(results, teams);
    const byName = Object.fromEntries(
      standings.map((s) => [s.team.name, s.totalPoints])
    );
    expect(byName).toMatchObject({ A: 10, B: 10, C: 10, D: 0 });
  });

  it("counts events entered per team", () => {
    const results = [
      solo({ event_slug: "100m", team_id: a.id, value: 1200 }),
      solo({ event_slug: "shotput", team_id: a.id, value: 300 }),
      solo({ event_slug: "100m", team_id: b.id, value: 1300 }),
    ];
    const standings = computeSoloTeamStandings(results, teams);
    const byName = Object.fromEntries(
      standings.map((s) => [s.team.name, s.eventsEntered])
    );
    expect(byName).toMatchObject({ A: 2, B: 1, C: 0, D: 0 });
  });

  it("flags exactly the top-3 scoring teams, breaking equal totals by sort_order", () => {
    // Give each team a distinct total via a single event's placement.
    const results = [
      solo({ event_slug: "100m", team_id: a.id, value: 1200 }), // 7
      solo({ event_slug: "100m", team_id: b.id, value: 1300 }), // 5
      solo({ event_slug: "100m", team_id: c.id, value: 1400 }), // 3
      solo({ event_slug: "100m", team_id: d.id, value: 1500 }), // 2
    ];
    const standings = computeSoloTeamStandings(results, teams);
    const top3 = standings.filter((s) => s.isTop3).map((s) => s.team.name);
    expect(top3).toEqual(["A", "B", "C"]);
  });

  it("never flags a team with zero points, even inside the top 3 rows", () => {
    const results = [solo({ event_slug: "100m", team_id: a.id, value: 1200 })];
    const standings = computeSoloTeamStandings(results, teams);
    // Only A scored; B/C/D have 0 and must not be isTop3 despite ranking 2–4.
    expect(standings.filter((s) => s.isTop3).map((s) => s.team.name)).toEqual([
      "A",
    ]);
  });

  it("shares the top-3 flag across a tie at 3rd", () => {
    const results = [
      solo({ event_slug: "100m", team_id: a.id, value: 1200 }), // 7
      solo({ event_slug: "100m", team_id: b.id, value: 1300 }), // 5
      // C and D tie for 3rd in the event → each 3 pts → tie at rank 3
      solo({ event_slug: "100m", team_id: c.id, value: 1400 }),
      solo({ event_slug: "100m", team_id: d.id, value: 1400 }),
    ];
    const standings = computeSoloTeamStandings(results, teams);
    expect(standings.filter((s) => s.isTop3).map((s) => s.team.name).sort()).toEqual([
      "A",
      "B",
      "C",
      "D",
    ]);
  });

  it("returns a standing row for every team, including empty results", () => {
    const standings = computeSoloTeamStandings([], teams);
    expect(standings).toHaveLength(4);
    expect(standings.every((s) => s.totalPoints === 0 && !s.isTop3)).toBe(true);
  });
});

describe("soloBonusByTeam / soloPriorityTeamIds", () => {
  const a = team({ name: "A", sort_order: 0 });
  const b = team({ name: "B", sort_order: 1 });
  const c = team({ name: "C", sort_order: 2 });
  const d = team({ name: "D", sort_order: 3 });
  const teams = [a, b, c, d];
  const results = [
    solo({ event_slug: "100m", team_id: a.id, value: 1200 }),
    solo({ event_slug: "100m", team_id: b.id, value: 1300 }),
    solo({ event_slug: "100m", team_id: c.id, value: 1400 }),
    solo({ event_slug: "100m", team_id: d.id, value: 1500 }),
  ];
  const standings = computeSoloTeamStandings(results, teams);

  it("awards +1 bonus to each top-3 team only", () => {
    const bonus = soloBonusByTeam(standings);
    expect(bonus.get(a.id)).toBe(SOLO_BONUS_POINTS);
    expect(bonus.get(b.id)).toBe(SOLO_BONUS_POINTS);
    expect(bonus.get(c.id)).toBe(SOLO_BONUS_POINTS);
    expect(bonus.has(d.id)).toBe(false);
  });

  it("exposes the top-3 team ids as the wildcard priority set", () => {
    const ids = soloPriorityTeamIds(standings);
    expect(ids.has(a.id)).toBe(true);
    expect(ids.has(d.id)).toBe(false);
    expect(ids.size).toBe(3);
  });
});

describe("all solo events are covered by the rollup", () => {
  it("every soloEvents slug resolves a scoring direction", () => {
    for (const ev of soloEvents) {
      expect(typeof eventIsAscending(ev.slug)).toBe("boolean");
    }
  });
});
