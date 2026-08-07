// ============================================
// Attendance adjustments
// ============================================
// A deduction is an ordinary roster_scores row with negative points — nothing
// about the standings needed changing to support them, they just sum in. Two
// ways they get written:
//
//   * by hand in Score Management, for whatever the organisers decide on the
//     day (that's why the label is free text), and
//   * in one sweep from the check-in page, which now cuts both ways: every
//     player who turned up late or not at all costs their team a point, and
//     every team that turned up complete gains one.
//
// The carrot and the stick are one operation on purpose. They're decided off a
// single cutoff, applied by a single button, and undone together — so the two
// can't end up reflecting different ideas about who was on time.
//
// Both are admin-only. The route gate keeps volunteers out of the tools, and
// migrate_admin_only_deductions.sql keeps them out of negative rows at the
// database, so the restriction survives someone poking the API directly. The
// bonus rows are positive and so aren't covered by that policy, but they're
// only reachable from the same admin-gated button.

import type { RosterScore, RosterTeam } from "@/lib/types";
import type { CheckInEntry } from "@/lib/checkin";

/**
 * What one player who wasn't on time costs their team. Negative by definition —
 * every consumer adds it, nobody subtracts it.
 */
export const ATTENDANCE_PENALTY_POINTS = -1;

/**
 * What a team earns for turning up complete. Awarded once to the team rather
 * than per player, so a big roster isn't worth more than a small one — it's a
 * flat reward for the same achievement.
 */
export const PUNCTUAL_TEAM_BONUS_POINTS = 1;

/**
 * Written to metadata.kind on each row the sweep creates. It's what makes the
 * sweep repeatable: a player already carrying one of these is skipped, so
 * clicking the button twice doesn't charge them twice. (`kind` follows the
 * convention the wager escrow rows already use.)
 */
export const ATTENDANCE_PENALTY_KIND = "attendance_penalty";

/** The bonus counterpart, kept distinct so a re-run skips teams already paid. */
export const ATTENDANCE_BONUS_KIND = "attendance_bonus";

/** Event day, as used by the schedule page and the home-page countdown. */
export const EVENT_DAY = "2026-08-08";

/**
 * Default moment the doors close, in the `datetime-local` input format. The
 * opening ceremony — anyone stamped in after it is late. Editable at the desk,
 * because the day never starts exactly on time.
 */
export const DEFAULT_LATE_CUTOFF = `${EVENT_DAY}T10:00`;

export type AttendanceReason = "late" | "absent";

export interface AttendancePenalty {
  entry: CheckInEntry;
  reason: AttendanceReason;
}

export function penaltyLabel(reason: AttendanceReason): string {
  return reason === "late" ? "Late arrival" : "Absent";
}

/** The label on a bonus row, which is charged to the team, not a player. */
export const PUNCTUAL_TEAM_BONUS_LABEL = "Full team on time";

/**
 * On time as far as the sweep is concerned: stamped in, at or before the
 * cutoff. Arriving exactly on the cutoff counts as on time.
 *
 * Both passes below are defined in terms of this one predicate so they can
 * never disagree about the same player — the bonus is exactly "none of this
 * team's players was charged", and that has to stay true by construction.
 *
 * An unreadable arrival stamp is treated as on time. It's the same call the
 * penalty pass has always made, and it fails in the player's favour rather
 * than charging someone over a bad timestamp.
 */
function isOnTime(entry: CheckInEntry, cutoffMs: number): boolean {
  if (entry.checkedInAt === null) return false;
  const arrivedMs = new Date(entry.checkedInAt).getTime();
  return Number.isNaN(arrivedMs) || arrivedMs <= cutoffMs;
}

/**
 * Everyone who owes the attendance penalty as of `cutoff`: no check-in at all
 * is "absent", a check-in stamped after the cutoff is "late". Both cost the
 * same — the distinction is kept for the label and the summary line, not the
 * arithmetic.
 *
 * `alreadyPenalized` is the set of player ids that have a penalty row already;
 * they're left out so a re-run only picks up what's new. An unparseable cutoff
 * charges nobody rather than guessing.
 *
 * Note that crossed-out players never reach this function — buildCheckInEntries
 * drops them — so a team isn't charged for someone it already replaced.
 */
export function computeAttendancePenalties(
  entries: CheckInEntry[],
  cutoff: string,
  alreadyPenalized: ReadonlySet<string> = new Set()
): AttendancePenalty[] {
  const cutoffMs = new Date(cutoff).getTime();
  if (Number.isNaN(cutoffMs)) return [];

  const penalties: AttendancePenalty[] = [];
  for (const entry of entries) {
    if (alreadyPenalized.has(entry.player.id)) continue;
    if (isOnTime(entry, cutoffMs)) continue;
    penalties.push({
      entry,
      reason: entry.checkedInAt === null ? "absent" : "late",
    });
  }
  return penalties;
}

export interface PunctualTeamBonus {
  team: RosterTeam;
  /** How many players had to show up for it — shown in the confirm line. */
  players: number;
}

