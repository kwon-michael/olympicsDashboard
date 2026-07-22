// Test-only factories for the scoring unit tests. Kept out of the *.test.ts
// glob so it isn't collected as a test file. Every factory returns a fully
// shaped row with sensible defaults; pass overrides for the fields under test.

import type {
  RosterTeam,
  RosterPlayer,
  RosterScore,
  SoloResult,
} from "@/lib/types";
import type { TeamStanding } from "@/lib/roster";
import type {
  TournamentMatch,
  TournamentGroupMember,
  TournamentStage,
} from "@/lib/tournament";

let seq = 0;
const uid = (prefix: string) => `${prefix}-${++seq}`;

export function team(overrides: Partial<RosterTeam> = {}): RosterTeam {
  return {
    id: uid("team"),
    name: "Team",
    color: "#000000",
    sort_order: 0,
    created_at: "2026-07-01T00:00:00Z",
    ...overrides,
  };
}

export function player(overrides: Partial<RosterPlayer> = {}): RosterPlayer {
  return {
    id: uid("player"),
    team_id: "team-x",
    name: "Player",
    is_active: true,
    sort_order: 0,
    created_at: "2026-07-01T00:00:00Z",
    ...overrides,
  };
}

export function score(overrides: Partial<RosterScore> = {}): RosterScore {
  return {
    id: uid("score"),
    team_id: "team-x",
    player_id: null,
    label: "Event",
    points: 0,
    created_by: null,
    created_at: "2026-07-01T00:00:00Z",
    ...overrides,
  };
}

export function solo(overrides: Partial<SoloResult> = {}): SoloResult {
  return {
    id: uid("solo"),
    event_slug: "100m",
    team_id: "team-x",
    player_id: null,
    value: 0,
    created_by: null,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    ...overrides,
  };
}

/** A TeamStanding (input to the tournament seeding helpers). */
export function standing(
  t: RosterTeam,
  overrides: Partial<TeamStanding> = {}
): TeamStanding {
  return {
    team: t,
    totalPoints: 0,
    scoreCount: 0,
    bonusPoints: 0,
    rank: 0,
    ...overrides,
  };
}

export function groupMember(
  overrides: Partial<TournamentGroupMember> = {}
): TournamentGroupMember {
  return {
    team_id: "team-x",
    group_label: "A",
    seed: 1,
    created_at: "2026-07-01T00:00:00Z",
    ...overrides,
  };
}

export function match(
  overrides: Partial<TournamentMatch> = {}
): TournamentMatch {
  return {
    id: uid("match"),
    stage: "group" as TournamentStage,
    group_label: "A",
    slot: 0,
    team_a: null,
    team_b: null,
    score_a: null,
    score_b: null,
    winner_id: null,
    is_tiebreaker: false,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    ...overrides,
  };
}
