// ============================================
// Team-event results recorder — helpers
// ============================================
// Two of the four team events run as a bracket and have their own admin tools
// (Tug of War, Dodgeball). The other two — Tail Grab and the Conditional Relay —
// are scored straight from what happens on the field, so the recorder at
// /admin/team-events lets an admin punch in the raw result and have the points
// computed automatically (mirroring the solo recorder). Computed totals are
// written as ordinary roster_scores rows, so they feed the leaderboard exactly
// like manually-entered points.

import {
  teamEvents,
  computeTeamComponentValue,
  formatDbValue,
  type EventRule,
  type TeamScoreComponent,
} from "@/lib/events";
import { ordinal } from "@/lib/utils";
import type { RosterScore, RosterTeam } from "@/lib/types";

/**
 * Team events recorded here. Tug of War and Dodgeball are excluded — they run as
 * tournaments with their own dedicated admin pages.
 */
export const TOURNAMENT_TEAM_EVENT_SLUGS = ["tug-of-war", "dodgeball"] as const;

/**
 * The four team games in the order they're played on the day, per the schedule
 * (see supabase/seed_schedule.sql):
 *
 *   13:00  Tug of War Tournament
 *   14:00  Dodgeball Tournament
 *   15:00  Tail-Grab Deathmatch
 *   15:30  Conditioned 75m Relay
 *
 * The declaration order of `teamEvents` in lib/events.ts is a rulebook order,
 * not a running order, so anything listing the games for someone working the
 * event should sort by this instead. Schedule entries carry an optional
 * `event_slug` link, but it's unset by default, so deriving the running order
 * from the schedule table isn't reliable — this constant is the source of truth.
 */
export const TEAM_EVENT_DAY_ORDER = [
  "tug-of-war",
  "dodgeball",
  "tail-grab",
  "conditioned-relay",
] as const;

/** Position in the running order; unknown slugs sort to the end. */
export function teamEventDayIndex(slug: string): number {
  const i = (TEAM_EVENT_DAY_ORDER as readonly string[]).indexOf(slug);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
}

/** Sort any list of team-game-ish records into event-day order. */
export function byTeamEventDayOrder<T extends { slug: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => teamEventDayIndex(a.slug) - teamEventDayIndex(b.slug)
  );
}

export const recorderTeamEvents: EventRule[] = teamEvents.filter(
  (e) =>
    !!e.teamScoring &&
    !TOURNAMENT_TEAM_EVENT_SLUGS.includes(
      e.slug as (typeof TOURNAMENT_TEAM_EVENT_SLUGS)[number]
    )
);

/** The label a recorder-managed roster_scores row carries (its event name). */
export function recorderScoreLabel(event: EventRule): string {
  return event.name;
}

export interface RelayEntry {
  teamId: string;
  /** Final time in centiseconds (lower is faster). */
  timeCs: number;
}

export interface RelayStanding {
  teamId: string;
  rank: number;
  points: number;
}

/**
 * Rank teams by relay time (fastest first) and award placement points from the
 * event's `placementScale`. Ties share the higher placement and its points, and
 * the placement(s) directly below are skipped — the same standard-competition
 * ranking used for solo events.
 */
export function computeRelayStandings(
  entries: RelayEntry[],
  placementScale: number[]
): RelayStanding[] {
  const sorted = [...entries].sort((a, b) => a.timeCs - b.timeCs);
  const standings: RelayStanding[] = [];
  sorted.forEach((entry, i) => {
    const rank =
      i > 0 && entry.timeCs === sorted[i - 1].timeCs
        ? standings[i - 1].rank
        : i + 1;
    standings.push({
      teamId: entry.teamId,
      rank,
      points: placementScale[rank - 1] ?? 0,
    });
  });
  return standings;
}

/* ------------------------------------------------------------------ */
/*  Reading recorded results back out (leaderboard)                    */
/* ------------------------------------------------------------------ */

