// ============================================
// Tournament engine — shared group-stage + playoff-bracket logic
// ============================================
// Both the Tug of War and Dodgeball tournaments are the same shape: the current
// team standings are snapshotted into three groups of three, each group plays a
// round robin (best-of-3, round wins tracked), and the three group winners plus
// the best 2nd-place team advance to a randomized 4-team bracket (semis -> final
// + 3rd-place match).
//
// This module holds the pure, table-agnostic logic. Each tournament wraps it
// with its own table names (via `fetchTournamentData`) and its own group-seeding
// pattern (see `assignGroupsInterleaved` / `assignGroupsSnake`). See
// `src/lib/tug.ts` and `src/lib/dodgeball.ts`.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { RosterTeam } from "@/lib/types";
import type { TeamStanding } from "@/lib/roster";

export const GROUP_LABELS = ["A", "B", "C"] as const;
export type GroupLabel = (typeof GROUP_LABELS)[number];

// Generic row shapes — structurally identical to the per-tournament DB rows in
// types.ts, so those rows flow through this logic without casting.
export type TournamentStage = "group" | "semi" | "final" | "third";

export interface TournamentState {
  id: number;
  groups_locked: boolean;
  bracket_seeded: boolean;
  wildcard_team_id: string | null;
  updated_at: string;
}

export interface TournamentGroupMember {
  team_id: string;
  group_label: string; // 'A' | 'B' | 'C'
  seed: number; // standings position 1-9
  created_at: string;
}

export interface TournamentMatch {
  id: string;
  stage: TournamentStage;
  group_label: string | null;
  slot: number;
  team_a: string | null;
  team_b: string | null;
  score_a: number | null;
  score_b: number | null;
  winner_id: string | null;
  is_tiebreaker: boolean;
  created_at: string;
  updated_at: string;
}

/** The three DB table names backing a single tournament. */
export interface TournamentTables {
  state: string;
  groupMembers: string;
  matches: string;
}

export interface TournamentData {
  state: TournamentState | null;
  groupMembers: TournamentGroupMember[];
  matches: TournamentMatch[];
}

export async function fetchTournamentData(
  supabase: SupabaseClient,
  tables: TournamentTables
): Promise<TournamentData> {
  const [stateRes, membersRes, matchesRes] = await Promise.all([
    supabase.from(tables.state).select("*").eq("id", 1).maybeSingle(),
    supabase.from(tables.groupMembers).select("*").order("seed"),
    supabase.from(tables.matches).select("*").order("slot"),
  ]);

  return {
    state: (stateRes.data as TournamentState | null) ?? null,
    groupMembers: (membersRes.data as TournamentGroupMember[]) ?? [],
    matches: (matchesRes.data as TournamentMatch[]) ?? [],
  };
}

export interface GroupAssignment {
  team_id: string;
  group_label: GroupLabel;
  seed: number;
}

/**
 * Interleaved seeding: positions 1,4,7 -> A ; 2,5,8 -> B ; 3,6,9 -> C. Uses the
 * array order (not the shared-rank field) so all nine teams get a distinct seed
 * even on point ties. Used by Tug of War.
 */
export function assignGroupsInterleaved(
  standings: TeamStanding[]
): GroupAssignment[] {
  return standings.map((s, i) => ({
    team_id: s.team.id,
    group_label: GROUP_LABELS[i % GROUP_LABELS.length],
    seed: i + 1,
  }));
}

/**
 * Snake seeding: positions 1,6,7 -> A ; 2,5,8 -> B ; 3,4,9 -> C. Rows of three
 * alternate direction (A,B,C then C,B,A then A,B,C…), balancing the strongest
 * and weakest teams across groups. Used by Dodgeball.
 */
export function assignGroupsSnake(standings: TeamStanding[]): GroupAssignment[] {
  const n = GROUP_LABELS.length;
  return standings.map((s, i) => {
    const row = Math.floor(i / n);
    const col = i % n;
    const idx = row % 2 === 0 ? col : n - 1 - col;
    return {
      team_id: s.team.id,
      group_label: GROUP_LABELS[idx],
      seed: i + 1,
    };
  });
}

/** The three pairwise matchups for a group of (up to) three teams. */
export function groupRoundRobin(teamIds: string[]): [string, string][] {
  const pairs: [string, string][] = [];
  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      pairs.push([teamIds[i], teamIds[j]]);
    }
  }
  return pairs;
}

export interface GroupTeamStanding {
  team: RosterTeam;
  seed: number;
  roundWins: number;
  matchesPlayed: number;
  rank: number; // rank within the group
}

export interface GroupStanding {
  label: GroupLabel;
  teams: GroupTeamStanding[];
}

/**
 * Per-group standings ordered by round wins (desc) then seed (asc). Round wins
 * accumulate from every played group match (winner_id set).
 */
export function computeGroupStandings(
  groupMembers: TournamentGroupMember[],
  matches: TournamentMatch[],
  teams: RosterTeam[]
): GroupStanding[] {
  const teamById = new Map(teams.map((t) => [t.id, t]));
  // Tiebreakers are one-off games between 2nd-place teams from different groups
  // — they must not pollute group round-win totals.
  const groupMatches = matches.filter(
    (m) => m.stage === "group" && !m.is_tiebreaker
  );

  return GROUP_LABELS.map((label) => {
    const members = groupMembers
      .filter((gm) => gm.group_label === label)
      .sort((a, b) => a.seed - b.seed);

    const rows: GroupTeamStanding[] = members.map((gm) => {
      let roundWins = 0;
      let matchesPlayed = 0;
      for (const m of groupMatches) {
        if (m.team_a !== gm.team_id && m.team_b !== gm.team_id) continue;
        const played = m.winner_id != null;
        if (played) matchesPlayed++;
        roundWins += (m.team_a === gm.team_id ? m.score_a : m.score_b) ?? 0;
      }
      return {
        team: teamById.get(gm.team_id) as RosterTeam,
        seed: gm.seed,
        roundWins,
        matchesPlayed,
        rank: 0,
      };
    });

    rows.sort((a, b) => b.roundWins - a.roundWins || a.seed - b.seed);
    rows.forEach((r, i) => {
      r.rank =
        i > 0 && r.roundWins === rows[i - 1].roundWins
          ? rows[i - 1].rank
          : i + 1;
    });

    return { label, teams: rows };
  });
}

