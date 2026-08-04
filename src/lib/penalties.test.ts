import { describe, it, expect } from "vitest";
import {
  ATTENDANCE_PENALTY_KIND,
  ATTENDANCE_PENALTY_POINTS,
  appliedAttendancePenalties,
  computeAttendancePenalties,
  penalizedPlayerIds,
  signedPoints,
  summarizePenalties,
} from "@/lib/penalties";
import { buildCheckInEntries } from "@/lib/checkin";
import { team, player, checkin, score } from "@/lib/test-fixtures";

const CUTOFF = "2026-08-08T10:00:00Z";

const red = team({ name: "Red", sort_order: 1 });
const blue = team({ name: "Blue", sort_order: 2 });

const early = player({ team_id: red.id, name: "Early", sort_order: 1 });
const tardy = player({ team_id: red.id, name: "Tardy", sort_order: 2 });
const missing = player({ team_id: blue.id, name: "Missing", sort_order: 1 });

/** Entries for: one on time, one late, one no-show. */
function entries() {
  return buildCheckInEntries(
    [red, blue],
    [early, tardy, missing],
    [
      checkin({ player_id: early.id, checked_in_at: "2026-08-08T09:45:00Z" }),
      checkin({ player_id: tardy.id, checked_in_at: "2026-08-08T10:20:00Z" }),
    ]
  );
}

const charged = (list: ReturnType<typeof computeAttendancePenalties>) =>
  list.map((p) => [p.entry.player.name, p.reason]);

describe("computeAttendancePenalties", () => {
  it("charges no-shows as absent and late arrivals as late", () => {
    expect(charged(computeAttendancePenalties(entries(), CUTOFF))).toEqual([
      ["Tardy", "late"],
      ["Missing", "absent"],
    ]);
  });

  it("leaves anyone stamped before the cutoff alone", () => {
    const names = computeAttendancePenalties(entries(), CUTOFF).map(
      (p) => p.entry.player.name
    );
    expect(names).not.toContain("Early");
  });

  it("treats arriving exactly on the cutoff as on time", () => {
    const onTheDot = buildCheckInEntries(
      [red],
      [early],
      [checkin({ player_id: early.id, checked_in_at: CUTOFF })]
    );
    expect(computeAttendancePenalties(onTheDot, CUTOFF)).toEqual([]);
  });

  it("moves the line when the cutoff moves", () => {
    const later = computeAttendancePenalties(entries(), "2026-08-08T10:30:00Z");
    expect(charged(later)).toEqual([["Missing", "absent"]]);
  });

  it("skips players who already carry a penalty, so a re-run is safe", () => {
    const again = computeAttendancePenalties(
      entries(),
      CUTOFF,
      new Set([tardy.id])
    );
    expect(charged(again)).toEqual([["Missing", "absent"]]);
  });

  it("charges nobody when the cutoff can't be read", () => {
    expect(computeAttendancePenalties(entries(), "not a time")).toEqual([]);
  });

  it("ignores crossed-out players, who never reach it", () => {
    const replaced = player({
      team_id: red.id,
      name: "Replaced",
      sort_order: 3,
      is_active: false,
    });
    const list = buildCheckInEntries([red], [early, replaced], []);
    const names = computeAttendancePenalties(list, CUTOFF).map(
      (p) => p.entry.player.name
    );
    expect(names).toEqual(["Early"]); // absent, but "Replaced" isn't listed
  });
});

describe("summarizePenalties", () => {
  it("splits the count by reason and totals the damage", () => {
    expect(summarizePenalties(computeAttendancePenalties(entries(), CUTOFF)))
      .toEqual({ late: 1, absent: 1, points: -4, teams: 2 });
  });

  it("counts each team once however many of its players are charged", () => {
    const bothRed = buildCheckInEntries([red], [early, tardy], []);
    expect(summarizePenalties(computeAttendancePenalties(bothRed, CUTOFF)))
      .toMatchObject({ absent: 2, teams: 1, points: -4 });
  });

  it("is a no-op summary when nobody is charged", () => {
    expect(summarizePenalties([])).toEqual({
      late: 0,
      absent: 0,
      points: 0,
      teams: 0,
    });
  });
});

describe("recognising rows a sweep wrote", () => {
  const penalty = score({
    team_id: red.id,
    player_id: tardy.id,
    points: ATTENDANCE_PENALTY_POINTS,
    metadata: { kind: ATTENDANCE_PENALTY_KIND, reason: "late" },
  });
  const manual = score({ team_id: red.id, points: -5, label: "Unsporting" });
  const wager = score({
    team_id: red.id,
    points: -1,
    metadata: { kind: "wager", phase: "stake" },
  });

  it("picks out only the sweep's own rows", () => {
    const found = appliedAttendancePenalties([penalty, manual, wager]);
    expect(found).toEqual([penalty]);
  });

  it("collects the players already charged", () => {
    expect([...penalizedPlayerIds([penalty, manual, wager])]).toEqual([
      tardy.id,
    ]);
  });

  it("ignores a team-level penalty row with no player attached", () => {
    const teamLevel = score({
      team_id: red.id,
      player_id: null,
      points: -2,
      metadata: { kind: ATTENDANCE_PENALTY_KIND },
    });
    expect(penalizedPlayerIds([teamLevel]).size).toBe(0);
  });
});

describe("signedPoints", () => {
  it("awards a positive number and deducts a negative one", () => {
    expect(signedPoints("3", "award")).toBe(3);
    expect(signedPoints("3", "deduct")).toBe(-3);
  });

  it("ignores surrounding whitespace", () => {
    expect(signedPoints("  7 ", "deduct")).toBe(-7);
  });

  it("rejects a typed sign rather than flipping the direction", () => {
    expect(signedPoints("-3", "deduct")).toBeNull();
    expect(signedPoints("+3", "award")).toBeNull();
  });

  it("rejects zero, blanks, decimals and junk", () => {
    expect(signedPoints("0", "award")).toBeNull();
    expect(signedPoints("", "award")).toBeNull();
    expect(signedPoints("2.5", "award")).toBeNull();
    expect(signedPoints("two", "award")).toBeNull();
  });
});
