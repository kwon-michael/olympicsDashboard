"use client";
import { SkeletonList } from "@/components/ui/skeleton";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Users, Star, Medal, Zap, Swords, CircleDot } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageTransition } from "@/components/ui/page-transition";
import { getMedalEmoji } from "@/lib/utils";
import {
  fetchRosterData,
  computeTeamStandings,
  computePlayerStandings,
  type RosterData,
} from "@/lib/roster";
import {
  fetchSoloResults,
  computeSoloTeamStandings,
  computeEventStandings,
  soloBonusByTeam,
} from "@/lib/solo";
import { soloEvents, getScoringInputBySlug, getUnitLabel } from "@/lib/events";
import { readableTextColor } from "@/lib/colors";
import { fetchTugData, type TugData } from "@/lib/tug";
import { fetchDodgeballData, type DodgeballData } from "@/lib/dodgeball";
import { TugGroups } from "@/components/tug/tug-groups";
import { TugBracket } from "@/components/tug/tug-bracket";
import { TournamentGroups } from "@/components/tournament/tournament-groups";
import { TournamentBracket } from "@/components/tournament/tournament-bracket";
import type { SoloResult } from "@/lib/types";

type Tab = "teams" | "solo" | "events" | "players" | "tug" | "dodgeball";

const TABS: Tab[] = ["teams", "solo", "events", "players", "tug", "dodgeball"];

function initialTab(): Tab {
  if (typeof window !== "undefined") {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t && (TABS as string[]).includes(t)) return t as Tab;
  }
  return "teams";
}

