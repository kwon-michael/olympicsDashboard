// ============================================
// Tiebreaks — placement order from an external game
// ============================================
// Teams that finish level on a leaderboard are separated by a game played
// outside the app. The admin records the finishing order and it is applied here
// as *ordering only*: point totals are never recomputed or adjusted, so the
// original leaderboard is exactly what it was — a resolution just decides who
// gets listed first among teams already level, and marks those rows so the
// public page can say why.
//
// A tie is only surfaced for resolution when it actually changes an outcome, and
// only once the teams have scored (otherwise every team sitting on 0 before the
// first event reads as a nine-way tie for 1st). What counts as "changes an
// outcome" differs by board — see `isConsequential`.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { RosterTeam } from "@/lib/types";
import { SOLO_BONUS_PLACES } from "@/lib/solo";

/**
 * Only the solo board is ever played off.
 *
 * The `tiebreaks` table still carries a `board` column that accepts 'teams' (see
 * supabase/tiebreaks.sql), because the main standings used to be settled this
 * way too. They aren't any more: teams level on points on the team board are
 * ordered by their solo standing and no game is played. Any leftover 'teams'
 * row is ignored — it can never match a live tie, so the admin panel lists it as
 * inactive and it can be cleared out.
 */
export type TiebreakBoard = "solo";

/**
 * Is this tie worth pulling teams off the field to play off?
 *
 * The solo board hands out one thing: the top 3 each take the bonus and playoff
 * priority. Nothing else about solo order is worth a game. So a game is only
 * played when it would decide *who holds priority* — which means the tied group
 * has to straddle the line, some members landing inside the top 3 and some
 * outside it. A tie sitting wholly inside the top 3 gives every member priority
 * whichever way it lands, and a tie wholly outside gives none, so neither is
 * worth playing:
 *
 *     2 tied for 1st  (ranks 1-2)  → both take priority       → no game
 *     3 tied for 1st  (ranks 1-3)  → all three take priority  → no game
 *     3 tied for 2nd  (ranks 2-4)  → one misses out           → play it off
 *     2 tied for 3rd  (ranks 3-4)  → one misses out           → play it off
 *     2 tied for 4th  (ranks 4-5)  → neither was in line      → no game
 */
function isConsequential(rank: number, size: number): boolean {
  const last = rank + size - 1; // the lowest place this tie reaches
  return rank <= SOLO_BONUS_PLACES && last > SOLO_BONUS_PLACES;
}

export interface Tiebreak {
  id: string;
  board: TiebreakBoard;
  team_key: string;
  /** Finishing order from the external game — index 0 placed first. */
  team_ids: string[];
  tied_rank: number;
  tied_points: number;
  note: string | null;
  decided_by: string | null;
  created_at: string;
  updated_at: string;
}

/** The minimum a standings row needs for tiebreak handling. */
export interface RankedTeam {
  team: RosterTeam;
  totalPoints: number;
  rank: number;
}

/** Stamped onto a row whose rank came out of an external tiebreaker. */
export interface TiebreakMark {
  /** 1-based finishing position within the tied group. */
  position: number;
  /** How many teams were tied. */
  of: number;
  note: string | null;
}

/** A set of teams sitting on the same rank, with its resolution if one exists. */
export interface TieGroup {
  board: TiebreakBoard;
  /** The shared rank the tie sits at. */
  rank: number;
  /** The point total all these teams are level on. */
  points: number;
  /** Tied teams in standings order. */
  teams: RosterTeam[];
  teamKey: string;
  resolution: Tiebreak | null;
}

/**
 * Canonical identity for a set of tied teams: sorted ids, comma joined. Sorted
 * so the key doesn't depend on standings order, which lets a resolution keep
 * applying as the tie drifts between ranks or both teams gain points equally.
 */
export function teamKeyOf(teamIds: string[]): string {
  return [...teamIds].sort().join(",");
}

export async function fetchTiebreaks(
  supabase: SupabaseClient
): Promise<Tiebreak[]> {
  const { data } = await supabase
    .from("tiebreaks")
    .select("*")
    .order("created_at", { ascending: false });
  return (data as Tiebreak[]) ?? [];
}