/**
 * Teams where every single player was on time, and so earn {@link
 * PUNCTUAL_TEAM_BONUS_POINTS}.
 *
 * Deliberately computed from the *whole* entry list rather than from whoever is
 * still unpenalized: a team that had someone charged by an earlier sweep must
 * not qualify now just because that player is being skipped this time round.
 * `alreadyAwarded` is what makes a re-run safe, holding the team ids that
 * already have a bonus row.
 *
 * A team with nobody on its roster earns nothing — "all present" is vacuously
 * true of an empty team, which is not the achievement being rewarded.
 */
export function computePunctualTeamBonuses(
  entries: CheckInEntry[],
  cutoff: string,
  alreadyAwarded: ReadonlySet<string> = new Set()
): PunctualTeamBonus[] {
  const cutoffMs = new Date(cutoff).getTime();
  if (Number.isNaN(cutoffMs)) return [];

  // Insertion order is roster order, since buildCheckInEntries sorted by team.
  const byTeam = new Map<string, { team: RosterTeam; total: number; onTime: number }>();
  for (const entry of entries) {
    const tally = byTeam.get(entry.team.id) ?? {
      team: entry.team,
      total: 0,
      onTime: 0,
    };
    tally.total += 1;
    if (isOnTime(entry, cutoffMs)) tally.onTime += 1;
    byTeam.set(entry.team.id, tally);
  }

  const bonuses: PunctualTeamBonus[] = [];
  for (const [teamId, { team, total, onTime }] of byTeam) {
    if (alreadyAwarded.has(teamId)) continue;
    if (total === 0 || onTime !== total) continue;
    bonuses.push({ team, players: total });
  }
  return bonuses;
}

function kindOf(score: RosterScore): string | undefined {
  return (score.metadata as { kind?: string } | null)?.kind;
}

/** The penalty rows a previous sweep wrote, newest first (roster_scores' order). */
export function appliedAttendancePenalties(
  scores: RosterScore[]
): RosterScore[] {
  return scores.filter((s) => kindOf(s) === ATTENDANCE_PENALTY_KIND);
}

/** The bonus rows a previous sweep wrote. */
export function appliedAttendanceBonuses(scores: RosterScore[]): RosterScore[] {
  return scores.filter((s) => kindOf(s) === ATTENDANCE_BONUS_KIND);
}

/**
 * Everything a sweep wrote, both directions. The two are undone together —
 * they were decided together off one cutoff, so leaving the bonuses standing
 * after clearing the penalties would reward teams under a line no longer drawn.
 */
export function appliedAttendanceRows(scores: RosterScore[]): RosterScore[] {
  return scores.filter((s) => {
    const kind = kindOf(s);
    return kind === ATTENDANCE_PENALTY_KIND || kind === ATTENDANCE_BONUS_KIND;
  });
}

/** Player ids that already carry an attendance penalty. */
export function penalizedPlayerIds(scores: RosterScore[]): Set<string> {
  const ids = new Set<string>();
  for (const s of appliedAttendancePenalties(scores)) {
    if (s.player_id) ids.add(s.player_id);
  }
  return ids;
}

/** Team ids that already carry a punctuality bonus. */
export function bonusedTeamIds(scores: RosterScore[]): Set<string> {
  const ids = new Set<string>();
  for (const s of appliedAttendanceBonuses(scores)) {
    if (s.team_id) ids.add(s.team_id);
  }
  return ids;
}

export interface SweepSummary {
  late: number;
  absent: number;
  /** What the penalties take away. Zero or negative, never positive. */
  penaltyPoints: number;
  /** How many distinct teams have a player charged. */
  teams: number;
  /** How many teams turned up complete. */
  bonusTeams: number;
  /** What the bonuses give back. Zero or positive, never negative. */
  bonusPoints: number;
  /** The two together — what the standings actually move by. Either sign. */
  netPoints: number;
}

/**
 * The whole sweep in one object: what's charged, what's awarded, and the net.
 * Both halves are summarised together because they're applied together and the
 * confirm line has to state the real effect, which can now go either way.
 */
export function summarizeSweep(
  penalties: AttendancePenalty[],
  bonuses: PunctualTeamBonus[] = []
): SweepSummary {
  const teams = new Set<string>();
  let late = 0;
  let absent = 0;
  for (const p of penalties) {
    teams.add(p.entry.team.id);
    if (p.reason === "late") late += 1;
    else absent += 1;
  }

  // Both guarded because 0 * -1 is -0, which renders as "-0" in the summary.
  const penaltyPoints =
    penalties.length === 0 ? 0 : penalties.length * ATTENDANCE_PENALTY_POINTS;
  const bonusPoints =
    bonuses.length === 0 ? 0 : bonuses.length * PUNCTUAL_TEAM_BONUS_POINTS;

  return {
    late,
    absent,
    penaltyPoints,
    teams: teams.size,
    bonusTeams: bonuses.length,
    bonusPoints,
    netPoints: penaltyPoints + bonusPoints,
  };
}

/**
 * Signs a magnitude typed into Score Management. The form asks for "how many"
 * and a separate award/deduct choice rather than a number that might or might
 * not carry a minus — a mistyped sign is the one error in that form nobody
 * notices until the leaderboard is wrong.
 *
 * Returns null for anything that isn't a whole number of points above zero.
 */
export function signedPoints(
  magnitude: string,
  direction: "award" | "deduct"
): number | null {
  const trimmed = magnitude.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = parseInt(trimmed, 10);
  if (value <= 0) return null;
  return direction === "deduct" ? -value : value;
}
