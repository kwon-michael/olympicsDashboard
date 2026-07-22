// ============================================
// Solo event scoring — per-event ranking + solo team standings
// ============================================
// Solo events are their own scoring universe. Admins record one raw result per
// team per solo event (see solo_results). Here we rank the teams within each
// event and award placement points (7/5/3/2/1), then roll those up into a solo
// team leaderboard. The only crossover into the team events is derived here too:
// the top 3 solo teams each earn +1 team-event point (`soloBonusByTeam`) and a
// wildcard "priority" marker (`soloPriorityTeamIds`).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { RosterTeam, RosterPlayer, SoloResult } from "@/lib/types";
import {
  soloEvents,
  getScoringInputBySlug,
  getSoloPlacementPoints,
  formatDbValue,
} from "@/lib/events";

/** Team-event points awarded to each of the top 3 solo teams. */
export const SOLO_BONUS_POINTS = 1;

export async function fetchSoloResults(
  supabase: SupabaseClient
): Promise<SoloResult[]> {
  const { data } = await supabase
    .from("solo_results")
    .select("*")
    .order("created_at", { ascending: false });
  return (data as SoloResult[]) ?? [];
}

/** Lower is better for timed events; higher is better for distance/points. */
export function eventIsAscending(slug: string): boolean {
  return getScoringInputBySlug(slug) === "time";
}

export interface SoloEventRow {
  team: RosterTeam;
  playerName: string | null;
  value: number;
  /** Human-readable value in the event's unit. */
  display: string;
  rank: number;
  points: number;
}

/**
 * Rank the teams that have a recorded result for one solo event and award
 * placement points. Ties share the higher placement and its points, and the
 * placement(s) below are skipped (standard competition ranking) — e.g. two tied
 * for 1st each earn 7 and the next team places 3rd (3 pts).
 */
export function computeEventStandings(
  slug: string,
  results: SoloResult[],
  teams: RosterTeam[],
  players: RosterPlayer[] = []
): SoloEventRow[] {
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const playerById = new Map(players.map((p) => [p.id, p]));
  const mode = getScoringInputBySlug(slug);
  const asc = eventIsAscending(slug);

  const rows: SoloEventRow[] = results
    .filter((r) => r.event_slug === slug && teamById.has(r.team_id))
    .map((r) => ({
      team: teamById.get(r.team_id) as RosterTeam,
      playerName: r.player_id ? playerById.get(r.player_id)?.name ?? null : null,
      value: r.value,
      display: formatDbValue(r.value, mode),
      rank: 0,
      points: 0,
    }));

  rows.sort((a, b) => (asc ? a.value - b.value : b.value - a.value));
  rows.forEach((row, i) => {
    row.rank =
      i > 0 && row.value === rows[i - 1].value ? rows[i - 1].rank : i + 1;
    row.points = getSoloPlacementPoints(row.rank);
  });

  return rows;
}

export interface SoloTeamStanding {
  team: RosterTeam;
  totalPoints: number;
  eventsEntered: number;
  rank: number;
  /** Top-3 finish → earns the +1 team-event bonus and wildcard priority. */
  isTop3: boolean;
}

/**
 * Solo leaderboard: each team's placement points summed across every solo
 * event. Teams that finish in the top 3 (and have actually scored) are flagged
 * as `isTop3`; ties at 3rd all share the flag.
 */
export function computeSoloTeamStandings(
  results: SoloResult[],
  teams: RosterTeam[]
): SoloTeamStanding[] {
  const pointsByTeam = new Map<string, number>();
  const eventsByTeam = new Map<string, number>();

  for (const ev of soloEvents) {
    for (const row of computeEventStandings(ev.slug, results, teams)) {
      pointsByTeam.set(
        row.team.id,
        (pointsByTeam.get(row.team.id) ?? 0) + row.points
      );
      eventsByTeam.set(
        row.team.id,
        (eventsByTeam.get(row.team.id) ?? 0) + 1
      );
    }
  }

  const standings: SoloTeamStanding[] = teams.map((team) => ({
    team,
    totalPoints: pointsByTeam.get(team.id) ?? 0,
    eventsEntered: eventsByTeam.get(team.id) ?? 0,
    rank: 0,
    isTop3: false,
  }));

  standings.sort(
    (a, b) =>
      b.totalPoints - a.totalPoints || a.team.sort_order - b.team.sort_order
  );
  standings.forEach((s, i) => {
    s.rank =
      i > 0 && s.totalPoints === standings[i - 1].totalPoints
        ? standings[i - 1].rank
        : i + 1;
  });
  for (const s of standings) {
    s.isTop3 = s.totalPoints > 0 && s.rank <= 3;
  }

  return standings;
}

/** teamId → +1 bonus for each top-3 solo team (for computeTeamStandings). */
export function soloBonusByTeam(
  standings: SoloTeamStanding[]
): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of standings) {
    if (s.isTop3) m.set(s.team.id, SOLO_BONUS_POINTS);
  }
  return m;
}

/** The set of top-3 solo team ids, used for the wildcard tiebreak priority. */
export function soloPriorityTeamIds(
  standings: SoloTeamStanding[]
): Set<string> {
  return new Set(standings.filter((s) => s.isTop3).map((s) => s.team.id));
}
