"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Users,
  Trash2,
  Plus,
  Ban,
  RotateCcw,
  Check,
  X,
  Pencil,
  ArrowRightLeft,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageTransition } from "@/components/ui/page-transition";
import { Button } from "@/components/ui/button";
import { logAudit } from "@/lib/audit";
import { fetchRosterData, type RosterData } from "@/lib/roster";
import type { RosterPlayer } from "@/lib/types";

export default function AdminRosterPage() {
  const [data, setData] = useState<RosterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  // per-team "add player" input
  const [addName, setAddName] = useState<Record<string, string>>({});
  // inline rename
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient();
    setData(await fetchRosterData(supabase));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const teamNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of data?.teams ?? []) m.set(t.id, t.name);
    return m;
  }, [data]);

  const playersByTeam = useMemo(() => {
    const m = new Map<string, RosterPlayer[]>();
    for (const p of data?.players ?? []) {
      const arr = m.get(p.team_id) ?? [];
      arr.push(p);
      m.set(p.team_id, arr);
    }
    return m;
  }, [data]);

  async function movePlayer(player: RosterPlayer, newTeamId: string) {
    if (newTeamId === player.team_id) return;
    setBusyId(player.id);
    const supabase = createClient();
    const { error } = await supabase
      .from("roster_players")
      .update({ team_id: newTeamId })
      .eq("id", player.id);
    if (!error) {
      await logAudit(supabase, "update", "roster_player", player.id, {
        action: "move",
        player: player.name,
        from: teamNameById.get(player.team_id),
        to: teamNameById.get(newTeamId),
      });
      await load();
    }
    setBusyId(null);
  }

  async function toggleActive(player: RosterPlayer) {
    setBusyId(player.id);
    const supabase = createClient();
    const { error } = await supabase
      .from("roster_players")
      .update({ is_active: !player.is_active })
      .eq("id", player.id);
    if (!error) {
      await logAudit(supabase, "update", "roster_player", player.id, {
        action: player.is_active ? "cross_out" : "restore",
        player: player.name,
      });
      await load();
    }
    setBusyId(null);
  }

  async function renamePlayer(player: RosterPlayer) {
    const name = editName.trim();
    if (!name || name === player.name) {
      setEditId(null);
      return;
    }
    setBusyId(player.id);
    const supabase = createClient();
    const { error } = await supabase
      .from("roster_players")
      .update({ name })
      .eq("id", player.id);
    if (!error) {
      await logAudit(supabase, "update", "roster_player", player.id, {
        action: "rename",
        from: player.name,
        to: name,
      });
      setEditId(null);
      await load();
    }
    setBusyId(null);
  }

  async function deletePlayer(player: RosterPlayer) {
    if (
      !confirm(
        `Remove ${player.name} from ${teamNameById.get(player.team_id)}? Their recorded scores will also be deleted.`
      )
    )
      return;
    setBusyId(player.id);
    const supabase = createClient();
    const { error } = await supabase
      .from("roster_players")
      .delete()
      .eq("id", player.id);
    if (!error) {
      await logAudit(supabase, "delete", "roster_player", player.id, {
        player: player.name,
        team: teamNameById.get(player.team_id),
      });
      await load();
    }
    setBusyId(null);
  }

  async function addPlayer(teamId: string) {
    const name = (addName[teamId] ?? "").trim();
    if (!name) return;
    const existing = playersByTeam.get(teamId) ?? [];
    const nextSort =
      existing.reduce((max, p) => Math.max(max, p.sort_order), 0) + 1;

    setBusyId(teamId);
    const supabase = createClient();
    const { error } = await supabase.from("roster_players").insert({
      team_id: teamId,
      name,
      is_active: true,
      sort_order: nextSort,
    });
    if (!error) {
      await logAudit(supabase, "create", "roster_player", teamId, {
        player: name,
        team: teamNameById.get(teamId),
      });
      setAddName((prev) => ({ ...prev, [teamId]: "" }));
      await load();
    }
    setBusyId(null);
  }

  return (
    <PageTransition className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Admin
      </Link>

      <div className="flex items-center gap-3 mb-2">
        <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
          <Users className="w-6 h-6 text-success" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            TEAM MANAGEMENT
          </h1>
          <p className="text-sm text-muted">
            Move players between teams, cross them out, or replace them
          </p>
        </div>
      </div>
      <p className="text-xs text-muted mb-8 flex items-center gap-1.5">
        <ArrowRightLeft className="w-3.5 h-3.5" />
        Use the team dropdown on a player to move (swap) them to another team.
        <Ban className="w-3.5 h-3.5 ml-2" />
        Cross-out keeps a player on record but marks them inactive.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-coral border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {(data?.teams ?? []).map((team) => {
            const players = playersByTeam.get(team.id) ?? [];
            return (
              <div
                key={team.id}
                className="bg-card rounded-2xl border border-border overflow-hidden flex flex-col"
              >
                <div
                  className="px-5 py-3 flex items-center gap-2"
                  style={{ backgroundColor: team.color + "15" }}
                >
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: team.color }}
                  />
                  <h3 className="font-display font-bold text-foreground">
                    {team.name}
                  </h3>
                  <span className="text-xs text-muted ml-auto">
                    {players.length} players
                  </span>
                </div>

                <div className="p-3 space-y-1.5 flex-1">
                  {players.map((player) => {
                    const isEditing = editId === player.id;
                    const disabled = busyId === player.id;
                    return (
                      <div
                        key={player.id}
                        className="flex items-center gap-2 p-2 rounded-lg hover:bg-background group"
                      >
                        {isEditing ? (
                          <>
                            <input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") renamePlayer(player);
                                if (e.key === "Escape") setEditId(null);
                              }}
                              autoFocus
                              className="flex-1 min-w-0 px-2 py-1 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-coral/30"
                            />
                            <button
                              onClick={() => renamePlayer(player)}
                              className="p-1 text-success hover:text-green-600"
                              title="Save"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditId(null)}
                              className="p-1 text-muted hover:text-foreground"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <span
                              className={`flex-1 min-w-0 truncate text-sm font-medium ${
                                player.is_active
                                  ? ""
                                  : "line-through text-muted"
                              }`}
                            >
                              {player.name}
                            </span>

                            {/* Move to another team */}
                            <select
                              value={player.team_id}
                              disabled={disabled}
                              onChange={(e) => movePlayer(player, e.target.value)}
                              title="Move to team"
                              className="w-24 shrink-0 px-1.5 py-1 rounded-md border border-border bg-background text-xs text-muted focus:outline-none focus:ring-2 focus:ring-coral/30"
                            >
                              {(data?.teams ?? []).map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name}
                                </option>
                              ))}
                            </select>

                            <button
                              onClick={() => {
                                setEditId(player.id);
                                setEditName(player.name);
                              }}
                              disabled={disabled}
                              className="p-1 text-muted hover:text-coral opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Rename"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => toggleActive(player)}
                              disabled={disabled}
                              className={`p-1 transition-colors ${
                                player.is_active
                                  ? "text-muted hover:text-warning"
                                  : "text-warning hover:text-success"
                              }`}
                              title={
                                player.is_active
                                  ? "Cross out (mark inactive)"
                                  : "Restore"
                              }
                            >
                              {player.is_active ? (
                                <Ban className="w-3.5 h-3.5" />
                              ) : (
                                <RotateCcw className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              onClick={() => deletePlayer(player)}
                              disabled={disabled}
                              className="p-1 text-muted hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Remove"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })}
                  {players.length === 0 && (
                    <p className="text-xs text-muted text-center py-4">
                      No players.
                    </p>
                  )}
                </div>

                {/* Add player */}
                <div className="p-3 border-t border-border flex items-center gap-2">
                  <input
                    value={addName[team.id] ?? ""}
                    onChange={(e) =>
                      setAddName((prev) => ({
                        ...prev,
                        [team.id]: e.target.value,
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addPlayer(team.id);
                    }}
                    placeholder="Add player…"
                    className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-coral/30"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => addPlayer(team.id)}
                    disabled={busyId === team.id || !(addName[team.id] ?? "").trim()}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PageTransition>
  );
}
