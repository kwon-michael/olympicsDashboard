export type UserRole = "participant" | "volunteer" | "admin" | "captain";

export interface User {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string;
  avatar_url: string | null;
  role: UserRole;
  profile_completed: boolean;
  created_at: string;
}

export interface Team {
  id: string;
  name: string;
  color: string;
  motto: string | null;
  avatar_url: string | null;
  captain_id: string;
  created_at: string;
  is_locked: boolean;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  event_nickname: string | null;
  joined_at: string;
  user?: User;
  team?: Team;
}

// ---- Roster (auth-free teams / players / manual scoring) ----
export interface RosterTeam {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  created_at: string;
}

// ---- Captain playoff wagers (Tug of War / Dodgeball bracket) ----
export type WagerTournament = "tug" | "dodgeball";
export type WagerStatus = "pending" | "won" | "lost" | "void";

export interface Wager {
  id: string;
  captain_id: string | null;
  captain_name: string | null;
  team_id: string;
  tournament: WagerTournament;
  match_id: string;
  picked_team_id: string;
  stake: number;
  status: WagerStatus;
  // Net change to the team total once resolved: 0 pending, +1 won, -1 lost, 0 void.
  net_points: number;
  stake_score_id: string | null;
  payout_score_id: string | null;
  settled_at: string | null;
  created_at: string;
}

export interface RosterPlayer {
  id: string;
  team_id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  // The user account (a captain) tied to this person, if any. Being linked here
  // is what makes a user a captain; their wager team is this player's team_id.
  captain_user_id: string | null;
  created_at: string;
}

// ---- App settings (single admin-controlled row, see supabase/app_settings.sql) ----
export interface AppSettings {
  id: number;
  /** Replaces the public standings with a "hidden" message. Scoring is unaffected. */
  leaderboard_hidden: boolean;
  updated_at: string;
  updated_by: string | null;
}

// ---- Event photos (the shared gallery) ----
// A record of a photo; the bytes live in Supabase Storage and `path` /
// `thumb_path` point at them. See supabase/photos.sql and src/lib/photos.ts.
export interface EventPhoto {
  id: string;
  /** Storage key of the display rendition (longest edge 1600px). */
  path: string;
  /** Storage key of the grid thumbnail (longest edge 480px). */
  thumb_path: string;
  /** Display rendition size, so the grid can reserve space before it loads. */
  width: number;
  height: number;
  caption: string | null;
  uploaded_by: string | null;
  /** Snapshot of the uploader's name, so the credit survives the account. */
  uploader_name: string | null;
  /** Identity in an imported Google Photos album; null for site uploads. */
  source_id: string | null;
  created_at: string;
}

// ---- Arrival check-in (registration desk) ----
// A row exists only for players who have arrived; checking someone back out
// deletes it. See supabase/checkins.sql.
export interface RosterCheckin {
  player_id: string;
  checked_in_at: string;
  checked_in_by: string | null;
}

export interface RosterScore {
  id: string;
  team_id: string;
  player_id: string | null;
  label: string;
  points: number;
  // Raw inputs behind a computed team-event total (see /admin/team-events).
  // NULL/absent for plain manual scores entered in Score Management.
  metadata?: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
}

