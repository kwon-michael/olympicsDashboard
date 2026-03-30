"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Users,
  Shield,
  Lock,
  Unlock,
  Trash2,
  Eye,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageTransition } from "@/components/ui/page-transition";
import { Input } from "@/components/ui/input";

interface TeamWithCaptain {
  id: string;
  name: string;
  color: string;
  motto: string | null;
  is_locked: boolean;
  created_at: string;
  captain: { id: string; display_name: string } | null;
  memberCount: number;
}

export default function AdminTeamsPage() {
  const supabase = createClient();
  const [teams, setTeams] = useState<TeamWithCaptain[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchTeams();
  }, []);

  async function fetchTeams() {
    const { data } = await supabase
      .from("teams")
      .select(
        "id, name, color, motto, is_locked, created_at, captain:users!teams_captain_id_fkey(id, display_name)"
      )
      .order("name");

    const teamsRaw = (data ?? []) as unknown as Omit<TeamWithCaptain, "memberCount">[];

    // Get member counts
    const withCounts = await Promise.all(
      teamsRaw.map(async (t) => {
        const { count } = await supabase
          .from("team_members")
          .select("id", { count: "exact", head: true })
          .eq("team_id", t.id);
        return { ...t, memberCount: count ?? 0 };
      })
    );

    setTeams(withCounts);
    setLoading(false);
  }

  async function toggleLock(id: string, currentLock: boolean) {
    await supabase
      .from("teams")
      .update({ is_locked: !currentLock })
      .eq("id", id);
    setTeams(
      teams.map((t) =>
        t.id === id ? { ...t, is_locked: !currentLock } : t
      )
    );
  }

  async function deleteTeam(id: string) {
    if (!confirm("Are you sure you want to delete this team? This cannot be undone.")) return;
    await supabase.from("teams").delete().eq("id", id);
    setTeams(teams.filter((t) => t.id !== id));
  }

  const filteredTeams = search
    ? teams.filter(
        (t) =>
          t.name.toLowerCase().includes(search.toLowerCase()) ||
          t.captain?.display_name?.toLowerCase().includes(search.toLowerCase())
      )
    : teams;

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Admin
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
            <Users className="w-6 h-6 text-success" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              TEAM OVERSIGHT
            </h1>
            <p className="text-sm text-muted">
              Manage teams and rosters
            </p>
          </div>
        </div>

        <div className="mb-6">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search teams or captains..."
          />
        </div>

        <div className="space-y-3">
          {loading ? (
            <div className="text-center text-muted py-8 text-sm">
              Loading teams...
            </div>
          ) : filteredTeams.length === 0 ? (
            <div className="text-center text-muted py-8 text-sm">
              No teams found.
            </div>
          ) : (
            filteredTeams.map((team) => (
              <div
                key={team.id}
                className="bg-card rounded-xl border border-border p-4 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-lg shrink-0"
                    style={{ backgroundColor: team.color }}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground text-sm truncate">
                        {team.name}
                      </h3>
                      {team.is_locked && (
                        <Lock className="w-3 h-3 text-muted" />
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted">
                      <span>
                        Captain:{" "}
                        {team.captain?.display_name ?? "None"}
                      </span>
                      <span>{team.memberCount} members</span>
                      <span>
                        Created{" "}
                        {new Date(team.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/teams/${team.id}`}
                    className="text-muted hover:text-foreground transition-colors p-1"
                    title="View team"
                  >
                    <Eye className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={() => toggleLock(team.id, team.is_locked)}
                    className="text-muted hover:text-foreground transition-colors p-1"
                    title={team.is_locked ? "Unlock" : "Lock"}
                  >
                    {team.is_locked ? (
                      <Lock className="w-4 h-4" />
                    ) : (
                      <Unlock className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => deleteTeam(team.id)}
                    className="text-muted hover:text-danger transition-colors p-1"
                    title="Delete team"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </PageTransition>
  );
}
