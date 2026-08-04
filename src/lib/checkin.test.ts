import { describe, it, expect } from "vitest";
import {
  buildCheckInEntries,
  filterCheckInEntries,
  groupCheckInsByTeam,
  tallyCheckIns,
  tallyCheckInsByTeam,
  type CheckInEntry,
} from "@/lib/checkin";
import { team, player, checkin } from "@/lib/test-fixtures";

const red = team({ name: "Red", sort_order: 1 });
const blue = team({ name: "Blue", sort_order: 2 });

const ana = player({ team_id: red.id, name: "Ana", sort_order: 1 });
const ben = player({ team_id: red.id, name: "Ben", sort_order: 2 });
const cat = player({ team_id: blue.id, name: "Cat", sort_order: 1 });

const names = (entries: CheckInEntry[]) => entries.map((e) => e.player.name);

describe("buildCheckInEntries", () => {
  it("marks arrival time and leaves everyone else waiting", () => {
    const entries = buildCheckInEntries(
      [red, blue],
      [ana, ben, cat],
      [checkin({ player_id: ben.id, checked_in_at: "2026-08-08T09:30:00Z" })]
    );
    expect(entries.map((e) => [e.player.name, e.checkedInAt])).toEqual([
      ["Ana", null],
      ["Ben", "2026-08-08T09:30:00Z"],
      ["Cat", null],
    ]);
  });

  it("orders by team then roster position, not insertion order", () => {
    const entries = buildCheckInEntries([red, blue], [cat, ben, ana], []);
    expect(names(entries)).toEqual(["Ana", "Ben", "Cat"]);
  });

  it("hides crossed-out players nobody is waiting on", () => {
    const dropped = player({
      team_id: red.id,
      name: "Dee",
      sort_order: 3,
      is_active: false,
    });
    const entries = buildCheckInEntries([red], [ana, dropped], []);
    expect(names(entries)).toEqual(["Ana"]);
  });

  it("keeps a crossed-out player who is checked in, so it can be undone", () => {
    const dropped = player({
      team_id: red.id,
      name: "Dee",
      sort_order: 3,
      is_active: false,
    });
    const entries = buildCheckInEntries(
      [red],
      [ana, dropped],
      [checkin({ player_id: dropped.id })]
    );
    expect(names(entries)).toEqual(["Ana", "Dee"]);
  });

  it("skips players whose team is missing", () => {
    const orphan = player({ team_id: "gone", name: "Ora" });
    expect(names(buildCheckInEntries([red], [ana, orphan], []))).toEqual(["Ana"]);
  });
});

describe("filterCheckInEntries", () => {
  const entries = buildCheckInEntries(
    [red, blue],
    [ana, ben, cat],
    [checkin({ player_id: ben.id })]
  );

  it("filters to one team", () => {
    expect(names(filterCheckInEntries(entries, { teamId: blue.id }))).toEqual([
      "Cat",
    ]);
  });

  it("splits waiting from arrived", () => {
    expect(names(filterCheckInEntries(entries, { status: "waiting" }))).toEqual([
      "Ana",
      "Cat",
    ]);
    expect(names(filterCheckInEntries(entries, { status: "arrived" }))).toEqual([
      "Ben",
    ]);
  });

  it("matches names case- and whitespace-insensitively on a substring", () => {
    expect(names(filterCheckInEntries(entries, { query: "  AN " }))).toEqual([
      "Ana",
    ]);
  });

  it("combines every filter", () => {
    const found = filterCheckInEntries(entries, {
      teamId: red.id,
      query: "e",
      status: "arrived",
    });
    expect(names(found)).toEqual(["Ben"]);
  });

  it("returns everything by default", () => {
    expect(filterCheckInEntries(entries, {})).toHaveLength(3);
  });
});

describe("tallies", () => {
  const entries = buildCheckInEntries(
    [red, blue],
    [ana, ben, cat],
    [checkin({ player_id: ben.id })]
  );

  it("counts arrivals against the expected head count", () => {
    expect(tallyCheckIns(entries)).toEqual({ arrived: 1, total: 3 });
  });

  it("counts each team separately", () => {
    const byTeam = tallyCheckInsByTeam(entries);
    expect(byTeam.get(red.id)).toEqual({ arrived: 1, total: 2 });
    expect(byTeam.get(blue.id)).toEqual({ arrived: 0, total: 1 });
  });

  it("tallies the filtered list, so a search doesn't fake progress", () => {
    const waiting = filterCheckInEntries(entries, { status: "waiting" });
    expect(tallyCheckIns(waiting)).toEqual({ arrived: 0, total: 2 });
  });
});

describe("groupCheckInsByTeam", () => {
  it("sections the list by team in roster order", () => {
    const entries = buildCheckInEntries([red, blue], [ana, ben, cat], []);
    expect(
      groupCheckInsByTeam(entries).map((g) => [g.team.name, names(g.entries)])
    ).toEqual([
      ["Red", ["Ana", "Ben"]],
      ["Blue", ["Cat"]],
    ]);
  });

  it("drops teams a filter emptied out", () => {
    const entries = buildCheckInEntries(
      [red, blue],
      [ana, ben, cat],
      [checkin({ player_id: cat.id })]
    );
    const arrived = filterCheckInEntries(entries, { status: "arrived" });
    expect(groupCheckInsByTeam(arrived).map((g) => g.team.name)).toEqual([
      "Blue",
    ]);
  });
});