// ---- Solo event results (one raw measurement per team per solo event) ----
export interface SoloResult {
  id: string;
  event_slug: string;
  team_id: string;
  player_id: string | null;
  // Raw result in the event's unit: time → centiseconds, distance → cm,
  // points → raw integer. Ranked + converted to placement points client-side.
  value: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ---- Tug of War tournament (groups + playoff bracket) ----
export type TugStage = "group" | "semi" | "final" | "third";

export interface TugState {
  id: number;
  groups_locked: boolean;
  bracket_seeded: boolean;
  wildcard_team_id: string | null;
  updated_at: string;
}

export interface TugGroupMember {
  team_id: string;
  group_label: string; // 'A' | 'B' | 'C'
  seed: number; // solo-standings position 1-9
  created_at: string;
}

export interface TugMatch {
  id: string;
  stage: TugStage;
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

// ---- Dodgeball tournament (identical shape to Tug of War, separate tables) ----
export type DodgeballStage = TugStage;
export type DodgeballState = TugState;
export type DodgeballGroupMember = TugGroupMember;

/**
 * Same shape as a tug match plus the per-round survivor counts: dodgeball awards
 * a point per opponent eliminated, and eliminations are derived from how many
 * players each side had left alive when the round ended. One entry per round;
 * NULL entries are rounds not played or not yet counted.
 */
export interface DodgeballMatch extends TugMatch {
  survivors_a: (number | null)[] | null;
  survivors_b: (number | null)[] | null;
}

export interface Event {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  scoring_type: "time_asc" | "time_desc" | "points" | "rounds";
  difficulty: "easy" | "medium" | "hard";
  scheduled_at: string | null;
  location: string | null;
  status: "upcoming" | "in_progress" | "completed";
  max_participants: number | null;
  min_points: number;
  max_points: number;
  created_by: string;
  created_at: string;
}

export interface Score {
  id: string;
  event_id: string;
  team_id: string;
  user_id: string;
  value: number;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  recorded_by: string;
  created_at: string;
  event?: Event;
  team?: Team;
  user?: User;
}

export interface LeaderboardEntry {
  team_id: string;
  team_name: string;
  team_color: string;
  team_avatar_url: string | null;
  total_points: number;
  rank: number;
  event_count: number;
}

export type ScheduleCategory = "ceremony" | "solo_event" | "team_event" | "break" | "general";

export interface ScheduleEntry {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  location: string | null;
  category: ScheduleCategory;
  event_slug: string | null;
  section: string | null;
  section_note: string | null;
  lead: string | null;
  sort_order: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface EventRuleOverride {
  slug: string;
  name: string | null;
  category: string | null;
  description: string | null;
  participants: string | null;
  attempts: string | null;
  equipment: string[] | null;
  rules: string[] | null;
  scoring: string | null;
  setup: string[] | null;
  tips: string[] | null;
  conditions: string[] | null;
  updated_by: string;
  updated_at: string;
}

export interface AuditLogEntry {
  id: string;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: Record<string, unknown> | null;
  created_at: string;
  actor?: User;
}

export interface TeamWithMembers extends Team {
  members: (TeamMember & { user: User })[];
}

export interface EventWithScores extends Event {
  scores: (Score & { team: Team; user: User })[];
}

// Database table types for Supabase
export interface Database {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: Omit<User, "created_at">;
        Update: Partial<Omit<User, "id" | "created_at">>;
      };
      teams: {
        Row: Team;
        Insert: Omit<Team, "id" | "created_at">;
        Update: Partial<Omit<Team, "id" | "created_at">>;
      };
      team_members: {
        Row: TeamMember;
        Insert: Omit<TeamMember, "id" | "joined_at">;
        Update: Partial<Omit<TeamMember, "id" | "joined_at">>;
      };
      events: {
        Row: Event;
        Insert: Omit<Event, "id" | "created_at">;
        Update: Partial<Omit<Event, "id" | "created_at">>;
      };
      scores: {
        Row: Score;
        Insert: Omit<Score, "id" | "created_at">;
        Update: Partial<Omit<Score, "id" | "created_at">>;
      };
      audit_log: {
        Row: AuditLogEntry;
        Insert: Omit<AuditLogEntry, "id" | "created_at">;
        Update: never;
      };
      schedule_entries: {
        Row: ScheduleEntry;
        Insert: Omit<ScheduleEntry, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<ScheduleEntry, "id" | "created_at">>;
      };
      event_rules: {
        Row: EventRuleOverride;
        Insert: Omit<EventRuleOverride, "updated_at"> &
          Partial<Pick<EventRuleOverride, "updated_at">>;
        Update: Partial<Omit<EventRuleOverride, "slug">>;
      };
      roster_teams: {
        Row: RosterTeam;
        Insert: Omit<RosterTeam, "id" | "created_at">;
        Update: Partial<Omit<RosterTeam, "id" | "created_at">>;
      };
      roster_players: {
        Row: RosterPlayer;
        Insert: Omit<RosterPlayer, "id" | "created_at">;
        Update: Partial<Omit<RosterPlayer, "id" | "created_at">>;
      };
      roster_checkins: {
        Row: RosterCheckin;
        Insert: Omit<RosterCheckin, "checked_in_at"> &
          Partial<Pick<RosterCheckin, "checked_in_at">>;
        Update: Partial<Omit<RosterCheckin, "player_id">>;
      };
      roster_scores: {
        Row: RosterScore;
        Insert: Omit<RosterScore, "id" | "created_at">;
        Update: Partial<Omit<RosterScore, "id" | "created_at">>;
      };
      solo_results: {
        Row: SoloResult;
        Insert: Omit<SoloResult, "id" | "created_at" | "updated_at"> &
          Partial<Pick<SoloResult, "id" | "updated_at">>;
        Update: Partial<Omit<SoloResult, "id" | "created_at">>;
      };
      tug_state: {
        Row: TugState;
        Insert: Partial<TugState> & { id: number };
        Update: Partial<Omit<TugState, "id">>;
      };
      tug_group_members: {
        Row: TugGroupMember;
        Insert: Omit<TugGroupMember, "created_at">;
        Update: Partial<Omit<TugGroupMember, "created_at">>;
      };
      tug_matches: {
        Row: TugMatch;
        Insert: Omit<TugMatch, "id" | "created_at" | "updated_at"> &
          Partial<Pick<TugMatch, "id">>;
        Update: Partial<Omit<TugMatch, "id" | "created_at">>;
      };
      dodgeball_state: {
        Row: DodgeballState;
        Insert: Partial<DodgeballState> & { id: number };
        Update: Partial<Omit<DodgeballState, "id">>;
      };
      dodgeball_group_members: {
        Row: DodgeballGroupMember;
        Insert: Omit<DodgeballGroupMember, "created_at">;
        Update: Partial<Omit<DodgeballGroupMember, "created_at">>;
      };
      dodgeball_matches: {
        Row: DodgeballMatch;
        Insert: Omit<DodgeballMatch, "id" | "created_at" | "updated_at"> &
          Partial<Pick<DodgeballMatch, "id">>;
        Update: Partial<Omit<DodgeballMatch, "id" | "created_at">>;
      };
      app_settings: {
        Row: AppSettings;
        Insert: Partial<AppSettings> & { id: number };
        Update: Partial<Omit<AppSettings, "id">>;
      };
      event_photos: {
        Row: EventPhoto;
        Insert: Omit<EventPhoto, "created_at"> & Partial<Pick<EventPhoto, "id">>;
        Update: Partial<Pick<EventPhoto, "caption">>;
      };
      wagers: {
        // Rows are only created via the place_wager RPC and mutated by triggers,
        // so Insert/Update aren't used from the client.
        Row: Wager;
        Insert: never;
        Update: never;
      };
    };
    Views: {
      mv_leaderboard: {
        Row: LeaderboardEntry;
      };
    };
  };
}
