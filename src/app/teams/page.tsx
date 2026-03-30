"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Users, Plus, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TeamBadge } from "@/components/ui/team-badge";
import {
  PageTransition,
  StaggerContainer,
  StaggerItem,
} from "@/components/ui/page-transition";
import type { Team, TeamMember } from "@/lib/types";

export default function TeamsPage() {
  const [teams, setTeams] = useState<(Team & { memberCount: number })[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTeams = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("teams")
        .select("*, team_members(count)")
        .order("created_at", { ascending: false });

      if (data) {
        setTeams(
          data.map((team: any) => ({
            ...team,
            memberCount: team.team_members?.[0]?.count || 0,
          }))
        );
      }
      setLoading(false);
    };

    loadTeams();
  }, []);

  const filteredTeams = teams.filter((team) =>
    team.name.toLowerCase().includes(search.toLowerCase())
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
            {teams.length} team{teams.length !== 1 ? "s" : ""} competing
          </p>
        </div>
        <Link href="/teams/create">
          <Button>
            <Plus className="w-4 h-4" />
            Create Team
          </Button>
        </Link>
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

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-coral border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredTeams.length > 0 ? (
        <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTeams.map((team) => (
            <StaggerItem key={team.id}>
              <Link href={`/teams/${team.id}`}>
                <div className="group relative bg-card rounded-2xl border border-border p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 cursor-pointer">
                  <div
                    className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
                    style={{ backgroundColor: team.color }}
                  />

                  <div className="flex items-center gap-4 mb-4">
                    <div
                      className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-xl"
                      style={{ backgroundColor: team.color }}
                    >
                      {team.avatar_url ? (
                        <img
                          src={team.avatar_url}
                          alt={team.name}
                          className="w-full h-full rounded-xl object-cover"
                        />
                      ) : (
                        team.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <h3 className="font-display text-lg font-bold group-hover:text-coral transition-colors">
                        {team.name}
                      </h3>
                      {team.motto && (
                        <p className="text-xs text-muted italic truncate max-w-[180px]">
                          &ldquo;{team.motto}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1.5 text-muted">
                      <Users className="w-4 h-4" />
                      <span>
                        {team.memberCount} member
                        {team.memberCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                    {team.is_locked && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full bg-danger/10 text-danger">
                        Locked
                      </span>
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
          <p className="text-muted mb-6">
            {search
              ? "No teams match your search"
              : "Be the first to create a team!"}
          </p>
          <Link href="/teams/create">
            <Button>
              <Plus className="w-4 h-4" />
              Create Team
            </Button>
          </Link>
        </div>
      )}
    </PageTransition>
  );
}
