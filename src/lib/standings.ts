// ============================================
// The standings pipeline
// ============================================
// One place that turns raw rows into the boards every page renders. The order of
// these steps matters, so it lives here rather than being repeated per page:
//
//   1. Compute the solo board (ties share a rank).
//   2. Apply solo tiebreaks — tied teams get distinct places.
//   3. Re-flag the top 3 from those settled places. Only these three teams earn
//      the +1 team-event bonus and playoff priority; a team that loses a
//      tiebreak for 3rd drops out and earns nothing.
//   4. Score the two tournaments (round wins, eliminations, bracket placement).
//   5. Compute the team board using that bonus and those tournament points.
//   6. Apply team tiebreaks.
//
// Step 3 is why this can't be done ad hoc: the bonus depends on the *settled*
// solo order, and the team board depends on the bonus. Deriving the bonus from
// the pre-tiebreak board would hand a +1 to every team tied for 3rd.
//
// Step 4 is derived, never stored: the tournament tables are the source of truth
// for those points, so the board moves as matches are recorded and no one has to
// key the same result in twice. Callers that skip the tournament argument get a
// board scored on solo + manual points alone, which is the right answer for
// tie detection on screens that don't load the tournaments.
//
// Tiebreaks themselves never award or remove points directly — they only decide
// placement (see src/lib/tiebreak.ts). The bonus moving is a consequence of the
// solo top-3 rule, not of the tiebreak editing anyone's score. Tiebreaker
// matches inside a tournament are excluded from tournament points for the same
// reason.

import { computeTeamStandings, type TeamStanding } from "@/lib/roster";
import type { TournamentMatch } from "@/lib/tournament";
import {
  computeTournamentPoints,
  totalsByTeam,
  type TournamentPoints,
} from "@/lib/tournamentPoints";
import {
  computeSoloTeamStandings,
  flagSoloTop3,
  soloBonusByTeam,
  type SoloTeamStanding,
} from "@/lib/solo";
import { applyTiebreaks, type Tiebreak, type TiebreakMark } from "@/lib/tiebreak";
import type { RosterScore, RosterTeam, SoloResult } from "@/lib/types";

export type ResolvedSoloStanding = SoloTeamStanding & {
  tiebreak?: TiebreakMark;
};

export type ResolvedTeamStanding = TeamStanding & {
  tiebreak?: TiebreakMark;
  /**
   * Sequential 1..N place after solo-aware ordering — the numeral the board
   * shows. Distinct from `rank`, which stays the strict competition rank and is
   * shared by teams level on points (1,1,1,4,…). Before the team events begin
   * the only points in play are the solo bonus, so `rank` alone would collapse
   * the whole board into 1st and 4th; `position` is what makes it read as a
   * proper leaderboard.
   */
  position: number;
  /** True when at least one other team has the identical point total. */
  levelOnPoints: boolean;
  /** Place on the settled solo board — what orders teams level on points. */
  soloRank: number;
  /** That team's solo placement points, so 0-solo teams can be left unlabelled. */
  soloPoints: number;
  /** Full Tug of War breakdown, or null if the team hasn't played one. */
  tug: TournamentPoints | null;
  /** Full Dodgeball breakdown, or null if the team hasn't played one. */
  dodgeball: TournamentPoints | null;
};

/**
 * The recorded matches of each tournament. All fields are optional so screens
 * that only care about the solo board don't have to fetch them.
 */
export interface TournamentInput {
  tug?: TournamentMatch[];
  dodgeball?: TournamentMatch[];
  /**
   * teamId → players fielded, from `activeTeamSizes`. Dodgeball needs it to turn
   * recorded survivors into eliminations; omitting it falls back to a full team.
   */
  teamSizes?: Map<string, number>;
}

