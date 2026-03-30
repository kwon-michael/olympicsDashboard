export type UserRole = "participant" | "admin";

export interface User {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  role: UserRole;
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

export type AnnouncementType =
  | "general"
  | "event_starting"
  | "score_update"
  | "urgent"
  | "celebration";

export interface Announcement {
  id: string;
  title: string;
  body: string;
  type: AnnouncementType;
  image_url: string | null;
  author_id: string;
  published_at: string;
  scheduled_for: string | null;
  created_at: string;
  author?: User;
}

export interface AnnouncementRead {
  id: string;
  announcement_id: string;
  user_id: string;
  read_at: string;
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
      announcements: {
        Row: Announcement;
        Insert: Omit<Announcement, "id" | "created_at">;
        Update: Partial<Omit<Announcement, "id" | "created_at">>;
      };
      announcement_reads: {
        Row: AnnouncementRead;
        Insert: Omit<AnnouncementRead, "id" | "read_at">;
        Update: Partial<Omit<AnnouncementRead, "id" | "read_at">>;
      };
      audit_log: {
        Row: AuditLogEntry;
        Insert: Omit<AuditLogEntry, "id" | "created_at">;
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
