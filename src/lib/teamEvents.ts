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

import { teamEvents, type EventRule } from "@/lib/events";

/**
 * Team events recorded here. Tug of War and Dodgeball are excluded — they run as
 * tournaments with their own dedicated admin pages.
 */
export const TOURNAMENT_TEAM_EVENT_SLUGS = ["tug-of-war", "dodgeball"] as const;

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
