"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Trophy,
  Users,
  Calendar,
  Bell,
  ArrowRight,
  Plus,
  Megaphone,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { TeamBadge } from "@/components/ui/team-badge";
import { ScoreCard } from "@/components/ui/score-card";
import {
  PageTransition,
  StaggerContainer,
  StaggerItem,
} from "@/components/ui/page-transition";
import type { Team, TeamMember, Event, Score, Announcement } from "@/lib/types";

export default function DashboardPage() {
  const { user, setUser } = useAppStore();
  const [myTeam, setMyTeam] = useState<(Team & { members: TeamMember[] }) | null>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [recentScores, setRecentScores] = useState<Score[]>([]);
  const [recentAnnouncements, setRecentAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (!authUser) return;

      // Load user profile
      const { data: profile } = await supabase
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .single();

      if (profile) setUser(profile);

      // Load team membership
      const { data: membership } = await supabase
        .from("team_members")
        .select("*, team:teams(*)")
        .eq("user_id", authUser.id)
        .single();

      if (membership?.team) {
        const { data: members } = await supabase
          .from("team_members")
          .select("*, user:users(*)")
          .eq("team_id", membership.team.id);

        setMyTeam({
          ...membership.team,
          members: members || [],
        });
      }

      // Load upcoming events
      const { data: events } = await supabase
        .from("events")
        .select("*")
        .gte("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(5);

      if (events) setUpcomingEvents(events);

      // Load recent scores for user's team
      if (membership?.team) {
        const { data: scores } = await supabase
          .from("scores")
          .select("*, event:events(*)")
          .eq("team_id", membership.team.id)
          .order("created_at", { ascending: false })
          .limit(5);

        if (scores) setRecentScores(scores);
      }

      // Load recent announcements
      const { data: announcements } = await supabase
        .from("announcements")
        .select("*")
        .order("published_at", { ascending: false })
        .limit(5);

      if (announcements) setRecentAnnouncements(announcements);

      setLoading(false);
    };

    loadDashboard();
  }, [setUser]);

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-coral border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <PageTransition className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-foreground">
          WELCOME BACK{user?.first_name ? `, ${user.first_name.toUpperCase()}` : user?.display_name ? `, ${user.display_name.toUpperCase()}` : ""}
        </h1>
        <p className="text-muted mt-1">
          Here&apos;s what&apos;s happening in the Neighborhood Olympics
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* My Team Card */}
          <StaggerContainer>
            <StaggerItem>
              <div className="bg-card rounded-2xl border border-border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display text-lg font-bold flex items-center gap-2">
                    <Users className="w-5 h-5 text-coral" />
                    MY TEAM
                  </h2>
                  {myTeam && (
                    <Link href={`/teams/${myTeam.id}`}>
                      <Button variant="ghost" size="sm">
                        View Team <ArrowRight className="w-4 h-4" />
                      </Button>
                    </Link>
                  )}
                </div>

                {myTeam ? (
                  <div>
                    <div className="flex items-center gap-4 mb-4">
                      <div
                        className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-xl"
                        style={{ backgroundColor: myTeam.color }}
                      >
                        {myTeam.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-display text-xl font-bold">
                          {myTeam.name}
                        </h3>
                        {myTeam.motto && (
                          <p className="text-sm text-muted italic">
                            &ldquo;{myTeam.motto}&rdquo;
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {myTeam.members.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center gap-2 bg-background rounded-lg px-3 py-1.5 text-sm"
                        >
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                            style={{ backgroundColor: myTeam.color }}
                          >
                            {(member.user as any)?.display_name?.[0] || "?"}
                          </div>
                          <span>{(member.user as any)?.display_name || "Unknown"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-muted mx-auto mb-3" />
                    <p className="text-muted mb-4">
                      You haven&apos;t joined a team yet
                    </p>
                    <div className="flex items-center justify-center gap-3">
                      <Link href="/teams/create">
                        <Button size="sm">
                          <Plus className="w-4 h-4" />
                          Create Team
                        </Button>
                      </Link>
                      <Link href="/teams">
                        <Button variant="outline" size="sm">
                          Browse Teams
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </StaggerItem>

            {/* Recent Scores */}
            <StaggerItem>
              <div className="bg-card rounded-2xl border border-border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display text-lg font-bold flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-gold" />
                    RECENT SCORES
                  </h2>
                  <Link href="/leaderboard">
                    <Button variant="ghost" size="sm">
                      Full Leaderboard <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>

                {recentScores.length > 0 ? (
                  <div className="space-y-3">
                    {recentScores.map((score) => (
                      <ScoreCard
                        key={score.id}
                        teamName={myTeam?.name || ""}
                        teamColor={myTeam?.color || "#E94560"}
                        points={score.value}
                        eventName={(score.event as any)?.name}
                        animate={false}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Trophy className="w-12 h-12 text-muted mx-auto mb-3" />
                    <p className="text-muted">No scores recorded yet</p>
                  </div>
                )}
              </div>
            </StaggerItem>
          </StaggerContainer>
        </div>

        {/* Right: Sidebar */}
        <div className="space-y-6">
          {/* Upcoming Events */}
          <div className="bg-card rounded-2xl border border-border p-6">
            <h2 className="font-display text-lg font-bold flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-info" />
              UPCOMING EVENTS
            </h2>

            {upcomingEvents.length > 0 ? (
              <div className="space-y-3">
                {upcomingEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center gap-3 p-3 bg-background rounded-xl"
                  >
                    <div className="w-10 h-10 bg-navy/10 rounded-lg flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-navy" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-sm font-bold truncate">
                        {event.name}
                      </p>
                      <p className="text-xs text-muted">
                        {event.scheduled_at
                          ? new Date(event.scheduled_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })
                          : "TBD"}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full ${
                        event.difficulty === "easy"
                          ? "bg-success/10 text-success"
                          : event.difficulty === "medium"
                          ? "bg-warning/10 text-warning"
                          : "bg-danger/10 text-danger"
                      }`}
                    >
                      {event.difficulty}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <Calendar className="w-10 h-10 text-muted mx-auto mb-2" />
                <p className="text-sm text-muted">No upcoming events</p>
              </div>
            )}
          </div>

          {/* Recent Announcements */}
          <div className="bg-card rounded-2xl border border-border p-6">
            <h2 className="font-display text-lg font-bold flex items-center gap-2 mb-4">
              <Megaphone className="w-5 h-5 text-celebration" />
              ANNOUNCEMENTS
            </h2>

            {recentAnnouncements.length > 0 ? (
              <div className="space-y-3">
                {recentAnnouncements.map((ann) => (
                  <div
                    key={ann.id}
                    className="p-3 bg-background rounded-xl"
                  >
                    <div className="flex items-start gap-2">
                      <Bell className="w-4 h-4 text-coral mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold">{ann.title}</p>
                        <p className="text-xs text-muted line-clamp-2 mt-1">
                          {ann.body}
                        </p>
                        <p className="text-[10px] text-muted mt-1">
                          {new Date(ann.published_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <Megaphone className="w-10 h-10 text-muted mx-auto mb-2" />
                <p className="text-sm text-muted">No announcements yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
