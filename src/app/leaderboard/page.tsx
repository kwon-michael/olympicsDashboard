"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, TrendingUp, Filter } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { LeaderboardRow } from "@/components/ui/leaderboard-row";
import { Button } from "@/components/ui/button";
import {
  PageTransition,
  StaggerContainer,
  StaggerItem,
} from "@/components/ui/page-transition";
import type { LeaderboardEntry, Event } from "@/lib/types";

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLeaderboard = useCallback(async () => {
    const supabase = createClient();

    // Try materialized view first, fallback to computed query
    const { data: mvData, error: mvError } = await supabase
      .from("mv_leaderboard")
      .select("*")
      .order("rank", { ascending: true });

    if (mvData && !mvError) {
      setLeaderboard(mvData);
    } else {
      // Fallback: compute leaderboard from scores
      const { data: teams } = await supabase.from("teams").select("*");
      const { data: scores } = await supabase.from("scores").select("*");

      if (teams && scores) {
        const teamScores = teams.map((team) => {
          const teamScoreList = scores.filter((s) => s.team_id === team.id);
          return {
            team_id: team.id,
            team_name: team.name,
            team_color: team.color,
            team_avatar_url: team.avatar_url,
            total_points: teamScoreList.reduce((sum, s) => sum + s.value, 0),
            event_count: new Set(teamScoreList.map((s) => s.event_id)).size,
            rank: 0,
          };
        });

        teamScores.sort((a, b) => b.total_points - a.total_points);
        teamScores.forEach((entry, index) => {
          entry.rank = index + 1;
        });

        setLeaderboard(teamScores);
      }
    }

    // Load events for filter
    const { data: eventsData } = await supabase
      .from("events")
      .select("*")
      .order("name");
    if (eventsData) setEvents(eventsData);

    setLoading(false);
  }, []);

  useEffect(() => {
    loadLeaderboard();

    // Listen for real-time score updates
    const handler = () => loadLeaderboard();
    window.addEventListener("scores-updated", handler);
    return () => window.removeEventListener("scores-updated", handler);
  }, [loadLeaderboard]);

  return (
    <PageTransition>
      {/* Header */}
      <div className="bg-navy text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-2 mb-4">
              <Trophy className="w-4 h-4 text-gold" />
              <span className="text-sm font-medium text-white/80">
                Live Standings
              </span>
            </div>
            <h1 className="font-display text-4xl sm:text-5xl font-bold">
              LEADERBOARD
            </h1>
            <p className="mt-3 text-white/60 max-w-lg mx-auto">
              Real-time rankings updated as scores come in. Watch your team
              climb to the top!
            </p>
          </div>

          {/* Summary stats */}
          {leaderboard.length > 0 && (
            <div className="flex items-center justify-center gap-8 mt-8">
              <div className="text-center">
                <p className="font-mono text-3xl font-bold text-gold">
                  {leaderboard.length}
                </p>
                <p className="text-xs text-white/50 uppercase tracking-wider">
                  Teams
                </p>
              </div>
              <div className="w-px h-10 bg-white/20" />
              <div className="text-center">
                <p className="font-mono text-3xl font-bold text-coral">
                  {leaderboard.reduce((sum, e) => sum + e.total_points, 0).toLocaleString()}
                </p>
                <p className="text-xs text-white/50 uppercase tracking-wider">
                  Total Points
                </p>
              </div>
              <div className="w-px h-10 bg-white/20" />
              <div className="text-center">
                <p className="font-mono text-3xl font-bold text-white">
                  {events.length}
                </p>
                <p className="text-xs text-white/50 uppercase tracking-wider">
                  Events
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Leaderboard */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Event filter buttons */}
        {events.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            <div className="flex items-center gap-2 text-sm text-muted mr-2">
              <Filter className="w-4 h-4" />
              Per-event:
            </div>
            {events.map((event) => (
              <Link key={event.id} href={`/leaderboard/${event.id}`}>
                <Button variant="outline" size="sm">
                  {event.name}
                </Button>
              </Link>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-coral border-t-transparent rounded-full animate-spin" />
          </div>
        ) : leaderboard.length > 0 ? (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {leaderboard.map((entry) => (
                <LeaderboardRow
                  key={entry.team_id}
                  rank={entry.rank}
                  teamName={entry.team_name}
                  teamColor={entry.team_color}
                  teamAvatarUrl={entry.team_avatar_url}
                  totalPoints={entry.total_points}
                  eventCount={entry.event_count}
                />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="text-center py-20">
            <Trophy className="w-16 h-16 text-muted mx-auto mb-4" />
            <h3 className="font-display text-xl font-bold text-foreground mb-2">
              NO SCORES YET
            </h3>
            <p className="text-muted">
              The leaderboard will light up once the games begin!
            </p>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