/** Group consecutive standings entries that share a rank (2+ members only). */
function rankGroups<T extends RankedTeam>(standings: T[]): T[][] {
  const groups: T[][] = [];
  let current: T[] = [];
  for (const row of standings) {
    if (current.length > 0 && current[0].rank !== row.rank) {
      if (current.length > 1) groups.push(current);
      current = [];
    }
    current.push(row);
  }
  if (current.length > 1) groups.push(current);
  return groups;
}

function resolutionIndex(tiebreaks: Tiebreak[], board: TiebreakBoard) {
  const byKey = new Map<string, Tiebreak>();
  for (const t of tiebreaks) {
    if (t.board === board) byKey.set(t.team_key, t);
  }
  return byKey;
}

/**
 * Every tie worth settling on this board, each with its resolution attached (or
 * null when it still needs one).
 *
 * Pass the *raw* standings — once a resolution is applied the tied rows no
 * longer share a rank, so they'd stop being detectable here.
 */
export function findTieGroups<T extends RankedTeam>(
  standings: T[],
  board: TiebreakBoard,
  tiebreaks: Tiebreak[]
): TieGroup[] {
  const byKey = resolutionIndex(tiebreaks, board);

  return rankGroups(standings)
    .filter(
      (group) =>
        group[0].totalPoints > 0 &&
        isConsequential(group[0].rank, group.length)
    )
    .map((group) => {
      const teamKey = teamKeyOf(group.map((r) => r.team.id));
      return {
        board,
        rank: group[0].rank,
        points: group[0].totalPoints,
        teams: group.map((r) => r.team),
        teamKey,
        resolution: byKey.get(teamKey) ?? null,
      };
    });
}

/** Tie groups on this board that still need an external result recorded. */
export function unresolvedTieGroups<T extends RankedTeam>(
  standings: T[],
  board: TiebreakBoard,
  tiebreaks: Tiebreak[]
): TieGroup[] {
  return findTieGroups(standings, board, tiebreaks).filter(
    (g) => g.resolution === null
  );
}

/**
 * Stored resolutions that no longer match a live tie — the teams untied, or a
 * third team joined and changed the set. Harmless, but shown in the admin panel
 * so stale rows can be cleared.
 */
export function inactiveTiebreaks(
  tiebreaks: Tiebreak[],
  liveGroups: TieGroup[]
): Tiebreak[] {
  const liveKeys = new Set(liveGroups.map((g) => `${g.board}:${g.teamKey}`));
  return tiebreaks.filter((t) => !liveKeys.has(`${t.board}:${t.team_key}`));
}

/**
 * Reorder tied rows to the finishing order the external game produced and hand
 * each of them a sequential rank. Point totals are passed through untouched.
 *
 * Because standard competition ranking already skips the places a tie consumes
 * (three teams tied for 2nd → next team is 5th), expanding 2/2/2 into 2/3/4
 * leaves every other row's rank correct.
 *
 * Returns new objects; the input array is not mutated.
 */
export function applyTiebreaks<T extends RankedTeam>(
  standings: T[],
  board: TiebreakBoard,
  tiebreaks: Tiebreak[]
): (T & { tiebreak?: TiebreakMark })[] {
  const byKey = resolutionIndex(tiebreaks, board);
  if (byKey.size === 0) return standings.map((row) => ({ ...row }));

  const out: (T & { tiebreak?: TiebreakMark })[] = [];
  let i = 0;

  while (i < standings.length) {
    // Collect the run of rows sharing this rank.
    let end = i + 1;
    while (end < standings.length && standings[end].rank === standings[i].rank) {
      end++;
    }
    const group = standings.slice(i, end);

    const resolution =
      group.length > 1
        ? byKey.get(teamKeyOf(group.map((r) => r.team.id)))
        : undefined;

    if (!resolution) {
      out.push(...group.map((row) => ({ ...row })));
    } else {
      const order = new Map(resolution.team_ids.map((id, idx) => [id, idx]));
      const baseRank = group[0].rank;
      const ordered = [...group].sort(
        (a, b) =>
          (order.get(a.team.id) ?? Number.MAX_SAFE_INTEGER) -
          (order.get(b.team.id) ?? Number.MAX_SAFE_INTEGER)
      );
      ordered.forEach((row, idx) => {
        out.push({
          ...row,
          rank: baseRank + idx,
          tiebreak: {
            position: idx + 1,
            of: ordered.length,
            note: resolution.note,
          },
        });
      });
    }

    i = end;
  }

  return out;
}