/** One recorded component of a team's result, ready to render in a cell. */
export interface TeamEventComponentCell {
  key: string;
  label: string;
  group?: string;
  /** What the admin recorded, formatted — "2nd", "4", or "—" when blank. */
  display: string;
  /** Points this single component contributed to the team's total. */
  points: number;
}

export interface TeamEventRow {
  team: RosterTeam;
  /** Place within this event alone (ties share a place). */
  rank: number;
  /** Points the team earned in this event — the value stored on its score row. */
  points: number;
  /** rank-by-time events: the recorded time, formatted. Null otherwise. */
  time: string | null;
  /** components events: one cell per component, in declaration order. */
  components: TeamEventComponentCell[];
}

function metaRaw(row: RosterScore, key: string): string {
  const v = row.metadata?.[key];
  return v === undefined || v === null ? "" : String(v).trim();
}

/** Break one saved result into per-component cells for the breakdown columns. */
function componentCells(
  components: TeamScoreComponent[],
  row: RosterScore
): TeamEventComponentCell[] {
  return components.map((c) => {
    const raw = metaRaw(row, c.key);
    const n = parseInt(raw, 10);
    const recorded = raw !== "" && !isNaN(n);
    return {
      key: c.key,
      label: c.label,
      group: c.group,
      display: !recorded
        ? "—"
        : c.kind === "placement"
          ? ordinal(n)
          : String(n),
      points: computeTeamComponentValue([c], { [c.key]: raw }),
    };
  });
}

/**
 * Per-event standings for a recorder-managed team game (Tail Grab or the
 * Conditional Relay), read back out of the roster_scores rows the recorder
 * writes. Only teams with a recorded result appear, matching how the solo
 * per-event board behaves.
 *
 * Points come from the stored row rather than being recomputed, so this board
 * can never disagree with the team total the same row feeds. Places are derived
 * here because they aren't stored: fastest-first for a timed event, most points
 * first otherwise, with ties sharing a place and the place(s) below skipped.
 */
export function computeTeamEventStandings(
  event: EventRule,
  teams: RosterTeam[],
  scores: RosterScore[]
): TeamEventRow[] {
  // One recorder-owned row per team, matched by the event-name label — the same
  // convention TeamEventRecorder writes under. Manual scores use other labels.
  const label = recorderScoreLabel(event);
  const savedByTeam = new Map<string, RosterScore>();
  for (const s of scores) {
    if (s.label === label && !savedByTeam.has(s.team_id)) {
      savedByTeam.set(s.team_id, s);
    }
  }

  const method = event.teamScoring?.method;
  const timeCsByTeam = new Map<string, number>();
  const rows: TeamEventRow[] = [];

  for (const team of teams) {
    const saved = savedByTeam.get(team.id);
    if (!saved) continue;
    const timeCs = Number(saved.metadata?.timeCs);
    if (method === "rank-by-time" && Number.isFinite(timeCs)) {
      timeCsByTeam.set(team.id, timeCs);
    }
    rows.push({
      team,
      rank: 0,
      points: saved.points,
      time:
        method === "rank-by-time" && Number.isFinite(timeCs)
          ? formatDbValue(timeCs, "time")
          : null,
      components:
        method === "components"
          ? componentCells(event.teamScoring?.components ?? [], saved)
          : [],
    });
  }

  // A missing/unparseable time sorts to the back rather than to the front.
  const timeOf = (r: TeamEventRow) =>
    timeCsByTeam.get(r.team.id) ?? Number.MAX_SAFE_INTEGER;
  const key = method === "rank-by-time" ? timeOf : (r: TeamEventRow) => -r.points;

  rows.sort((a, b) => key(a) - key(b) || a.team.sort_order - b.team.sort_order);
  rows.forEach((row, i) => {
    row.rank =
      i > 0 && key(row) === key(rows[i - 1]) ? rows[i - 1].rank : i + 1;
  });

  return rows;
}
