// ============================================
// Dodgeball tournament — table + seeding config
// ============================================
// A standalone tournament layered on the roster teams, run after Tug of War. The
// shared group-stage / bracket logic lives in `src/lib/tournament.ts`; this
// module only pins the Dodgeball table names and its snake
// {1,6,7}/{2,5,8}/{3,4,9} group seeding.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TeamStanding } from "@/lib/roster";
import {
  fetchTournamentData,
  assignGroupsSnake,
  type TournamentTables,
  type TournamentData,
  type GroupAssignment,
} from "@/lib/tournament";

export const DODGEBALL_TABLES: TournamentTables = {
  state: "dodgeball_state",
  groupMembers: "dodgeball_group_members",
  matches: "dodgeball_matches",
};

export type DodgeballData = TournamentData;

export function fetchDodgeballData(
  supabase: SupabaseClient
): Promise<DodgeballData> {
  return fetchTournamentData(supabase, DODGEBALL_TABLES);
}

/** Split the standings into groups by rank {1,6,7}/{2,5,8}/{3,4,9} (snake). */
export function assignGroups(standings: TeamStanding[]): GroupAssignment[] {
  return assignGroupsSnake(standings);
}

// Re-export the shared engine so callers can import everything from one place.
export {
  GROUP_LABELS,
  groupRoundRobin,
  computeGroupStandings,
  groupStageComplete,
  computeQualifiers,
  bracketMatches,
  resolvedWildcard,
  resolvedQualifiers,
  loserOf,
} from "@/lib/tournament";
export type {
  GroupLabel,
  GroupAssignment,
  GroupTeamStanding,
  GroupStanding,
  Qualifiers,
  BracketView,
} from "@/lib/tournament";
