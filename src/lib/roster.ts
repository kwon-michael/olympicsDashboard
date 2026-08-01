// ============================================
// Roster data access + scoring aggregation
// ============================================
// Shared helpers used by the public teams/leaderboard pages and the admin
// tools. Teams and players are plain rows (no auth); scores are manual point
// entries. A score may be attributed to a player, but it always belongs to that
// player's team — the standings are team-level throughout.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { RosterTeam, RosterPlayer, RosterScore } from "@/lib/types";

export interface RosterData {
  teams: RosterTeam[];
  players: RosterPlayer[];
  scores: RosterScore[];
}

export async function fetchRosterData(
  supabase: SupabaseClient
): Promise<RosterData> {
  const [teamsRes, playersRes, scoresRes] = await Promise.all([
    supabase.from("roster_teams").select("*").order("sort_order"),
    supabase.from("roster_players").select("*").order("sort_order"),
    supabase.from("roster_scores").select("*").order("created_at", { ascending: false }),
  ]);

  return {
    teams: (teamsRes.data as RosterTeam[]) ?? [],
    players: (playersRes.data as RosterPlayer[]) ?? [],
    scores: (scoresRes.data as RosterScore[]) ?? [],
  };
}

export interface TeamStanding {
  team: RosterTeam;
  totalPoints: number;
  scoreCount: number;
  /** Portion of totalPoints that came from the solo top-3 bonus (0 if none). */
  bonusPoints: number;
  /** Portion of totalPoints earned in the Tug of War / Dodgeball tournaments. */
  tournamentPoints: number;
  rank: number;
}

/**
 * Team totals = sum of every score attached to the team (team-level + player),
 * plus two computed per-team contributions:
 *
 *   `bonusByTeam`       the +1 team-event point each top-3 solo team earns
 *                       (see src/lib/solo.ts)
 *   `tournamentByTeam`  round wins, eliminations and bracket placement from the
 *                       two tournaments (see src/lib/tournamentPoints.ts)
 *
 * Both count toward the total and the ranking, but neither is a roster_scores
 * row, so neither affects scoreCount.
 */
export function computeTeamStandings(
  teams: RosterTeam[],
  scores: RosterScore[],
  bonusByTeam?: Map<string, number>,
  tournamentByTeam?: Map<string, number>
): TeamStanding[] {
  const pointsByTeam = new Map<string, number>();
  const countByTeam = new Map<string, number>();

  for (const s of scores) {
    pointsByTeam.set(s.team_id, (pointsByTeam.get(s.team_id) ?? 0) + s.points);
    countByTeam.set(s.team_id, (countByTeam.get(s.team_id) ?? 0) + 1);
  }

  const standings = teams.map((team) => {
    const bonus = bonusByTeam?.get(team.id) ?? 0;
    const tournament = tournamentByTeam?.get(team.id) ?? 0;
    return {
      team,
      totalPoints: (pointsByTeam.get(team.id) ?? 0) + bonus + tournament,
      scoreCount: countByTeam.get(team.id) ?? 0,
      bonusPoints: bonus,
      tournamentPoints: tournament,
      rank: 0,
    };
  });

  standings.sort(
    (a, b) => b.totalPoints - a.totalPoints || a.team.sort_order - b.team.sort_order
  );
  // Standard competition ranking (ties share a rank).
  standings.forEach((s, i) => {
    s.rank =
      i > 0 && s.totalPoints === standings[i - 1].totalPoints
        ? standings[i - 1].rank
        : i + 1;
  });

  return standings;
}

/**
 * teamId → how many active players it fields. Dodgeball derives eliminations by
 * subtracting survivors from this, so a team playing a player short is counted
 * against the size it actually put on court rather than a flat six.
 */
export function activeTeamSizes(players: RosterPlayer[]): Map<string, number> {
  const sizes = new Map<string, number>();
  for (const p of players) {
    if (!p.is_active) continue;
    sizes.set(p.team_id, (sizes.get(p.team_id) ?? 0) + 1);
  }
  return sizes;
}

/** Sum of a single player's scores (used on the team page breakdown). */
export function playerPointsMap(scores: RosterScore[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const s of scores) {
    if (!s.player_id) continue;
    map.set(s.player_id, (map.get(s.player_id) ?? 0) + s.points);
  }
  return map;
}
