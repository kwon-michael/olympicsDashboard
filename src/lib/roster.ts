// ============================================
// Roster data access + scoring aggregation
// ============================================
// Shared helpers used by the public teams/leaderboard pages and the admin
// tools. Teams and players are plain rows (no auth); scores are manual point
// entries. Player points roll up into their team total; individual totals feed
// the MVP leaderboard.

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
  rank: number;
}

/** Team totals = sum of every score attached to the team (team-level + player). */
export function computeTeamStandings(
  teams: RosterTeam[],
  scores: RosterScore[]
): TeamStanding[] {
  const pointsByTeam = new Map<string, number>();
  const countByTeam = new Map<string, number>();

  for (const s of scores) {
    pointsByTeam.set(s.team_id, (pointsByTeam.get(s.team_id) ?? 0) + s.points);
    countByTeam.set(s.team_id, (countByTeam.get(s.team_id) ?? 0) + 1);
  }

  const standings = teams.map((team) => ({
    team,
    totalPoints: pointsByTeam.get(team.id) ?? 0,
    scoreCount: countByTeam.get(team.id) ?? 0,
    rank: 0,
  }));

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

export interface PlayerStanding {
  player: RosterPlayer;
  teamName: string;
  teamColor: string;
  totalPoints: number;
  rank: number;
}

/** Individual (MVP) totals = sum of scores tied to a specific player. */
export function computePlayerStandings(
  teams: RosterTeam[],
  players: RosterPlayer[],
  scores: RosterScore[]
): PlayerStanding[] {
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const pointsByPlayer = new Map<string, number>();

  for (const s of scores) {
    if (!s.player_id) continue;
    pointsByPlayer.set(
      s.player_id,
      (pointsByPlayer.get(s.player_id) ?? 0) + s.points
    );
  }

  const standings = players
    .filter((p) => pointsByPlayer.has(p.id))
    .map((player) => {
      const team = teamById.get(player.team_id);
      return {
        player,
        teamName: team?.name ?? "—",
        teamColor: team?.color ?? "#94A3B8",
        totalPoints: pointsByPlayer.get(player.id) ?? 0,
        rank: 0,
      };
    });

  standings.sort((a, b) => b.totalPoints - a.totalPoints);
  standings.forEach((s, i) => {
    s.rank =
      i > 0 && s.totalPoints === standings[i - 1].totalPoints
        ? standings[i - 1].rank
        : i + 1;
  });

  return standings;
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
