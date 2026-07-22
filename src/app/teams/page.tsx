"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Users, Search, Trophy, Swords, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  PageTransition,
  StaggerContainer,
  StaggerItem,
} from "@/components/ui/page-transition";
import {
  fetchRosterData,
  computeTeamStandings,
  type RosterData,
} from "@/lib/roster";
import { fetchTugData, type TugData } from "@/lib/tug";
import {
  fetchSoloResults,
  computeSoloTeamStandings,
  soloBonusByTeam,
} from "@/lib/solo";
import { TugGroups } from "@/components/tug/tug-groups";
import { TugBracket } from "@/components/tug/tug-bracket";
import type { RosterPlayer, SoloResult } from "@/lib/types";

export default function TeamsPage() {
  const [data, setData] = useState<RosterData | null>(null);
  const [tug, setTug] = useState<TugData | null>(null);
  const [solo, setSolo] = useState<SoloResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tugOpen, setTugOpen] = useState(true);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const [roster, t, soloResults] = await Promise.all([
        fetchRosterData(supabase),
        fetchTugData(supabase),
        fetchSoloResults(supabase),
      ]);
      setData(roster);
      setTug(t);
      setSolo(soloResults);
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

  const standings = useMemo(() => {
    if (!data) return [];
    const bonus = soloBonusByTeam(computeSoloTeamStandings(solo, data.teams));
    return computeTeamStandings(data.teams, data.scores, bonus);
  }, [data, solo]);

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

  const filtered = standings.filter((s) =>
    s.team.name.toLowerCase().includes(search.toLowerCase())
  );

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

      {/* Tug of War groups + bracket */}
      {!loading && tugLocked && tug && (
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
              href="/tug-of-war"
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
              <TugGroups teams={data?.teams ?? []} tug={tug} />
              <TugBracket teams={data?.teams ?? []} tug={tug} />
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-coral border-t-transparent rounded-full animate-spin" />
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
                      className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-xl"
                      style={{ backgroundColor: s.team.color }}
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
                    <div
                      className="flex items-center gap-1.5 font-mono font-bold"
                      style={{ color: s.team.color }}
                    >
                      <Trophy className="w-4 h-4" />
                      {s.totalPoints} pts
                    </div>
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
