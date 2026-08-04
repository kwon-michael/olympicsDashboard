// ============================================
// Captain playoff wagers — client data access
// ============================================
// Read helpers + the place_wager RPC wrapper behind the captain dashboard panel
// and the admin wager-history page. The point economy and settlement live in
// the database (see supabase/wagers.sql); this module only reads the resulting
// rows and forwards bet placement to the RPC.

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchTugData } from "@/lib/tug";
import { fetchDodgeballData } from "@/lib/dodgeball";
import type { TournamentMatch } from "@/lib/tournament";
import type { RosterTeam, Wager, WagerTournament } from "@/lib/types";

// Only bracket matches can be wagered on (mirrors the DB check in place_wager).
export const PLAYOFF_STAGES = ["semi", "final", "third"] as const;

export function stageLabel(stage: string): string {
  switch (stage) {
    case "semi":
      return "Semifinal";
    case "final":
      return "Final";
    case "third":
      return "3rd-place";
    default:
      return stage;
  }
}

/** A bracket match tagged with which tournament it belongs to. */
export interface PlayoffMatch extends TournamentMatch {
  tournament: WagerTournament;
}

/** True when a match can currently accept a bet (both teams set, undecided). */
export function isOpenForBets(m: PlayoffMatch): boolean {
  return (
    PLAYOFF_STAGES.includes(m.stage as (typeof PLAYOFF_STAGES)[number]) &&
    m.team_a != null &&
    m.team_b != null &&
    m.winner_id == null
  );
}

export interface WagerData {
  /** Playoff matches from both tournaments, ordered tug → dodgeball, by slot. */
  matches: PlayoffMatch[];
  teamsById: Map<string, RosterTeam>;
  /** The signed-in captain's wagers (all statuses), newest first. */
  wagers: Wager[];
  /** The captain's linked roster team (their player's team), or null if none. */
  myTeam: RosterTeam | null;
  /** The captain's linked player name, or null if none. */
  myPlayerName: string | null;
  /** Points the captain's team can still stake (sum of roster_scores). */
  wagerablePoints: number;
}

/**
 * Load everything the captain panel needs in one shot. `userId` is the signed-in
 * user; their team is resolved from the roster player they're linked to
 * (roster_players.captain_user_id). Unlinked users still get the match list with
 * an empty wager set.
 */
export async function fetchWagerData(
  supabase: SupabaseClient,
  userId: string
): Promise<WagerData> {
  const [teamsRes, tug, dodge, wagersRes, playerRes] = await Promise.all([
    supabase.from("roster_teams").select("*").order("sort_order"),
    fetchTugData(supabase),
    fetchDodgeballData(supabase),
    // Scoped to this user explicitly, not just by RLS: an admin can read every
    // wager, so without the filter the "View as captain" preview would surface
    // other teams' bets as the viewer's own.
    supabase
      .from("wagers")
      .select("*")
      .eq("captain_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("roster_players")
      .select("name, team_id")
      .eq("captain_user_id", userId)
      .maybeSingle(),
  ]);

  const teams = (teamsRes.data as RosterTeam[]) ?? [];
  const teamsById = new Map(teams.map((t) => [t.id, t]));
  const linkedPlayer = (playerRes.data as { name: string; team_id: string } | null) ?? null;
  const myTeam = linkedPlayer ? teamsById.get(linkedPlayer.team_id) ?? null : null;
  const myPlayerName = linkedPlayer?.name ?? null;

  const matches: PlayoffMatch[] = [
    ...tug.matches
      .filter((m) => PLAYOFF_STAGES.includes(m.stage as (typeof PLAYOFF_STAGES)[number]))
      .map((m) => ({ ...m, tournament: "tug" as const })),
    ...dodge.matches
      .filter((m) => PLAYOFF_STAGES.includes(m.stage as (typeof PLAYOFF_STAGES)[number]))
      .map((m) => ({ ...m, tournament: "dodgeball" as const })),
  ];

  let wagerablePoints = 0;
  if (myTeam) {
    const { data } = await supabase
      .from("roster_scores")
      .select("points")
      .eq("team_id", myTeam.id);
    // Clamped at zero: deductions can push a team's total negative, and
    // "-4 points available to wager" is nonsense to show a captain. place_wager
    // refuses anything under 1 point anyway, so this only affects the display.
    wagerablePoints = Math.max(
      0,
      (data ?? []).reduce(
        (sum, r) => sum + ((r as { points: number }).points ?? 0),
        0
      )
    );
  }

  return {
    matches,
    teamsById,
    wagers: (wagersRes.data as Wager[]) ?? [],
    myTeam,
    myPlayerName,
    wagerablePoints,
  };
}

/**
 * Place a one-point wager on `pickedTeamId` to win the given playoff match. All
 * validation + the point escrow happen server-side in the place_wager RPC;
 * throws with a human-readable message on any rule violation.
 */
export async function placeWager(
  supabase: SupabaseClient,
  tournament: WagerTournament,
  matchId: string,
  pickedTeamId: string
): Promise<Wager> {
  const { data, error } = await supabase.rpc("place_wager", {
    p_tournament: tournament,
    p_match_id: matchId,
    p_picked_team_id: pickedTeamId,
  });
  if (error) throw new Error(error.message);
  return data as Wager;
}

/** Index a captain's wagers by `${tournament}:${match_id}` for quick lookup. */
export function wagersByMatch(wagers: Wager[]): Map<string, Wager> {
  const map = new Map<string, Wager>();
  for (const w of wagers) {
    if (w.status === "void") continue;
    map.set(`${w.tournament}:${w.match_id}`, w);
  }
  return map;
}
