"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, ArrowLeft, Calendar, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ScoreCard } from "@/components/ui/score-card";
import {
  PageTransition,
  StaggerContainer,
  StaggerItem,
} from "@/components/ui/page-transition";
import type { Event, Score, Team, User } from "@/lib/types";

interface EventScore extends Score {
  team: Team;
  user: User;
}

export default function EventLeaderboardPage() {
  const params = useParams();
  const eventId = params.eventId as string;
  const [event, setEvent] = useState<Event | null>(null);
  const [scores, setScores] = useState<EventScore[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const supabase = createClient();

    const { data: eventData } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .single();

    if (eventData) setEvent(eventData);

    const { data: scoresData } = await supabase
      .from("scores")
      .select("*, team:teams(*), user:users(*)")
      .eq("event_id", eventId)
      .order("value", { ascending: false });

    if (scoresData) setScores(scoresData as any);
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    loadData();
    const handler = () => loadData();
    window.addEventListener("scores-updated", handler);
    return () => window.removeEventListener("scores-updated", handler);
  }, [loadData]);

  // Aggregate by team
  const teamScores = scores.reduce<
    Record<string, { team: Team; totalPoints: number; playerCount: number; scores: EventScore[] }>
  >((acc, score) => {
    const teamId = score.team_id;
    if (!acc[teamId]) {
      acc[teamId] = {
        team: score.team,
        totalPoints: 0,
        playerCount: 0,
        scores: [],
      };
    }
    acc[teamId].totalPoints += score.value;
    acc[teamId].playerCount++;
    acc[teamId].scores.push(score);
    return acc;
  }, {});

  const rankedTeams = Object.values(teamScores)
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  return (
    <PageTransition>
      {/* Header */}
      <div className="bg-navy text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Link
            href="/leaderboard"
            className="inline-flex items-center gap-1 text-sm text-white/60 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Overall Leaderboard
          </Link>

          {event && (
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span
                  className={`text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full ${
                    event.difficulty === "easy"
                      ? "bg-success/20 text-success"
                      : event.difficulty === "medium"
                      ? "bg-warning/20 text-warning"
                      : "bg-danger/20 text-danger"
                  }`}
                >
                  {event.difficulty}
                </span>
                <span className="text-xs text-white/50 uppercase tracking-wider">
                  {event.category}
                </span>
              </div>

              <h1 className="font-display text-4xl sm:text-5xl font-bold">
                {event.name}
              </h1>

              {event.description && (
                <p className="mt-3 text-white/60 max-w-lg">
                  {event.description}
                </p>
              )}

              <div className="flex items-center gap-6 mt-4">
                {event.scheduled_at && (
                  <span className="flex items-center gap-1.5 text-sm text-white/50">
                    <Calendar className="w-4 h-4" />
                    {new Date(event.scheduled_at).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                )}
                <span className="flex items-center gap-1.5 text-sm text-white/50">
                  <Users className="w-4 h-4" />
                  {scores.length} scores recorded
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Scores */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-coral border-t-transparent rounded-full animate-spin" />
          </div>
        ) : rankedTeams.length > 0 ? (
          <StaggerContainer className="space-y-6">
            {rankedTeams.map((entry) => (
              <StaggerItem key={entry.team.id}>
                <div className="bg-card rounded-2xl border border-border overflow-hidden">
                  <div
                    className="h-1"
                    style={{ backgroundColor: entry.team.color }}
                  />
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-2xl font-bold text-muted">
                          #{entry.rank}
                        </span>
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                          style={{ backgroundColor: entry.team.color }}
                        >
                          {entry.team.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-display text-lg font-bold">
                            {entry.team.name}
                          </p>
                          <p className="text-xs text-muted">
                            {entry.playerCount} player scores
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p
                          className="font-mono text-2xl font-bold"
                          style={{ color: entry.team.color }}
                        >
                          {entry.totalPoints.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-muted uppercase tracking-wider">
                          Total Points
                        </p>
                      </div>
                    </div>

                    {/* Individual scores */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {entry.scores.map((score) => (
                        <div
                          key={score.id}
                          className="flex items-center justify-between bg-background rounded-lg px-3 py-2"
                        >
                          <span className="text-sm">
                            {score.user?.display_name || "Unknown"}
                          </span>
                          <span
                            className="font-mono text-sm font-bold"
                            style={{ color: entry.team.color }}
                          >
                            {score.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        ) : (
          <div className="text-center py-20">
            <Trophy className="w-16 h-16 text-muted mx-auto mb-4" />
            <h3 className="font-display text-xl font-bold text-foreground mb-2">
              NO SCORES YET
            </h3>
            <p className="text-muted">
              Scores will appear here once the event begins
            </p>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
