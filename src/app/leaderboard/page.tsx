"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  Filter,
  ArrowLeft,
  Calendar,
  Users,
  Clock,
  Ruler,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { LeaderboardRow } from "@/components/ui/leaderboard-row";
import { Button } from "@/components/ui/button";
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
import type { LeaderboardEntry, Event, Score, Team, User } from "@/lib/types";

interface EventScore extends Score {
  team: Team;
  user: User;
}

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  // Per-event drill-down
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventScores, setEventScores] = useState<EventScore[]>([]);
  const [eventLoading, setEventLoading] = useState(false);

  const loadLeaderboard = useCallback(async () => {
    const supabase = createClient();

    const { data: teams } = await supabase.from("teams").select("*");
    const { data: scores } = await supabase
      .from("scores")
      .select("*, event:events(id, slug)");

    if (teams && scores) {
      const scoresByEvent: Record<string, typeof scores> = {};
      for (const s of scores) {
        const eid = (s.event as any)?.id;
        if (!eid) continue;
        if (!scoresByEvent[eid]) scoresByEvent[eid] = [];
        scoresByEvent[eid].push(s);
      }

      const teamPointsMap: Record<string, number> = {};
      const teamEventsMap: Record<string, Set<string>> = {};

      for (const [eventId, eventScores] of Object.entries(scoresByEvent)) {
        const slug = (eventScores[0]?.event as any)?.slug;
        if (!slug) continue;

        const eventRule = getEventBySlug(slug);
        const mode = getScoringInputBySlug(slug);

        if (eventRule?.type === "solo") {
          const bestByTeam = new Map<string, number>();
          for (const s of eventScores) {
            const current = bestByTeam.get(s.team_id);
            if (current === undefined) {
              bestByTeam.set(s.team_id, s.value);
            } else {
              bestByTeam.set(
                s.team_id,
                mode === "time"
                  ? Math.min(current, s.value)
                  : Math.max(current, s.value)
              );
            }
          }

          const sorted = [...bestByTeam.entries()].sort(([, a], [, b]) =>
            mode === "time" ? a - b : b - a
          );

          const N = sorted.length;
          sorted.forEach(([teamId], i) => {
            const pts = N - 1 - i;
            teamPointsMap[teamId] = (teamPointsMap[teamId] ?? 0) + pts;
            if (!teamEventsMap[teamId]) teamEventsMap[teamId] = new Set();
            teamEventsMap[teamId].add(eventId);
          });
        } else {
          for (const s of eventScores) {
            teamPointsMap[s.team_id] =
              (teamPointsMap[s.team_id] ?? 0) + s.value;
            if (!teamEventsMap[s.team_id])
              teamEventsMap[s.team_id] = new Set();
            teamEventsMap[s.team_id].add(eventId);
          }
        }
      }

      const teamScores = teams.map((team) => ({
        team_id: team.id,
        team_name: team.name,
        team_color: team.color,
        team_avatar_url: team.avatar_url,
        total_points: teamPointsMap[team.id] ?? 0,
        event_count: teamEventsMap[team.id]?.size ?? 0,
        rank: 0,
      }));

      teamScores.sort((a, b) => b.total_points - a.total_points);
      teamScores.forEach((entry, index) => {
        entry.rank = index + 1;
      });

      setLeaderboard(teamScores);
    }

    const { data: eventsData } = await supabase
      .from("events")
      .select("*")
      .order("name");
    if (eventsData) setEvents(eventsData);

    setLoading(false);
  }, []);

  const loadEventScores = useCallback(
    async (eventId: string) => {
      setEventLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("scores")
        .select("*, team:teams(*), user:users(*)")
        .eq("event_id", eventId);
      setEventScores((data as any) ?? []);
      setEventLoading(false);
    },
    []
  );

  function selectEvent(eventId: string) {
    setSelectedEventId(eventId);
    loadEventScores(eventId);
  }

  function clearEvent() {
    setSelectedEventId(null);
    setEventScores([]);
  }

  useEffect(() => {
    loadLeaderboard();
    const handler = () => {
      loadLeaderboard();
      if (selectedEventId) loadEventScores(selectedEventId);
    };
    window.addEventListener("scores-updated", handler);
    return () => window.removeEventListener("scores-updated", handler);
  }, [loadLeaderboard, loadEventScores, selectedEventId]);

  const selectedEvent = events.find((e) => e.id === selectedEventId) ?? null;

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

          {leaderboard.length > 0 && !selectedEventId && (
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
                  {leaderboard
                    .reduce((sum, e) => sum + e.total_points, 0)
                    .toLocaleString()}
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

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Event filter buttons */}
        {events.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-6">
            {selectedEventId ? (
              <button
                onClick={clearEvent}
                className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors mr-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Overall
              </button>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted mr-2">
                <Filter className="w-4 h-4" />
                Per-event:
              </div>
            )}
            {events.map((event) => (
              <Button
                key={event.id}
                variant={selectedEventId === event.id ? "primary" : "outline"}
                size="sm"
                onClick={() =>
                  selectedEventId === event.id
                    ? clearEvent()
                    : selectEvent(event.id)
                }
              >
                {event.name}
              </Button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-coral border-t-transparent rounded-full animate-spin" />
          </div>
        ) : selectedEventId && selectedEvent ? (
          /* ---- Per-event view ---- */
          <EventView
            event={selectedEvent}
            scores={eventScores}
            loading={eventLoading}
          />
        ) : leaderboard.length > 0 ? (
          /* ---- Overall leaderboard ---- */
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

/* ------------------------------------------------------------------ */
/*  Per-event inline view                                              */
/* ------------------------------------------------------------------ */

function EventView({
  event,
  scores,
  loading,
}: {
  event: Event;
  scores: EventScore[];
  loading: boolean;
}) {
  const mode: ScoringInput = getScoringInputBySlug(event.slug);
  const isMeasurement = mode === "time" || mode === "distance";
  const eventRule = getEventBySlug(event.slug);
  const isSoloEvent = eventRule?.type === "solo";
  const showIndividualRanking = isSoloEvent || isMeasurement;

  const rankedIndividuals = showIndividualRanking
    ? [...scores]
        .sort((a, b) =>
          mode === "time" ? a.value - b.value : b.value - a.value
        )
        .map((score, index) => ({ ...score, rank: index + 1 }))
    : [];

  const teamPlacements = new Map<
    string,
    { rank: number; points: number; team: Team }
  >();

  if (isSoloEvent && scores.length > 0) {
    const bestByTeam = new Map<string, { value: number; team: Team }>();
    for (const score of scores) {
      const current = bestByTeam.get(score.team_id);
      if (!current) {
        bestByTeam.set(score.team_id, {
          value: score.value,
          team: score.team,
        });
      } else {
        const isBetter =
          mode === "time"
            ? score.value < current.value
            : score.value > current.value;
        if (isBetter) {
          bestByTeam.set(score.team_id, {
            value: score.value,
            team: score.team,
          });
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

  const teamScores = !showIndividualRanking
    ? scores.reduce<
        Record<
          string,
          {
            team: Team;
            totalPoints: number;
            playerCount: number;
            scores: EventScore[];
          }
        >
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
      }, {})
    : {};

  const rankedTeams = Object.values(teamScores)
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-coral border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Event info bar */}
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="font-display text-xl font-bold text-foreground">
              {event.name}
            </h2>
            {event.description && (
              <p className="text-sm text-muted mt-1">{event.description}</p>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs text-muted">
            {isMeasurement && (
              <span className="inline-flex items-center gap-1 bg-background rounded-full px-3 py-1.5 font-medium">
                {mode === "time" ? (
                  <Clock className="w-3 h-3" />
                ) : (
                  <Ruler className="w-3 h-3" />
                )}
                Ranked by{" "}
                {mode === "time" ? "fastest time" : "longest distance"}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {scores.length} scores
            </span>
          </div>
        </div>
      </div>

      {showIndividualRanking && rankedIndividuals.length > 0 ? (
        <>
          {/* Solo: team placement points */}
          {isSoloEvent && teamPlacements.size > 0 && (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-3 bg-background border-b border-border">
                <h3 className="font-display text-xs font-bold text-muted uppercase tracking-wider">
                  Team Standings — Placement Points
                </h3>
              </div>
              <div className="divide-y divide-border">
                {[...teamPlacements.entries()]
                  .sort(([, a], [, b]) => a.rank - b.rank)
                  .map(([teamId, { rank, points, team }]) => {
                    const medal =
                      rank === 1
                        ? "🥇"
                        : rank === 2
                        ? "🥈"
                        : rank === 3
                        ? "🥉"
                        : null;
                    return (
                      <div
                        key={teamId}
                        className={`flex items-center justify-between px-4 py-3 ${
                          rank <= 3 ? "bg-gold/5" : ""
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-lg font-bold text-muted w-10">
                            {medal ?? `#${rank}`}
                          </span>
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: team.color }}
                          />
                          <span className="font-medium text-foreground">
                            {team.name}
                          </span>
                        </div>
                        <span
                          className="font-mono text-lg font-bold"
                          style={{ color: team.color }}
                        >
                          {points} pt{points !== 1 ? "s" : ""}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Individual results table */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
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
                      score.rank === 1
                        ? "🥇"
                        : score.rank === 2
                        ? "🥈"
                        : score.rank === 3
                        ? "🥉"
                        : null;
                    const placement = teamPlacements.get(score.team_id);

                    return (
                      <tr
                        key={score.id}
                        className={`hover:bg-background/50 ${
                          score.rank <= 3 ? "bg-gold/5" : ""
                        }`}
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
                            {isMeasurement
                              ? formatDbValue(score.value, mode)
                              : score.value}
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
        </>
      ) : !showIndividualRanking && rankedTeams.length > 0 ? (
        <StaggerContainer className="space-y-6">
          {rankedTeams.map((entry) => (
            <StaggerItem key={entry.team.id}>
              <div className="bg-card rounded-xl border border-border overflow-hidden">
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
    </motion.div>
  );
}