/** True once every (non-tiebreaker) group match has a recorded winner. */
export function groupStageComplete(matches: TournamentMatch[]): boolean {
  const groupMatches = matches.filter(
    (m) => m.stage === "group" && !m.is_tiebreaker
  );
  return (
    groupMatches.length > 0 && groupMatches.every((m) => m.winner_id != null)
  );
}

export interface Qualifiers {
  groupWinners: GroupTeamStanding[]; // the top team of each group
  secondPlace: GroupTeamStanding[]; // the three 2nd-place teams, best first
  wildcard: GroupTeamStanding | null; // best 2nd place, or null if tied
  wildcardTie: GroupTeamStanding[]; // tied 2nd-place teams needing a tiebreaker
  /** True when the wildcard was decided by the solo top-3 priority marker. */
  wildcardByPriority: boolean;
}

/**
 * Determine the four qualifiers: each group winner plus the best of the three
 * 2nd-place teams (by round wins). If the top two 2nd-place teams are tied, the
 * wildcard is undecided (wildcardTie lists them) and must be broken manually —
 * UNLESS exactly one tied team carries the solo top-3 priority marker
 * (`priorityTeamIds`), in which case it automatically moves forward. If several
 * tied teams share priority, the tie narrows to just those and is still manual.
 */
export function computeQualifiers(
  groupStandings: GroupStanding[],
  priorityTeamIds: Set<string> = new Set()
): Qualifiers {
  const groupWinners = groupStandings
    .map((g) => g.teams.find((t) => t.rank === 1))
    .filter((t): t is GroupTeamStanding => Boolean(t));

  const secondPlace = groupStandings
    .map((g) => g.teams.find((t) => t.rank === 2))
    .filter((t): t is GroupTeamStanding => Boolean(t))
    .sort((a, b) => b.roundWins - a.roundWins || a.seed - b.seed);

  let wildcard: GroupTeamStanding | null = null;
  let wildcardTie: GroupTeamStanding[] = [];
  let wildcardByPriority = false;
  if (secondPlace.length > 0) {
    const best = secondPlace[0].roundWins;
    const tied = secondPlace.filter((t) => t.roundWins === best);
    if (tied.length > 1) {
      // A tie for the wildcard: teams with the solo top-3 priority marker jump
      // ahead of unmarked teams automatically.
      const prioritized = tied.filter((t) => priorityTeamIds.has(t.team.id));
      const candidates = prioritized.length > 0 ? prioritized : tied;
      if (candidates.length === 1) {
        wildcard = candidates[0];
        wildcardByPriority = prioritized.length === 1;
      } else {
        wildcardTie = candidates;
      }
    } else {
      wildcard = secondPlace[0];
    }
  }

  return { groupWinners, secondPlace, wildcard, wildcardTie, wildcardByPriority };
}

export interface BracketView {
  semis: TournamentMatch[]; // ordered by slot
  final: TournamentMatch | null;
  third: TournamentMatch | null;
}

/** Pull the bracket matches out of the full match list, ordered by slot. */
export function bracketMatches(matches: TournamentMatch[]): BracketView {
  const bySlot = (a: TournamentMatch, b: TournamentMatch) => a.slot - b.slot;
  return {
    semis: matches.filter((m) => m.stage === "semi").sort(bySlot),
    final: matches.find((m) => m.stage === "final") ?? null,
    third: matches.find((m) => m.stage === "third") ?? null,
  };
}

/**
 * The effective wildcard: the auto-computed best 2nd place, or — when 2nd-place
 * teams are tied — the team an admin designated as the tiebreaker winner
 * (state.wildcard_team_id). Returns null while a tie is still unresolved.
 */
export function resolvedWildcard(
  qualifiers: Qualifiers,
  state: TournamentState | null
): GroupTeamStanding | null {
  if (qualifiers.wildcard) return qualifiers.wildcard;
  if (qualifiers.wildcardTie.length === 0) return null;

  const chosen = state?.wildcard_team_id;
  if (!chosen) return null;
  return qualifiers.wildcardTie.find((t) => t.team.id === chosen) ?? null;
}

/** The four resolved qualifiers (3 group winners + wildcard), or null if pending. */
export function resolvedQualifiers(
  qualifiers: Qualifiers,
  state: TournamentState | null
): GroupTeamStanding[] | null {
  const wc = resolvedWildcard(qualifiers, state);
  if (qualifiers.groupWinners.length < 3 || !wc) return null;
  return [...qualifiers.groupWinners, wc];
}

/** The loser of a completed match, or null if unfinished / no data. */
export function loserOf(match: TournamentMatch | null | undefined): string | null {
  if (!match || match.winner_id == null) return null;
  if (match.team_a && match.winner_id !== match.team_a) return match.team_a;
  if (match.team_b && match.winner_id !== match.team_b) return match.team_b;
  return null;
}
