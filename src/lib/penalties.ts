// ============================================
// Point deductions
// ============================================
// A deduction is an ordinary roster_scores row with negative points — nothing
// about the standings needed changing to support them, they just sum in. Two
// ways they get written:
//
//   * by hand in Score Management, for whatever the organisers decide on the
//     day (that's why the label is free text), and
//   * in one sweep from the check-in page, charging every player who turned up
//     late or not at all.
//
// Both are admin-only. The route gate keeps volunteers out of the tools, and
// migrate_admin_only_deductions.sql keeps them out of negative rows at the
// database, so the restriction survives someone poking the API directly.

import type { RosterScore } from "@/lib/types";
import type { CheckInEntry } from "@/lib/checkin";

/**
 * What one late or absent player costs their team. Negative by definition —
 * every consumer adds it, nobody subtracts it.
 */
export const ATTENDANCE_PENALTY_POINTS = -2;

/**
 * Written to metadata.kind on each row the sweep creates. It's what makes the
 * sweep repeatable: a player already carrying one of these is skipped, so
 * clicking the button twice doesn't charge them twice. (`kind` follows the
 * convention the wager escrow rows already use.)
 */
export const ATTENDANCE_PENALTY_KIND = "attendance_penalty";

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

/**
 * Everyone who owes the attendance penalty as of `cutoff`: no check-in at all
 * is "absent", a check-in stamped after the cutoff is "late".
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
    if (entry.checkedInAt === null) {
      penalties.push({ entry, reason: "absent" });
      continue;
    }
    const arrivedMs = new Date(entry.checkedInAt).getTime();
    if (!Number.isNaN(arrivedMs) && arrivedMs > cutoffMs) {
      penalties.push({ entry, reason: "late" });
    }
  }
  return penalties;
}

/** The rows a previous sweep wrote, newest first (roster_scores' own order). */
export function appliedAttendancePenalties(
  scores: RosterScore[]
): RosterScore[] {
  return scores.filter(
    (s) => (s.metadata as { kind?: string } | null)?.kind === ATTENDANCE_PENALTY_KIND
  );
}

/** Player ids that already carry an attendance penalty. */
export function penalizedPlayerIds(scores: RosterScore[]): Set<string> {
  const ids = new Set<string>();
  for (const s of appliedAttendancePenalties(scores)) {
    if (s.player_id) ids.add(s.player_id);
  }
  return ids;
}

export interface PenaltySummary {
  late: number;
  absent: number;
  /** Total points change. Zero or negative, never positive. */
  points: number;
  /** How many distinct teams are affected. */
  teams: number;
}

export function summarizePenalties(
  penalties: AttendancePenalty[]
): PenaltySummary {
  const teams = new Set<string>();
  let late = 0;
  let absent = 0;
  for (const p of penalties) {
    teams.add(p.entry.team.id);
    if (p.reason === "late") late += 1;
    else absent += 1;
  }
  return {
    late,
    absent,
    // Guarded because 0 * -2 is -0, which renders as "-0" in the summary line.
    points:
      penalties.length === 0
        ? 0
        : penalties.length * ATTENDANCE_PENALTY_POINTS,
    teams: teams.size,
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
