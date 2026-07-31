// ============================================
// Tournament → team points
// ============================================
// Tug of War and Dodgeball are run as tournaments (see src/lib/tournament.ts),
// and until now that was tracking only — the points they're worth had to be
// typed into Score Management by hand. This module turns the recorded matches
// into points directly, so the team board moves the moment a result is saved.
//
// Both tournaments score the same two ways:
//
//   Round win        1 point per round won
//   Final placement  1st = 5, 2nd = 3, 3rd = 2, 4th = 1
//
// Dodgeball adds a third: 1 point per opponent eliminated. Eliminations aren't
// recorded directly — the recorder captures what a referee can actually see when
// a round ends, the number of players each side still has alive, and this
// derives the rest:
//
//   eliminations by A  =  Σ over rounds of (B's team size − B's survivors)
//
// which is the rule as written: the count is taken at the end of each round, so
// a player eliminated and then brought back by a team-mate's catch nets out.
// Tug of War has no equivalent, so it's opt-in per tournament rather than
// assumed.
//
// Tiebreaker matches are skipped throughout. They're extra games played only to
// separate teams that finished level, and this codebase holds the line that a
// tiebreak decides placement without ever moving points (see src/lib/tiebreak.ts
// and the note in src/lib/standings.ts) — counting their round wins would break
// that by handing the winner a point the tie itself created.

import { bracketMatches, loserOf, type TournamentMatch } from "@/lib/tournament";

/** Points for finishing 1st through 4th in a tournament. */
export const TOURNAMENT_PLACEMENT_POINTS = [5, 3, 2, 1];

export const POINTS_PER_ROUND_WIN = 1;
export const POINTS_PER_ELIMINATION = 1;

/**
 * Players a team starts each round with, when its roster size isn't known. Every
 * team is six (see supabase/roster.sql), so this is the answer rather than a
 * guess — but a team playing a player short should be counted from its actual
 * active roster, which is what `teamSizes` carries.
 */
export const DEFAULT_TEAM_SIZE = 6;

export interface TournamentPointsOptions {
  /** Score a point per opponent eliminated (Dodgeball). */
  eliminations?: boolean;
  /** teamId → players it starts each round with. Missing teams use the default. */
  teamSizes?: Map<string, number>;
}

/**
 * Opponents put out over every counted round, from the survivor counts of the
 * team being eliminated. Unplayed and uncounted rounds are NULL and skipped, so
 * a partially tallied match still contributes what's been counted.
 */
function eliminatedFrom(
  survivors: (number | null)[] | null | undefined,
  teamSize: number
): number {
  if (!survivors) return 0;
  let total = 0;
  for (const alive of survivors) {
    if (alive == null) continue;
    total += Math.max(0, teamSize - alive);
  }
  return total;
}

export interface TournamentPoints {
  roundWins: number;
  roundWinPoints: number;
  /** Opponents eliminated (Dodgeball only; 0 elsewhere). */
  eliminations: number;
  eliminationPoints: number;
  /** Final bracket placement 1-4, or null while the bracket is unfinished. */
  placement: number | null;
  placementPoints: number;
  total: number;
}

const EMPTY: TournamentPoints = {
  roundWins: 0,
  roundWinPoints: 0,
  eliminations: 0,
  eliminationPoints: 0,
  placement: null,
  placementPoints: 0,
  total: 0,
};

/**
 * Final placements from the bracket: the final decides 1st and 2nd, the
 * 3rd-place match decides 3rd and 4th. Each is read independently, so a finished
 * 3rd-place match counts even if the final hasn't been played yet.
 */
export function tournamentPlacements(
  matches: TournamentMatch[]
): Map<string, number> {
  const { final, third } = bracketMatches(matches);
  const places = new Map<string, number>();

  for (const [match, winnerPlace] of [
    [final, 1],
    [third, 3],
  ] as const) {
    if (!match?.winner_id) continue;
    places.set(match.winner_id, winnerPlace);
    const loser = loserOf(match);
    if (loser) places.set(loser, winnerPlace + 1);
  }

  return places;
}

/**
 * Points every team earned in one tournament, keyed by team id. Teams that
 * haven't played anything are absent rather than zero-filled, so callers can
 * tell "no result" from "played and scored nothing".
 *
 * `eliminations` opts a tournament into the per-elimination point (Dodgeball).
 * Survivor counts are read whether or not the match has a winner recorded —
 * they're an observation of what happened on court, not a consequence of the
 * result.
 */
export function computeTournamentPoints(
  matches: TournamentMatch[],
  options: TournamentPointsOptions = {}
): Map<string, TournamentPoints> {
  const countElims = options.eliminations ?? false;
  const sizeOf = (teamId: string | null) =>
    (teamId ? options.teamSizes?.get(teamId) : undefined) ?? DEFAULT_TEAM_SIZE;
  const scoring = matches.filter((m) => !m.is_tiebreaker);
  const placements = tournamentPlacements(scoring);
  const byTeam = new Map<string, TournamentPoints>();

  const rowFor = (teamId: string) => {
    let row = byTeam.get(teamId);
    if (!row) {
      row = { ...EMPTY };
      byTeam.set(teamId, row);
    }
    return row;
  };

  for (const m of scoring) {
    // A team's eliminations come from its *opponent's* survivor counts: the
    // players it put out are the ones missing from the other side of the court.
    for (const [teamId, rounds, opponentId, opponentSurvivors] of [
      [m.team_a, m.score_a, m.team_b, m.survivors_b],
      [m.team_b, m.score_b, m.team_a, m.survivors_a],
    ] as const) {
      if (!teamId) continue;
      const row = rowFor(teamId);
      // Round wins only count once the match has a result — a half-entered
      // scoreline shouldn't pay out.
      if (m.winner_id != null && rounds != null && rounds > 0) {
        row.roundWins += rounds;
      }
      if (countElims) {
        row.eliminations += eliminatedFrom(
          opponentSurvivors,
          sizeOf(opponentId)
        );
      }
    }
  }

  for (const [teamId, place] of placements) {
    rowFor(teamId).placement = place;
  }

  for (const row of byTeam.values()) {
    row.roundWinPoints = row.roundWins * POINTS_PER_ROUND_WIN;
    row.eliminationPoints = row.eliminations * POINTS_PER_ELIMINATION;
    row.placementPoints =
      row.placement == null
        ? 0
        : (TOURNAMENT_PLACEMENT_POINTS[row.placement - 1] ?? 0);
    row.total = row.roundWinPoints + row.eliminationPoints + row.placementPoints;
  }

  return byTeam;
}

/** Flatten one or more tournaments into a single teamId → total points map. */
export function totalsByTeam(
  ...tournaments: Map<string, TournamentPoints>[]
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const t of tournaments) {
    for (const [teamId, row] of t) {
      totals.set(teamId, (totals.get(teamId) ?? 0) + row.total);
    }
  }
  return totals;
}
