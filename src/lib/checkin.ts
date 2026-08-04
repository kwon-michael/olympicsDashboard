// ============================================
// Arrival check-in — data access + list shaping
// ============================================
// Backs /admin/check-in, the registration desk both admins and volunteers work.
// The stored state is deliberately thin (a row per player who has arrived, see
// supabase/checkins.sql); everything the desk actually looks at — who's still
// missing, how full each team is — is derived here.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { RosterCheckin, RosterPlayer, RosterTeam } from "@/lib/types";

/**
 * Throws rather than falling back to an empty list: no rows and "you aren't
 * allowed to read this" would otherwise both render as a desk where nobody has
 * arrived yet, and the volunteer would have no way to tell the difference.
 */
export async function fetchCheckins(
  supabase: SupabaseClient
): Promise<RosterCheckin[]> {
  const { data, error } = await supabase.from("roster_checkins").select("*");
  if (error) throw new Error(error.message);
  return (data as RosterCheckin[]) ?? [];
}

/** A roster player as the desk sees them: their team, and when they arrived. */
export interface CheckInEntry {
  player: RosterPlayer;
  team: RosterTeam;
  /** ISO timestamp, or null when they haven't arrived yet. */
  checkedInAt: string | null;
}

/**
 * Every player the desk should be looking for, in roster order (team, then the
 * player's place within it).
 *
 * Crossed-out players are left off — they've been replaced and nobody should be
 * waiting on them — *unless* they're already checked in, because that's either
 * someone who turned up after being written off or a misfire at the desk, and
 * both need to stay visible and undoable.
 */
export function buildCheckInEntries(
  teams: RosterTeam[],
  players: RosterPlayer[],
  checkins: RosterCheckin[]
): CheckInEntry[] {
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const arrivedAt = new Map(checkins.map((c) => [c.player_id, c.checked_in_at]));

  const entries: CheckInEntry[] = [];
  for (const player of players) {
    const team = teamById.get(player.team_id);
    if (!team) continue; // orphaned row; nothing to file them under
    const checkedInAt = arrivedAt.get(player.id) ?? null;
    if (!player.is_active && checkedInAt === null) continue;
    entries.push({ player, team, checkedInAt });
  }

  entries.sort(
    (a, b) =>
      a.team.sort_order - b.team.sort_order ||
      a.player.sort_order - b.player.sort_order ||
      a.player.name.localeCompare(b.player.name)
  );
  return entries;
}

export type CheckInStatus = "all" | "waiting" | "arrived";

export interface CheckInFilters {
  /** A roster team id, or null for every team. */
  teamId?: string | null;
  /** Free-text match on the player's name; whitespace and case are ignored. */
  query?: string;
  status?: CheckInStatus;
}

export function filterCheckInEntries(
  entries: CheckInEntry[],
  { teamId = null, query = "", status = "all" }: CheckInFilters
): CheckInEntry[] {
  const needle = query.trim().toLowerCase();
  return entries.filter((e) => {
    if (teamId && e.team.id !== teamId) return false;
    if (status === "arrived" && e.checkedInAt === null) return false;
    if (status === "waiting" && e.checkedInAt !== null) return false;
    if (needle && !e.player.name.toLowerCase().includes(needle)) return false;
    return true;
  });
}

export interface CheckInTally {
  arrived: number;
  total: number;
}

export function tallyCheckIns(entries: CheckInEntry[]): CheckInTally {
  return {
    arrived: entries.filter((e) => e.checkedInAt !== null).length,
    total: entries.length,
  };
}

/** teamId → that team's arrived/total, for the per-team headers. */
export function tallyCheckInsByTeam(
  entries: CheckInEntry[]
): Map<string, CheckInTally> {
  const tallies = new Map<string, CheckInTally>();
  for (const e of entries) {
    const tally = tallies.get(e.team.id) ?? { arrived: 0, total: 0 };
    tally.total += 1;
    if (e.checkedInAt !== null) tally.arrived += 1;
    tallies.set(e.team.id, tally);
  }
  return tallies;
}

export interface CheckInGroup {
  team: RosterTeam;
  entries: CheckInEntry[];
}

/**
 * Splits an already-filtered list into per-team sections, keeping roster order
 * and dropping teams with nothing left to show.
 */
export function groupCheckInsByTeam(entries: CheckInEntry[]): CheckInGroup[] {
  const groups: CheckInGroup[] = [];
  for (const entry of entries) {
    const last = groups[groups.length - 1];
    if (last && last.team.id === entry.team.id) last.entries.push(entry);
    else groups.push({ team: entry.team, entries: [entry] });
  }
  return groups;
}
