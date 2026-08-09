"use client";
import { SkeletonList } from "@/components/ui/skeleton";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Users, ArrowLeft, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  PageTransition,
  StaggerContainer,
  StaggerItem,
} from "@/components/ui/page-transition";
import {
  fetchRosterData,
  playerPointsMap,
  activeTeamSizes,
  type RosterData,
} from "@/lib/roster";
import { fetchSoloResults } from "@/lib/solo";
import { computeStandings } from "@/lib/standings";
import { fetchTiebreaks, type Tiebreak } from "@/lib/tiebreak";
import { fetchTugData, type TugData } from "@/lib/tug";
import { fetchDodgeballData, type DodgeballData } from "@/lib/dodgeball";
import { readableTextColor } from "@/lib/colors";
import { useLeaderboardVisibility } from "@/lib/useLeaderboardVisibility";
import {
  LeaderboardHiddenLine,
  LeaderboardHiddenBanner,
} from "@/components/leaderboard/hidden-notice";
import type { RosterTeam, SoloResult } from "@/lib/types";

export default function TeamProfilePage() {
  const params = useParams();
  const teamId = params.id as string;

  const [data, setData] = useState<RosterData | null>(null);
  // Everything the team total is made of beyond its roster_scores rows: the
  // solo top-3 bonus and both tournaments. Without these the header would
  // under-report against the leaderboard.
  const [solo, setSolo] = useState<SoloResult[]>([]);
  const [tiebreaks, setTiebreaks] = useState<Tiebreak[]>([]);
  const [tug, setTug] = useState<TugData | null>(null);
  const [dodge, setDodge] = useState<DodgeballData | null>(null);
  const [loading, setLoading] = useState(true);
  // The admin switch that takes the standings off the public site. Here it
  // covers the team total, the per-player points and the score breakdown — the
  // roster itself stays up. See src/lib/settings.ts.
  const visibility = useLeaderboardVisibility();

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const [roster, soloResults, tiebreakRows, tugData, dodgeData] =
        await Promise.all([
          fetchRosterData(supabase),
          fetchSoloResults(supabase),
          fetchTiebreaks(supabase),
          fetchTugData(supabase),
          fetchDodgeballData(supabase),
        ]);
      setData(roster);
      setSolo(soloResults);
      setTiebreaks(tiebreakRows);
      setTug(tugData);
      setDodge(dodgeData);
      setLoading(false);
    };
    load();
  }, []);

  const team: RosterTeam | undefined = data?.teams.find((t) => t.id === teamId);
  const players = useMemo(
    () => (data?.players ?? []).filter((p) => p.team_id === teamId),
    [data, teamId]
  );
  const teamScores = useMemo(
    () => (data?.scores ?? []).filter((s) => s.team_id === teamId),
    [data, teamId]
  );
  const perPlayer = useMemo(() => playerPointsMap(teamScores), [teamScores]);
  // The same number the leaderboard shows — scores, solo bonus and tournament
  // points — rather than a local sum of this team's score rows.
  const standing = useMemo(() => {
    if (!data) return null;
    const { teams } = computeStandings(data.teams, data.scores, solo, tiebreaks, {
      tug: tug?.matches,
      dodgeball: dodge?.matches,
      teamSizes: activeTeamSizes(data.players),
    });
    return teams.find((s) => s.team.id === teamId) ?? null;
  }, [data, solo, tiebreaks, tug, dodge, teamId]);
  const totalPoints = standing?.totalPoints ?? 0;

  const playerNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of data?.players ?? []) map.set(p.id, p.name);
    return map;
  }, [data]);

  const showPoints = visibility.canView;

  if (loading || visibility.loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <SkeletonList rows={6} />
      </div>
    );
  }

  if (!team) {
    return (
      <PageTransition className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/teams"
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Teams
        </Link>
        <div className="text-center py-20">
          <Users className="w-16 h-16 text-muted mx-auto mb-4" />
          <h3 className="font-display text-xl font-bold text-foreground mb-2">
            TEAM NOT FOUND
          </h3>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href="/teams"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Teams
      </Link>

      {visibility.isAdminPreview && <LeaderboardHiddenBanner className="mb-6" />}

      {/* Team Header */}
      <div
        className="relative rounded-2xl overflow-hidden mb-8"
        style={{ backgroundColor: team.color + "15" }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-2"
          style={{ backgroundColor: team.color }}
        />
        <div className="p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center font-bold text-3xl shadow-lg"
              style={{
                backgroundColor: team.color,
                color: readableTextColor(team.color),
              }}
            >
              {team.name.charAt(0).toUpperCase()}
            </div>

            <div className="flex-1">
              <h1 className="font-display text-3xl font-bold text-foreground">
                {team.name}
              </h1>
              <div className="flex items-center gap-4 mt-3">
                <span className="flex items-center gap-1 text-sm text-muted">
                  <Users className="w-4 h-4" />
                  {players.length} members
                </span>
                {showPoints && (
                  <span className="flex items-center gap-1 text-sm text-muted">
                    <Trophy className="w-4 h-4" />
                    {totalPoints} points
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Roster */}
        <div className="bg-card rounded-2xl border border-border p-6">
          <h2 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-coral" />
            ROSTER
          </h2>
          <StaggerContainer className="space-y-3">
            {players.map((player) => {
              const pts = perPlayer.get(player.id) ?? 0;
              return (
                <StaggerItem key={player.id}>
                  <div className="flex items-center gap-3 p-3 bg-background rounded-xl">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                      style={{
                        backgroundColor: player.is_active
                          ? team.color
                          : "#94A3B8",
                        color: readableTextColor(
                          player.is_active ? team.color : "#94A3B8"
                        ),
                      }}
                    >
                      {player.name[0]?.toUpperCase() || "?"}
                    </div>
                    <p
                      className={`flex-1 text-sm font-semibold truncate ${
                        player.is_active
                          ? ""
                          : "line-through text-muted"
                      }`}
                    >
                      {player.name}
                    </p>
                    {showPoints && pts > 0 && (
                      <span
                        className="font-mono text-sm font-bold shrink-0"
                        style={{ color: team.color }}
                      >
                        {pts}
                      </span>
                    )}
                  </div>
                </StaggerItem>
              );
            })}
            {players.length === 0 && (
              <p className="text-sm text-muted text-center py-6">
                No members yet.
              </p>
            )}
          </StaggerContainer>
        </div>

        {/* Team Scores */}
        <div className="lg:col-span-2 bg-card rounded-2xl border border-border p-6">
          <h2 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-gold" />
            SCORES
          </h2>
          {!showPoints ? (
            // The breakdown is the standings in longhand — one row per point
            // awarded — so it goes with them.
            <div className="py-12">
              <LeaderboardHiddenLine className="justify-center text-center">
                Scores are hidden while the leaderboard is under wraps. Results
                are still being recorded.
              </LeaderboardHiddenLine>
            </div>
          ) : teamScores.length > 0 ? (
            <div className="space-y-3">
              {teamScores.map((score) => (
                <div
                  key={score.id}
                  className="flex items-center justify-between bg-background rounded-xl px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {score.label}
                    </p>
                    <p className="text-xs text-muted">
                      {score.player_id
                        ? playerNameById.get(score.player_id) ?? "Player"
                        : "Team"}
                    </p>
                  </div>
                  <span
                    className="font-mono text-lg font-bold shrink-0"
                    style={{ color: team.color }}
                  >
                    {score.points > 0 ? "+" : ""}
                    {score.points}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Trophy className="w-12 h-12 text-muted mx-auto mb-3" />
              <p className="text-muted">No scores recorded yet</p>
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