export default function LeaderboardPage() {
  const [data, setData] = useState<RosterData | null>(null);
  const [solo, setSolo] = useState<SoloResult[]>([]);
  const [tug, setTug] = useState<TugData | null>(null);
  const [dodge, setDodge] = useState<DodgeballData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [eventSlug, setEventSlug] = useState<string>(soloEvents[0].slug);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [roster, soloResults, tugData, dodgeData] = await Promise.all([
      fetchRosterData(supabase),
      fetchSoloResults(supabase),
      fetchTugData(supabase),
      fetchDodgeballData(supabase),
    ]);
    setData(roster);
    setSolo(soloResults);
    setTug(tugData);
    setDodge(dodgeData);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener("scores-updated", handler);
    return () => window.removeEventListener("scores-updated", handler);
  }, [load]);

  const soloStandings = useMemo(
    () => (data ? computeSoloTeamStandings(solo, data.teams) : []),
    [data, solo]
  );
  const bonusByTeam = useMemo(() => soloBonusByTeam(soloStandings), [soloStandings]);

  const teamStandings = useMemo(
    () => (data ? computeTeamStandings(data.teams, data.scores, bonusByTeam) : []),
    [data, bonusByTeam]
  );
  const playerStandings = useMemo(
    () =>
      data
        ? computePlayerStandings(data.teams, data.players, data.scores)
        : [],
    [data]
  );
  const eventRows = useMemo(
    () =>
      data ? computeEventStandings(eventSlug, solo, data.teams, data.players) : [],
    [data, solo, eventSlug]
  );

  const totalPoints = teamStandings.reduce((sum, s) => sum + s.totalPoints, 0);

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

          {!loading && teamStandings.length > 0 && (
            <div className="flex items-center justify-center gap-6 sm:gap-8 mt-8">
              <div className="text-center">
                <p className="font-mono text-3xl font-bold text-gold">
                  {teamStandings.length}
                </p>
                <p className="text-xs text-white/50 uppercase tracking-wider">
                  Teams
                </p>
              </div>
              <div className="w-px h-10 bg-white/20" />
              <div className="text-center">
                <p className="font-mono text-3xl font-bold text-coral">
                  {totalPoints.toLocaleString()}
                </p>
                <p className="text-xs text-white/50 uppercase tracking-wider">
                  Team Points
                </p>
              </div>
              <div className="w-px h-10 bg-white/20" />
              <div className="text-center">
                <p className="font-mono text-3xl font-bold text-white">
                  {solo.length}
                </p>
                <p className="text-xs text-white/50 uppercase tracking-wider">
                  Solo Results
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-6">
          <TabButton
            active={tab === "teams"}
            onClick={() => setTab("teams")}
            icon={<Users className="w-4 h-4" />}
            label="Teams"
          />
          <TabButton
            active={tab === "solo"}
            onClick={() => setTab("solo")}
            icon={<Medal className="w-4 h-4" />}
            label="Solo"
          />
          <TabButton
            active={tab === "events"}
            onClick={() => setTab("events")}
            icon={<Zap className="w-4 h-4" />}
            label="Events"
          />
          <TabButton
            active={tab === "players"}
            onClick={() => setTab("players")}
            icon={<Star className="w-4 h-4" />}
            label="Players"
          />
          <TabButton
            active={tab === "tug"}
            onClick={() => setTab("tug")}
            icon={<Swords className="w-4 h-4" />}
            label="Tug of War"
          />
          <TabButton
            active={tab === "dodgeball"}
            onClick={() => setTab("dodgeball")}
            icon={<CircleDot className="w-4 h-4" />}
            label="Dodgeball"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <SkeletonList rows={6} />
          </div>
        ) : tab === "teams" ? (
          teamStandings.some((s) => s.scoreCount > 0 || s.bonusPoints > 0) ? (
            <>
              <p className="text-xs text-muted mb-4">
                Team-event points, plus a{" "}
                <span className="text-gold font-semibold">+1 bonus</span> for
                each of the top-3 solo teams.
              </p>
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {teamStandings.map((s) => (
                    <motion.div
                      key={s.team.id}
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ type: "spring", stiffness: 200, damping: 25 }}
                      className={`relative flex items-center gap-4 p-4 rounded-xl border transition-all ${
                        s.rank <= 3
                          ? "bg-card border-2 shadow-md"
                          : "bg-card/50 border-border hover:bg-card"
                      }`}
                      style={{ borderColor: s.rank <= 3 ? s.team.color : undefined }}
                    >
                      <div className="flex items-center justify-center w-12">
                        {getMedalEmoji(s.rank) ? (
                          <span className="text-2xl">{getMedalEmoji(s.rank)}</span>
                        ) : (
                          <span className="font-mono text-lg font-bold text-muted">
                            {s.rank}
                          </span>
                        )}
                      </div>
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                        style={{
                          backgroundColor: s.team.color,
                          color: readableTextColor(s.team.color),
                        }}
                      >
                        {s.team.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-display text-sm font-bold uppercase tracking-wide truncate">
                          {s.team.name}
                        </p>
                        <p className="text-xs text-muted flex items-center gap-2 flex-wrap">
                          <span>
                            {s.scoreCount} score{s.scoreCount !== 1 ? "s" : ""}
                          </span>
                          {s.bonusPoints > 0 && (
                            <span className="inline-flex items-center gap-1 text-gold font-semibold">
                              <Star className="w-3 h-3 fill-gold" />
                              +{s.bonusPoints} solo bonus
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className="font-mono text-xl font-bold"
                          style={{ color: s.team.color }}
                        >
                          {s.totalPoints.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-muted uppercase tracking-wider">
                          points
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </>
          ) : (
            <EmptyState />
          )
        ) : tab === "solo" ? (
          soloStandings.some((s) => s.totalPoints > 0) ? (
            <>
              <p className="text-xs text-muted mb-4">
                Placement points across all {soloEvents.length} solo events
                (1st = 7, 2nd = 5, 3rd = 3, 4th = 2, 5th = 1). The top 3 teams
                each earn a{" "}
                <span className="text-gold font-semibold">
                  +1 team-event point
                </span>{" "}
                and playoff priority.
              </p>
              <div className="space-y-3">
                {soloStandings.map((s) => (
                  <div
                    key={s.team.id}
                    className={`relative flex items-center gap-4 p-4 rounded-xl border transition-all ${
                      s.isTop3
                        ? "bg-card border-2 shadow-md"
                        : "bg-card/50 border-border"
                    }`}
                    style={{ borderColor: s.isTop3 ? s.team.color : undefined }}
                  >
                    <div className="flex items-center justify-center w-12">
                      {getMedalEmoji(s.rank) ? (
                        <span className="text-2xl">{getMedalEmoji(s.rank)}</span>
                      ) : (
                        <span className="font-mono text-lg font-bold text-muted">
                          {s.rank}
                        </span>
                      )}
                    </div>
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                      style={{
                        backgroundColor: s.team.color,
                        color: readableTextColor(s.team.color),
                      }}
                    >
                      {s.team.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-sm font-bold uppercase tracking-wide truncate">
                        {s.team.name}
                      </p>
                      <p className="text-xs text-muted flex items-center gap-2 flex-wrap">
                        <span>
                          {s.eventsEntered} event
                          {s.eventsEntered !== 1 ? "s" : ""}
                        </span>
                        {s.isTop3 && (
                          <span className="inline-flex items-center gap-1 text-gold font-semibold uppercase tracking-wide">
                            <Star className="w-3 h-3 fill-gold" />
                            Top 3 · bonus + priority
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className="font-mono text-xl font-bold"
                        style={{ color: s.team.color }}
                      >
                        {s.totalPoints.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-muted uppercase tracking-wider">
                        solo pts
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState label="No solo results yet" />
          )
        ) : tab === "events" ? (
          <div>
            {/* Event selector */}
            <div className="flex flex-wrap items-center gap-2 mb-5">
              {soloEvents.map((ev) => {
                const Icon = ev.icon;
                const active = ev.slug === eventSlug;
                return (
                  <button
                    key={ev.slug}
                    onClick={() => setEventSlug(ev.slug)}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors border ${
                      active
                        ? "text-white border-transparent"
                        : "bg-card border-border text-muted hover:text-foreground"
                    }`}
                    style={active ? { backgroundColor: ev.color } : undefined}
                  >
                    <Icon className="w-4 h-4" />
                    {ev.name}
                  </button>
                );
              })}
            </div>

            {eventRows.length > 0 ? (
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-background border-b border-border">
                      <tr>
                        <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase w-16">
                          Place
                        </th>
                        <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase">
                          Team
                        </th>
                        <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase">
                          Participant
                        </th>
                        <th className="text-right px-4 py-3 font-semibold text-muted text-xs uppercase">
                          {getUnitLabel(getScoringInputBySlug(eventSlug))}
                        </th>
                        <th className="text-right px-4 py-3 font-semibold text-muted text-xs uppercase w-16">
                          Pts
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {eventRows.map((row) => (
                        <tr
                          key={row.team.id}
                          className={row.rank <= 3 ? "bg-gold/5" : ""}
                        >
                          <td className="px-4 py-3">
                            <span className="font-mono text-lg font-bold text-muted">
                              {getMedalEmoji(row.rank) || `#${row.rank}`}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: row.team.color }}
                              />
                              <span className="font-medium truncate">
                                {row.team.name}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted">
                            {row.playerName ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-right font-mono">
                            {row.display}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className="font-mono text-lg font-bold"
                              style={{ color: row.team.color }}
                            >
                              {row.points}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <EmptyState label="No results recorded for this event yet" />
            )}
          </div>
        ) : tab === "tug" ? (
          <BracketTab
            locked={tug?.state?.groups_locked ?? false}
            hasData={!!tug}
            icon={Swords}
            notStarted="Groups are decided once the solo events wrap up. Check back soon!"
            groups={<TugGroups teams={data?.teams ?? []} tug={tug!} />}
            bracket={<TugBracket teams={data?.teams ?? []} tug={tug!} />}
          />
        ) : tab === "dodgeball" ? (
          <BracketTab
            locked={dodge?.state?.groups_locked ?? false}
            hasData={!!dodge}
            icon={CircleDot}
            notStarted="Groups are decided once Tug of War wraps up. Check back soon!"
            groups={<TournamentGroups teams={data?.teams ?? []} data={dodge!} />}
            bracket={<TournamentBracket teams={data?.teams ?? []} data={dodge!} />}
          />
        ) : playerStandings.length > 0 ? (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-background border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase w-16">
                      Rank
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase">
                      Player
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase">
                      Team
                    </th>
                    <th className="text-right px-4 py-3 font-semibold text-muted text-xs uppercase">
                      Points
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {playerStandings.map((p) => (
                    <tr
                      key={p.player.id}
                      className={p.rank <= 3 ? "bg-gold/5" : ""}
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-lg font-bold text-muted">
                          {getMedalEmoji(p.rank) || `#${p.rank}`}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                            style={{
                              backgroundColor: p.teamColor,
                              color: readableTextColor(p.teamColor),
                            }}
                          >
                            {p.player.name.charAt(0).toUpperCase()}
                          </div>
                          <span
                            className={`font-medium ${
                              p.player.is_active
                                ? "text-foreground"
                                : "line-through text-muted"
                            }`}
                          >
                            {p.player.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: p.teamColor }}
                          />
                          {p.teamName}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className="font-mono text-lg font-bold"
                          style={{ color: p.teamColor }}
                        >
                          {p.totalPoints.toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <EmptyState />
        )}
      </div>
    </PageTransition>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex w-full items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
        active
          ? "bg-coral text-white"
          : "bg-card border border-border text-muted hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function BracketTab({
  locked,
  hasData,
  icon: Icon,
  notStarted,
  groups,
  bracket,
}: {
  locked: boolean;
  hasData: boolean;
  icon: React.ElementType;
  notStarted: string;
  groups: React.ReactNode;
  bracket: React.ReactNode;
}) {
  if (!locked || !hasData) {
    return (
      <div className="text-center py-20">
        <Icon className="w-16 h-16 text-muted mx-auto mb-4" />
        <h3 className="font-display text-xl font-bold text-foreground mb-2">
          NOT STARTED YET
        </h3>
        <p className="text-muted">{notStarted}</p>
      </div>
    );
  }
  return (
    <div className="space-y-10">
      <section>
        <h2 className="font-display text-lg font-bold text-foreground mb-4">
          GROUP STAGE
        </h2>
        {groups}
      </section>
      <section>
        <h2 className="font-display text-lg font-bold text-foreground mb-4">
          PLAYOFF BRACKET
        </h2>
        {bracket}
      </section>
    </div>
  );
}

function EmptyState({ label }: { label?: string }) {
  return (
    <div className="text-center py-20">
      <Trophy className="w-16 h-16 text-muted mx-auto mb-4" />
      <h3 className="font-display text-xl font-bold text-foreground mb-2">
        {label ? label.toUpperCase() : "NO SCORES YET"}
      </h3>
      <p className="text-muted">
        The leaderboard will light up once the games begin!
      </p>
    </div>
  );
}
