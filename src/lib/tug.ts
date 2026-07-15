// ============================================
// Tug of War tournament — table + seeding config
// ============================================
// A standalone tournament layered on the roster teams. The shared group-stage /
// bracket logic lives in `src/lib/tournament.ts`; this module only pins the Tug
// of War table names and its interleaved {1,4,7}/{2,5,8}/{3,6,9} group seeding.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TeamStanding } from "@/lib/roster";
import {
  fetchTournamentData,
  assignGroupsInterleaved,
  type TournamentTables,
  type TournamentData,
  type GroupAssignment,
} from "@/lib/tournament";

export const TUG_TABLES: TournamentTables = {
  state: "tug_state",
  groupMembers: "tug_group_members",
  matches: "tug_matches",
};

export type TugData = TournamentData;

export function fetchTugData(supabase: SupabaseClient): Promise<TugData> {
  return fetchTournamentData(supabase, TUG_TABLES);
}

/** Split the solo standings into groups by rank {1,4,7}/{2,5,8}/{3,6,9}. */
export function assignGroups(standings: TeamStanding[]): GroupAssignment[] {
  return assignGroupsInterleaved(standings);
}

// Re-export the shared engine so existing imports from "@/lib/tug" keep working.
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
