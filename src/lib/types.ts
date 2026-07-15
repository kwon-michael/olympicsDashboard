export type UserRole = "participant" | "admin";

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

export interface RosterPlayer {
  id: string;
  team_id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface RosterScore {
  id: string;
  team_id: string;
  player_id: string | null;
  label: string;
  points: number;
  created_by: string | null;
  created_at: string;
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
      roster_scores: {
        Row: RosterScore;
        Insert: Omit<RosterScore, "id" | "created_at">;
        Update: Partial<Omit<RosterScore, "id" | "created_at">>;
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
    };
    Views: {
      mv_leaderboard: {
        Row: LeaderboardEntry;
      };
    };
  };
}
