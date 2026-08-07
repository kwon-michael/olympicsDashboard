"use client";
import { SkeletonList } from "@/components/ui/skeleton";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Users, Search, Trophy, Swords, ChevronDown, Copy, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  PageTransition,
  StaggerContainer,
  StaggerItem,
} from "@/components/ui/page-transition";
import { fetchRosterData, activeTeamSizes, type RosterData } from "@/lib/roster";
import { fetchTugData, type TugData } from "@/lib/tug";
import { fetchDodgeballData, type DodgeballData } from "@/lib/dodgeball";
import { readableTextColor } from "@/lib/colors";
import { fetchSoloResults, soloPriorityTeamIds } from "@/lib/solo";
import { computeStandings } from "@/lib/standings";
import { fetchTiebreaks, type Tiebreak } from "@/lib/tiebreak";
import { TugGroups } from "@/components/tug/tug-groups";
import { TugBracket } from "@/components/tug/tug-bracket";
import { useLeaderboardVisibility } from "@/lib/useLeaderboardVisibility";
import {
  LeaderboardHiddenLine,
  LeaderboardHiddenBanner,
} from "@/components/leaderboard/hidden-notice";
import type { RosterPlayer, SoloResult } from "@/lib/types";

export default function TeamsPage() {
  const [data, setData] = useState<RosterData | null>(null);
  const [tug, setTug] = useState<TugData | null>(null);
  // Not rendered here — fetched only so the team totals on this page match the
  // leaderboard, which scores both tournaments into them.
  const [dodge, setDodge] = useState<DodgeballData | null>(null);
  const [solo, setSolo] = useState<SoloResult[]>([]);
  const [tiebreaks, setTiebreaks] = useState<Tiebreak[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tugOpen, setTugOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  // Whether this viewer may see the standings at all — an admin can hide them
  // from the public mid-event (see src/lib/settings.ts). The rosters stay up
  // either way; it's only the points that go.
  const visibility = useLeaderboardVisibility();

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const [roster, t, d, soloResults, tiebreakRows] = await Promise.all([
        fetchRosterData(supabase),
        fetchTugData(supabase),
        fetchDodgeballData(supabase),
        fetchSoloResults(supabase),
        fetchTiebreaks(supabase),
      ]);
      setData(roster);
      setTug(t);
      setDodge(d);
      setSolo(soloResults);
      setTiebreaks(tiebreakRows);
      setLoading(false);
    };
    load();
  }, []);

  const tugLocked = tug?.state?.groups_locked ?? false;
  const groupByTeam = useMemo(() => {
    const map = new Map<string, string>();
    for (const gm of tug?.groupMembers ?? []) map.set(gm.team_id, gm.group_label);
    return map;
  }, [tug]);

  const resolved = useMemo(() => {
    if (!data) return null;
    return computeStandings(data.teams, data.scores, solo, tiebreaks, {
      tug: tug?.matches,
      dodgeball: dodge?.matches,
      teamSizes: activeTeamSizes(data.players),
    });
  }, [data, solo, tiebreaks, tug, dodge]);
  const standings = useMemo(() => resolved?.teams ?? [], [resolved]);
  // Only used to order teams left level on round wins inside a tug group,
  // matching how the wildcard is drawn.
  const priorityTeamIds = useMemo(
    () => soloPriorityTeamIds(resolved?.solo ?? []),
    [resolved]
  );

  const playersByTeam = useMemo(() => {
    const map = new Map<string, RosterPlayer[]>();
    for (const p of data?.players ?? []) {
      const arr = map.get(p.team_id) ?? [];
      arr.push(p);
      map.set(p.team_id, arr);
    }
    return map;
  }, [data]);

  const playerCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of data?.players ?? []) {
      map.set(p.team_id, (map.get(p.team_id) ?? 0) + 1);
    }
    return map;
  }, [data]);

  const showPoints = visibility.canView;
  const busy = loading || visibility.loading;

  const filtered = useMemo(() => {
    const matches = standings.filter((s) =>
      s.team.name.toLowerCase().includes(search.toLowerCase())
    );
    // `standings` comes back in leaderboard order, which is itself the thing
    // being hidden — leaving the cards in it would hand the ranking over even
    // with the numbers stripped off. Fall back to alphabetical.
    return showPoints
      ? matches
      : [...matches].sort((a, b) => a.team.name.localeCompare(b.team.name));
  }, [standings, search, showPoints]);

  const totalPlayers = data?.players.length ?? 0;

  function buildRosterText(): string {
    const teams = data?.teams ?? [];
    const lines: string[] = [
      `All players — ${totalPlayers} across ${teams.length} teams`,
      "",
    ];
    for (const team of teams) {
      const members = playersByTeam.get(team.id) ?? [];
      lines.push(`${team.name} (${members.length})`);
      for (const p of members) {
        lines.push(`- ${p.name}${p.is_active ? "" : " (inactive)"}`);
      }
      lines.push("");
    }
    return lines.join("\n").trimEnd();
  }

  async function handleCopyAll() {
    try {
      await navigator.clipboard.writeText(buildRosterText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (e.g. insecure context) — silently ignore.
    }
  }

  return (
    <PageTransition className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">
            ALL TEAMS
          </h1>
          <p className="text-muted mt-1">
            {standings.length} team{standings.length !== 1 ? "s" : ""} competing
          </p>
        </div>

        <button
          onClick={handleCopyAll}
          disabled={loading || totalPlayers === 0}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card text-sm font-semibold text-foreground hover:bg-background transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-success" />
              Copied {totalPlayers} players
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              Copy all players
            </>
          )}
        </button>
      </div>

      {/* Search */}
      <div className="mb-6 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            placeholder="Search teams..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card text-foreground placeholder:text-muted text-sm focus:outline-none focus:ring-2 focus:ring-coral/30 focus:border-coral"
          />
        </div>
      </div>

      {/* Why the point totals are missing, and — for admins — the reminder that
          everyone else is seeing this page without them. */}
      {!busy && !showPoints && <LeaderboardHiddenLine className="mb-6" />}
      {!busy && visibility.isAdminPreview && (
        <LeaderboardHiddenBanner className="mb-6" />
      )}

      {/* Tug of War groups + bracket. Goes with the standings: the group tables
          are results, and the leaderboard's own Tug tab is hidden too. */}
      {!busy && showPoints && tugLocked && tug && (
        <div className="mb-8 bg-card/50 rounded-2xl border border-border overflow-hidden">
          <button
            onClick={() => setTugOpen((v) => !v)}
            className="w-full flex items-center gap-2.5 px-5 py-3.5 hover:bg-card transition-colors"
          >
            <Swords className="w-5 h-5 text-indigo-500" />
            <span className="font-display font-bold text-foreground">
              TUG OF WAR
            </span>
            <Link
              href="/leaderboard?tab=tug"
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-coral hover:underline ml-2"
            >
              full view →
            </Link>
            <ChevronDown
              className={`w-4 h-4 text-muted ml-auto transition-transform ${
                tugOpen ? "rotate-180" : ""
              }`}
            />
          </button>
          {tugOpen && (
            <div className="px-4 pb-5 pt-1 space-y-6">
              <TugGroups
                teams={data?.teams ?? []}
                tug={tug}
                priorityTeamIds={priorityTeamIds}
              />
              <TugBracket teams={data?.teams ?? []} tug={tug} />
            </div>
          )}
        </div>
      )}

      {busy ? (
        <div className="flex items-center justify-center py-20">
          <SkeletonList rows={6} />
        </div>
      ) : filtered.length > 0 ? (
        <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s) => (
            <StaggerItem key={s.team.id}>
              <Link href={`/teams/${s.team.id}`}>
                <div className="group relative bg-card rounded-2xl border border-border p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 cursor-pointer">
                  <div
                    className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
                    style={{ backgroundColor: s.team.color }}
                  />

                  <div className="flex items-center gap-4 mb-4">
                    <div
                      className="w-14 h-14 rounded-xl flex items-center justify-center font-bold text-xl"
                      style={{
                        backgroundColor: s.team.color,
                        color: readableTextColor(s.team.color),
                      }}
                    >
                      {s.team.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-display text-lg font-bold group-hover:text-coral transition-colors">
                        {s.team.name}
                      </h3>
                      {tugLocked && groupByTeam.has(s.team.id) && (
                        <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-500">
                          <Swords className="w-3 h-3" />
                          Group {groupByTeam.get(s.team.id)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Members — fixed-height 2-col grid keeps every card the same size */}
                  <div className="grid grid-cols-2 gap-1.5 mb-4 h-24 overflow-y-auto content-start">
                    {(playersByTeam.get(s.team.id) ?? []).map((p) => (
                      <span
                        key={p.id}
                        className={`text-xs px-2 py-1 rounded-full bg-background border border-border truncate ${
                          p.is_active ? "text-foreground" : "text-muted line-through"
                        }`}
                        title={p.name}
                      >
                        {p.name}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1.5 text-muted">
                      <Users className="w-4 h-4" />
                      <span>
                        {playerCounts.get(s.team.id) ?? 0} member
                        {(playerCounts.get(s.team.id) ?? 0) !== 1 ? "s" : ""}
                      </span>
                    </div>
                    {showPoints && (
                      <div
                        className="flex items-center gap-1.5 font-mono font-bold"
                        style={{ color: s.team.color }}
                      >
                        <Trophy className="w-4 h-4" />
                        {s.totalPoints} pts
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            </StaggerItem>
          ))}
        </StaggerContainer>
      ) : (
        <div className="text-center py-20">
          <Users className="w-16 h-16 text-muted mx-auto mb-4" />
          <h3 className="font-display text-xl font-bold text-foreground mb-2">
            NO TEAMS FOUND
          </h3>
          <p className="text-muted mb-6">No teams match your search</p>
        </div>
      )}
    </PageTransition>
  );
}
