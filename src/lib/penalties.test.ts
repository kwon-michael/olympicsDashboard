import { describe, it, expect } from "vitest";
import {
  ATTENDANCE_BONUS_KIND,
  ATTENDANCE_PENALTY_KIND,
  ATTENDANCE_PENALTY_POINTS,
  PUNCTUAL_TEAM_BONUS_POINTS,
  appliedAttendanceBonuses,
  appliedAttendancePenalties,
  appliedAttendanceRows,
  bonusedTeamIds,
  computeAttendancePenalties,
  computePunctualTeamBonuses,
  penalizedPlayerIds,
  signedPoints,
  summarizeSweep,
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

describe("computePunctualTeamBonuses", () => {
  /** Red fully on time; Blue has a no-show. */
  function mixed() {
    return buildCheckInEntries(
      [red, blue],
      [early, tardy, missing],
      [
        checkin({ player_id: early.id, checked_in_at: "2026-08-08T09:45:00Z" }),
        checkin({ player_id: tardy.id, checked_in_at: "2026-08-08T09:50:00Z" }),
      ]
    );
  }

  const awardedTo = (list: ReturnType<typeof computePunctualTeamBonuses>) =>
    list.map((b) => b.team.name);

  it("rewards only the teams with everyone in before the cutoff", () => {
    expect(awardedTo(computePunctualTeamBonuses(mixed(), CUTOFF))).toEqual([
      "Red",
    ]);
  });

  it("withholds the bonus from a team with a single late player", () => {
    expect(awardedTo(computePunctualTeamBonuses(entries(), CUTOFF))).toEqual([]);
  });

  it("counts arriving exactly on the cutoff as on time", () => {
    const onTheDot = buildCheckInEntries(
      [red],
      [early],
      [checkin({ player_id: early.id, checked_in_at: CUTOFF })]
    );
    expect(awardedTo(computePunctualTeamBonuses(onTheDot, CUTOFF))).toEqual([
      "Red",
    ]);
  });

  it("reports how many players earned it", () => {
    expect(computePunctualTeamBonuses(mixed(), CUTOFF)[0].players).toBe(2);
  });

  it("skips teams already awarded, so a re-run is safe", () => {
    const again = computePunctualTeamBonuses(
      mixed(),
      CUTOFF,
      new Set([red.id])
    );
    expect(again).toEqual([]);
  });

  it("awards nobody when the cutoff can't be read", () => {
    expect(computePunctualTeamBonuses(mixed(), "not a time")).toEqual([]);
  });

  it("earns a team the bonus once the cutoff moves past its stragglers", () => {
    const later = computePunctualTeamBonuses(entries(), "2026-08-08T10:30:00Z");
    expect(awardedTo(later)).toEqual(["Red"]); // Tardy now counts as on time
  });

  it("gives nothing to a team whose only players were crossed out", () => {
    // buildCheckInEntries drops them, so the team has no entries at all and
    // must not qualify on a vacuous "everyone present".
    const replaced = player({
      team_id: blue.id,
      name: "Replaced",
      is_active: false,
    });
    const list = buildCheckInEntries(
      [red, blue],
      [early, replaced],
      [checkin({ player_id: early.id, checked_in_at: "2026-08-08T09:45:00Z" })]
    );
    expect(awardedTo(computePunctualTeamBonuses(list, CUTOFF))).toEqual(["Red"]);
  });

  it("is exactly the complement of the penalty pass", () => {
    const list = mixed();
    const penalized = new Set(
      computeAttendancePenalties(list, CUTOFF).map((p) => p.entry.team.id)
    );
    const bonused = new Set(
      computePunctualTeamBonuses(list, CUTOFF).map((b) => b.team.id)
    );
    // No team can be both charged and rewarded off the same cutoff.
    for (const id of bonused) expect(penalized.has(id)).toBe(false);
    expect(bonused.size + penalized.size).toBe(2);
  });
});

describe("summarizeSweep", () => {
  it("splits the count by reason and totals the damage", () => {
    expect(
      summarizeSweep(computeAttendancePenalties(entries(), CUTOFF))
    ).toMatchObject({ late: 1, absent: 1, penaltyPoints: -2, teams: 2 });
  });

  it("counts each team once however many of its players are charged", () => {
    const bothRed = buildCheckInEntries([red], [early, tardy], []);
    expect(
      summarizeSweep(computeAttendancePenalties(bothRed, CUTOFF))
    ).toMatchObject({ absent: 2, teams: 1, penaltyPoints: -2 });
  });

  it("nets the bonuses against the penalties", () => {
    const list = buildCheckInEntries(
      [red, blue],
      [early, tardy, missing],
      [
        checkin({ player_id: early.id, checked_in_at: "2026-08-08T09:45:00Z" }),
        checkin({ player_id: tardy.id, checked_in_at: "2026-08-08T09:50:00Z" }),
      ]
    );
    expect(
      summarizeSweep(
        computeAttendancePenalties(list, CUTOFF),
        computePunctualTeamBonuses(list, CUTOFF)
      )
    ).toEqual({
      late: 0,
      absent: 1,
      penaltyPoints: -1,
      teams: 1,
      bonusTeams: 1,
      bonusPoints: 1,
      netPoints: 0, // Blue loses one, Red gains one
    });
  });

  it("is a no-op summary when nothing is due either way", () => {
    expect(summarizeSweep([], [])).toEqual({
      late: 0,
      absent: 0,
      penaltyPoints: 0,
      teams: 0,
      bonusTeams: 0,
      bonusPoints: 0,
      netPoints: 0,
    });
  });

  it("keeps zero totals unsigned rather than rendering -0", () => {
    const { penaltyPoints, bonusPoints } = summarizeSweep([], []);
    expect(Object.is(penaltyPoints, -0)).toBe(false);
    expect(Object.is(bonusPoints, -0)).toBe(false);
  });
});

describe("recognising rows a sweep wrote", () => {
  const penalty = score({
    team_id: red.id,
    player_id: tardy.id,
    points: ATTENDANCE_PENALTY_POINTS,
    metadata: { kind: ATTENDANCE_PENALTY_KIND, reason: "late" },
  });
  const bonus = score({
    team_id: blue.id,
    player_id: null,
    points: PUNCTUAL_TEAM_BONUS_POINTS,
    metadata: { kind: ATTENDANCE_BONUS_KIND, players: 3 },
  });
  const manual = score({ team_id: red.id, points: -5, label: "Unsporting" });
  const wager = score({
    team_id: red.id,
    points: -1,
    metadata: { kind: "wager", phase: "stake" },
  });

  it("picks out only the sweep's own rows", () => {
    const found = appliedAttendancePenalties([penalty, bonus, manual, wager]);
    expect(found).toEqual([penalty]);
  });

  it("keeps the two directions apart", () => {
    expect(appliedAttendanceBonuses([penalty, bonus, manual, wager])).toEqual([
      bonus,
    ]);
  });

  it("collects both directions for an undo, but nothing else", () => {
    expect(appliedAttendanceRows([penalty, bonus, manual, wager])).toEqual([
      penalty,
      bonus,
    ]);
  });

  it("collects the players already charged", () => {
    expect([...penalizedPlayerIds([penalty, bonus, manual, wager])]).toEqual([
      tardy.id,
    ]);
  });

  it("collects the teams already awarded", () => {
    expect([...bonusedTeamIds([penalty, bonus, manual, wager])]).toEqual([
      blue.id,
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