export interface Standings {
  /** Solo board with tiebreaks applied and the top 3 settled. */
  solo: ResolvedSoloStanding[];
  /** Team board built on the settled bonus, with tiebreaks applied. */
  teams: ResolvedTeamStanding[];
  /**
   * The same two boards *before* tiebreaks. Tie detection needs these: once a
   * resolution is applied the tied rows no longer share a rank, so they'd stop
   * being detectable.
   */
  rawSolo: SoloTeamStanding[];
  rawTeams: TeamStanding[];
  /** teamId → +1 bonus, after the solo top 3 is settled. */
  bonusByTeam: Map<string, number>;
  /** teamId → Tug of War points breakdown. */
  tugByTeam: Map<string, TournamentPoints>;
  /** teamId → Dodgeball points breakdown. */
  dodgeballByTeam: Map<string, TournamentPoints>;
}

export function computeStandings(
  teams: RosterTeam[],
  scores: RosterScore[],
  soloResults: SoloResult[],
  tiebreaks: Tiebreak[],
  tournaments: TournamentInput = {}
): Standings {
  const rawSolo = computeSoloTeamStandings(soloResults, teams);
  const solo = flagSoloTop3(applyTiebreaks(rawSolo, "solo", tiebreaks));

  const bonusByTeam = soloBonusByTeam(solo);
  const soloRankById = new Map(solo.map((s) => [s.team.id, s.rank]));
  const soloPointsById = new Map(solo.map((s) => [s.team.id, s.totalPoints]));

  // Tug of War has no eliminations to count; Dodgeball scores one point each.
  const tugByTeam = computeTournamentPoints(tournaments.tug ?? []);
  const dodgeballByTeam = computeTournamentPoints(tournaments.dodgeball ?? [], {
    eliminations: true,
    teamSizes: tournaments.teamSizes,
  });
  const tournamentByTeam = totalsByTeam(tugByTeam, dodgeballByTeam);

  // Order teams level on points by how they did in the solo events. `rank` is a
  // function of points alone, so re-sorting on a secondary key never changes it —
  // and because points stays the primary key, teams sharing a rank remain
  // contiguous, which is what applyTiebreaks needs.
  const rawTeams = [
    ...computeTeamStandings(teams, scores, bonusByTeam, tournamentByTeam),
  ].sort(
    (a, b) =>
      b.totalPoints - a.totalPoints ||
      (soloRankById.get(a.team.id) ?? Number.MAX_SAFE_INTEGER) -
        (soloRankById.get(b.team.id) ?? Number.MAX_SAFE_INTEGER) ||
      a.team.sort_order - b.team.sort_order
  );

  // A recorded external tiebreaker outranks the solo ordering: it's an explicit
  // decision from a game actually played, so it reorders the group and splits
  // the shared rank.
  const settled = applyTiebreaks(rawTeams, "teams", tiebreaks);

  const teamsAtPoints = new Map<number, number>();
  for (const row of settled) {
    teamsAtPoints.set(
      row.totalPoints,
      (teamsAtPoints.get(row.totalPoints) ?? 0) + 1
    );
  }

  const teamRows: ResolvedTeamStanding[] = settled.map((row, index) => ({
    ...row,
    position: index + 1,
    levelOnPoints: (teamsAtPoints.get(row.totalPoints) ?? 0) > 1,
    soloRank: soloRankById.get(row.team.id) ?? Number.MAX_SAFE_INTEGER,
    soloPoints: soloPointsById.get(row.team.id) ?? 0,
    tug: tugByTeam.get(row.team.id) ?? null,
    dodgeball: dodgeballByTeam.get(row.team.id) ?? null,
  }));

  return {
    solo,
    teams: teamRows,
    rawSolo,
    rawTeams,
    bonusByTeam,
    tugByTeam,
    dodgeballByTeam,
  };
}

/** Empty boards, for the loading state. */
export const EMPTY_STANDINGS: Standings = {
  solo: [],
  teams: [],
  rawSolo: [],
  rawTeams: [],
  bonusByTeam: new Map(),
  tugByTeam: new Map(),
  dodgeballByTeam: new Map(),
};
