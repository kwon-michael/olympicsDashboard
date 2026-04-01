"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Trophy, ArrowLeft, Calendar, Users, Clock, Ruler } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  PageTransition,
  StaggerContainer,
  StaggerItem,
} from "@/components/ui/page-transition";
import {
  getScoringInputBySlug,
  formatDbValue,
  getUnitLabel,
  getEventBySlug,
  type ScoringInput,
} from "@/lib/events";
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
      .eq("event_id", eventId);

    if (scoresData) setScores(scoresData as any);
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    loadData();
    const handler = () => loadData();
    window.addEventListener("scores-updated", handler);
    return () => window.removeEventListener("scores-updated", handler);
  }, [loadData]);

  // Determine scoring mode from the event's slug (ties to rules page)
  const mode: ScoringInput = event ? getScoringInputBySlug(event.slug) : "points";
  const isMeasurement = mode === "time" || mode === "distance";
  const eventRule = event ? getEventBySlug(event.slug) : undefined;
  const isSoloEvent = eventRule?.type === "solo";

  // Solo events (any mode) and team measurement events: rank individual scores
  const showIndividualRanking = isSoloEvent || isMeasurement;

  const rankedIndividuals = showIndividualRanking
    ? [...scores]
        .sort((a, b) => (mode === "time" ? a.value - b.value : b.value - a.value))
        .map((score, index) => ({ ...score, rank: index + 1 }))
    : [];

  // Solo events: compute placement-based team points
  // 1st place team = N-1 points, last = 0
  const teamPlacements = new Map<string, { rank: number; points: number; team: Team }>();

  if (isSoloEvent && scores.length > 0) {
    const bestByTeam = new Map<string, { value: number; team: Team }>();
    for (const score of scores) {
      const current = bestByTeam.get(score.team_id);
      if (!current) {
        bestByTeam.set(score.team_id, { value: score.value, team: score.team });
      } else {
        const isBetter = mode === "time"
          ? score.value < current.value
          : score.value > current.value;
        if (isBetter) {
          bestByTeam.set(score.team_id, { value: score.value, team: score.team });
        }
      }
    }

    const sorted = [...bestByTeam.entries()].sort(([, a], [, b]) =>
      mode === "time" ? a.value - b.value : b.value - a.value
    );

    const N = sorted.length;
    sorted.forEach(([teamId, { team }], i) => {
      teamPlacements.set(teamId, { rank: i + 1, points: N - 1 - i, team });
    });
  }

  // For team points-based events: aggregate by team
  const teamScores = !showIndividualRanking
    ? scores.reduce<
        Record<string, { team: Team; totalPoints: number; playerCount: number; scores: EventScore[] }>
      >((acc, score) => {
        const teamId = score.team_id;
        if (!acc[teamId]) {
          acc[teamId] = { team: score.team, totalPoints: 0, playerCount: 0, scores: [] };
        }
        acc[teamId].totalPoints += score.value;
        acc[teamId].playerCount++;
        acc[teamId].scores.push(score);
        return acc;
      }, {})
    : {};

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
                {isMeasurement && (
                  <span className="inline-flex items-center gap-1 text-xs text-white/50 uppercase tracking-wider bg-white/10 rounded-full px-2.5 py-0.5">
                    {mode === "time" ? (
                      <Clock className="w-3 h-3" />
                    ) : (
                      <Ruler className="w-3 h-3" />
                    )}
                    Ranked by {mode === "time" ? "fastest time" : "longest distance"}
                  </span>
                )}
              </div>

              <h1 className="font-display text-4xl sm:text-5xl font-bold">
                {event.name}
              </h1>

              {event.description && (
                <p className="mt-3 text-white/60 max-w-lg">{event.description}</p>
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
        ) : showIndividualRanking && rankedIndividuals.length > 0 ? (
          /* ---- Individual ranking (solo events + team measurement events) ---- */
          <div className="space-y-6">
            {/* Team Standings – placement points (solo events only) */}
            {isSoloEvent && teamPlacements.size > 0 && (
              <div className="bg-card rounded-2xl border border-border overflow-hidden">
                <div className="px-4 py-3 bg-background border-b border-border">
                  <h3 className="font-display text-sm font-bold text-foreground uppercase tracking-wider">
                    Team Standings — Placement Points
                  </h3>
                </div>
                <div className="divide-y divide-border">
                  {[...teamPlacements.entries()]
                    .sort(([, a], [, b]) => a.rank - b.rank)
                    .map(([teamId, { rank, points, team }]) => {
                      const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
                      return (
                        <div key={teamId} className={`flex items-center justify-between px-4 py-3 ${rank <= 3 ? "bg-gold/5" : ""}`}>
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-lg font-bold text-muted w-10">
                              {medal ?? `#${rank}`}
                            </span>
                            <span
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: team.color }}
                            />
                            <span className="font-medium text-foreground">{team.name}</span>
                          </div>
                          <span className="font-mono text-lg font-bold" style={{ color: team.color }}>
                            {points} pt{points !== 1 ? "s" : ""}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Individual Results Table */}
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-background border-b border-border">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase w-16">
                        Rank
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase">
                        Participant
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase">
                        Team
                      </th>
                      <th className="text-right px-4 py-3 font-semibold text-muted text-xs uppercase">
                        {isMeasurement ? getUnitLabel(mode) : "Score"}
                      </th>
                      {isSoloEvent && (
                        <th className="text-right px-4 py-3 font-semibold text-muted text-xs uppercase">
                          Team Pts
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rankedIndividuals.map((score) => {
                      const medal =
                        score.rank === 1 ? "🥇" : score.rank === 2 ? "🥈" : score.rank === 3 ? "🥉" : null;
                      const placement = teamPlacements.get(score.team_id);

                      return (
                        <tr
                          key={score.id}
                          className={`hover:bg-background/50 ${score.rank <= 3 ? "bg-gold/5" : ""}`}
                        >
                          <td className="px-4 py-3">
                            <span className="font-mono text-lg font-bold text-muted">
                              {medal ?? `#${score.rank}`}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                                style={{ backgroundColor: score.team.color }}
                              >
                                {(score.user?.display_name ?? "?").charAt(0)}
                              </div>
                              <span className="font-medium text-foreground">
                                {score.user?.display_name ?? "Unknown"}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="flex items-center gap-1.5">
                              <span
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: score.team.color }}
                              />
                              {score.team.name}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className="font-mono text-lg font-bold"
                              style={{ color: score.team.color }}
                            >
                              {isMeasurement ? formatDbValue(score.value, mode) : score.value}
                            </span>
                          </td>
                          {isSoloEvent && placement && (
                            <td className="px-4 py-3 text-right">
                              <span className="font-mono text-sm font-bold text-gold">
                                {placement.points}
                              </span>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : !showIndividualRanking && rankedTeams.length > 0 ? (
          /* ---- Team points-based leaderboard: team aggregation ---- */
          <StaggerContainer className="space-y-6">
            {rankedTeams.map((entry) => (
              <StaggerItem key={entry.team.id}>
                <div className="bg-card rounded-2xl border border-border overflow-hidden">
                  <div className="h-1" style={{ backgroundColor: entry.team.color }} />
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
                          <p className="font-display text-lg font-bold">{entry.team.name}</p>
                          <p className="text-xs text-muted">{entry.playerCount} player scores</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-2xl font-bold" style={{ color: entry.team.color }}>
                          {entry.totalPoints.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-muted uppercase tracking-wider">Total Points</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {entry.scores.map((score) => (
                        <div
                          key={score.id}
                          className="flex items-center justify-between bg-background rounded-lg px-3 py-2"
                        >
                          <span className="text-sm">{score.user?.display_name || "Unknown"}</span>
                          <span className="font-mono text-sm font-bold" style={{ color: entry.team.color }}>
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
            <h3 className="font-display text-xl font-bold text-foreground mb-2">NO SCORES YET</h3>
            <p className="text-muted">Scores will appear here once the event begins</p>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
