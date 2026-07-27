"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  UserX,
  Search,
  Trash2,
  CheckCircle,
  AlertCircle,
  Shield,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { PageTransition } from "@/components/ui/page-transition";
import { SkeletonList } from "@/components/ui/skeleton";
import { logAudit } from "@/lib/audit";
import type { UserRole } from "@/lib/types";

interface PlayerRow {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  profile_completed: boolean;
  created_at: string;
}

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "participant", label: "Player" },
  { value: "volunteer", label: "Volunteer" },
  { value: "captain", label: "Captain" },
  { value: "admin", label: "Admin" },
];

interface RosterPlayerLite {
  id: string;
  name: string;
  team_id: string;
  team_name: string;
  sort_order: number;
  captain_user_id: string | null;
}

// Roles for which a captain (roster-player) link is meaningful: captains sign in
// to the dashboard wager panel, and admins can be captains too.
const CAPTAIN_LINK_ROLES: UserRole[] = ["captain", "admin"];

export default function AdminPlayersPage() {
  const supabase = createClient();
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);
  const [rosterPlayers, setRosterPlayers] = useState<RosterPlayerLite[]>([]);
  const [assigningPlayer, setAssigningPlayer] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setCurrentUserId(user?.id ?? null);

    const [{ data }, { data: rp }] = await Promise.all([
      supabase
        .from("users")
        .select("id, email, display_name, role, profile_completed, created_at")
        .order("display_name"),
      supabase
        .from("roster_players")
        .select("id, name, team_id, sort_order, captain_user_id, team:roster_teams(name, sort_order)")
        .order("sort_order"),
    ]);

    const mapped: RosterPlayerLite[] = (
      (rp as {
        id: string;
        name: string;
        team_id: string;
        sort_order: number;
        captain_user_id: string | null;
        team: { name: string; sort_order: number } | { name: string; sort_order: number }[] | null;
      }[]) ?? []
    ).map((r) => {
      const team = Array.isArray(r.team) ? r.team[0] : r.team;
      return {
        id: r.id,
        name: r.name,
        team_id: r.team_id,
        team_name: team?.name ?? "—",
        sort_order: (team?.sort_order ?? 0) * 1000 + r.sort_order,
        captain_user_id: r.captain_user_id,
      };
    });
    mapped.sort((a, b) => a.sort_order - b.sort_order);

    setPlayers(data ?? []);
    setRosterPlayers(mapped);
    setLoading(false);
  }

  // Link a user (captain) to a roster player, or clear with playerId === "". A
  // user captains at most one player, so release any player they currently hold,
  // then claim the chosen one (which also displaces its previous captain).
  async function assignCaptainPlayer(user: PlayerRow, playerId: string) {
    setAssigningPlayer(user.id);
    setFeedback(null);

    const clear = await supabase
      .from("roster_players")
      .update({ captain_user_id: null })
      .eq("captain_user_id", user.id);
    if (clear.error) {
      setFeedback({ type: "error", message: `Failed to update assignment: ${clear.error.message}` });
      setAssigningPlayer(null);
      return;
    }

    if (playerId) {
      const claim = await supabase
        .from("roster_players")
        .update({ captain_user_id: user.id })
        .eq("id", playerId);
      if (claim.error) {
        setFeedback({ type: "error", message: `Failed to assign player: ${claim.error.message}` });
        setAssigningPlayer(null);
        return;
      }
    }

    const target = rosterPlayers.find((p) => p.id === playerId);
    await logAudit(supabase, "update", "player_captain", user.id, {
      name: user.display_name,
      player: target ? `${target.team_name} — ${target.name}` : "none",
    });

    // Reflect locally: this user now captains only `playerId`.
    setRosterPlayers((prev) =>
      prev.map((p) => ({
        ...p,
        captain_user_id:
          p.id === playerId ? user.id : p.captain_user_id === user.id ? null : p.captain_user_id,
      }))
    );
    setFeedback({
      type: "success",
      message: target
        ? `${user.display_name} now captains ${target.name} (${target.team_name}).`
        : `${user.display_name} is no longer assigned to a player.`,
    });
    setAssigningPlayer(null);
  }

  // Any admin can change another user's role (appoint volunteers, promote/demote
  // admins). The `enforce_role_change` DB trigger authorizes the change; you
  // can't change your own role here, to avoid accidentally locking yourself out.
  async function changeRole(player: PlayerRow, role: UserRole) {
    if (role === player.role) return;
    setUpdatingRole(player.id);
    setFeedback(null);

    const { error } = await supabase
      .from("users")
      .update({ role })
      .eq("id", player.id);

    if (error) {
      setFeedback({ type: "error", message: `Failed to change role: ${error.message}` });
    } else {
      await logAudit(supabase, "update", "user_role", player.id, {
        name: player.display_name,
        from: player.role,
        to: role,
      });
      // Only captains/admins can hold a player link; release it otherwise.
      if (!CAPTAIN_LINK_ROLES.includes(role)) {
        await supabase
          .from("roster_players")
          .update({ captain_user_id: null })
          .eq("captain_user_id", player.id);
        setRosterPlayers((prev) =>
          prev.map((p) =>
            p.captain_user_id === player.id ? { ...p, captain_user_id: null } : p
          )
        );
      }
      setPlayers((prev) =>
        prev.map((p) => (p.id === player.id ? { ...p, role } : p))
      );
      const roleLabel = ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role;
      setFeedback({
        type: "success",
        message: `${player.display_name} is now ${roleLabel}.`,
      });
    }
    setUpdatingRole(null);
  }

  // Removing an account fully (login + profile) requires the service role and
  // careful FK cleanup, so it runs server-side. See /api/admin/delete-user.
  async function deletePlayer(player: PlayerRow) {
    setDeleting(true);
    setFeedback(null);

    const res = await fetch("/api/admin/delete-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: player.id }),
    });
    const result = await res.json().catch(() => ({}));

    if (!res.ok) {
      setFeedback({
        type: "error",
        message: result.error ?? "Failed to delete account.",
      });
      setDeleting(false);
      return;
    }

    await logAudit(supabase, "delete", "user", player.id, {
      name: player.display_name,
      email: player.email,
      role: player.role,
    });
    setFeedback({
      type: "success",
      message: `${player.display_name}'s account was removed. They will need to re-register to sign in again.`,
    });
    setPlayers(players.filter((p) => p.id !== player.id));

    setConfirmDelete(null);
    setDeleting(false);
  }

  const filteredPlayers = players.filter(
    (p) =>
      p.display_name.toLowerCase().includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <PageTransition>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Admin
        </Link>

        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-danger/10 flex items-center justify-center">
              <UserX className="w-6 h-6 text-danger" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">
                PLAYER MANAGEMENT
              </h1>
              <p className="text-sm text-muted">
                View registered players and remove accounts
              </p>
            </div>
          </div>
          <div className="text-sm text-muted">
            <span className="font-mono font-bold text-foreground">
              {players.length}
            </span>{" "}
            registered
          </div>
        </div>

        {/* Feedback */}
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mb-6 p-4 rounded-xl flex items-center gap-2 ${
              feedback.type === "success"
                ? "bg-success/10 text-success"
                : "bg-danger/10 text-danger"
            }`}
          >
            {feedback.type === "success" ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <p className="text-sm font-medium">{feedback.message}</p>
          </motion.div>
        )}

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card text-foreground placeholder:text-muted text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-coral/30 focus:border-coral"
            />
          </div>
        </div>

        {/* Players list */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {loading ? (
            <SkeletonList rows={6} className="p-4" />
          ) : filteredPlayers.length === 0 ? (
            <div className="text-center text-muted py-8 text-sm">
              {search ? "No players match your search." : "No players registered yet."}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filteredPlayers.map((player) => (
                <li
                  key={player.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 hover:bg-background/50"
                >
                  {/* Player identity — grows to fill, name/email truncate */}
                  <div className="flex items-center gap-2 min-w-0 flex-1 basis-48">
                    <div className="w-8 h-8 shrink-0 rounded-full bg-navy/10 flex items-center justify-center text-xs font-bold text-navy">
                      {player.display_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {player.display_name}
                      </p>
                      <p className="text-xs text-muted truncate">{player.email}</p>
                    </div>
                  </div>

                  {/* Role (+ team assignment for captains) */}
                  <div className="shrink-0 flex items-center gap-2">
                    {player.id === currentUserId ? (
                      // Don't let an admin change their own role here.
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-danger bg-danger/10 rounded-full px-2 py-0.5">
                        <Shield className="w-3 h-3" />
                        You
                      </span>
                    ) : (
                      <div className="w-32">
                        <Select
                          value={player.role}
                          disabled={updatingRole === player.id}
                          onChange={(e) =>
                            changeRole(player, e.target.value as UserRole)
                          }
                          options={ROLE_OPTIONS}
                        />
                      </div>
                    )}

                    {/* Which roster player this captain is (their team's points
                        are what they wager). Available to captains and admins. */}
                    {CAPTAIN_LINK_ROLES.includes(player.role) && (
                      <div className="w-44">
                        <Select
                          value={
                            rosterPlayers.find((p) => p.captain_user_id === player.id)?.id ?? ""
                          }
                          disabled={assigningPlayer === player.id}
                          onChange={(e) => assignCaptainPlayer(player, e.target.value)}
                          options={[
                            { value: "", label: "— No player —" },
                            ...rosterPlayers.map((p) => ({
                              value: p.id,
                              label: `${p.team_name} — ${p.name}`,
                            })),
                          ]}
                        />
                      </div>
                    )}
                  </div>

                  {/* Joined */}
                  <div className="shrink-0 text-xs text-muted w-20">
                    {new Date(player.created_at).toLocaleDateString()}
                  </div>

                  {/* Actions — any account can be removed except your own,
                      which would lock you out of the dashboard. */}
                  <div className="shrink-0 ml-auto">
                    {player.id !== currentUserId && (
                      <>
                        {confirmDelete === player.id ? (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="danger"
                              size="sm"
                              loading={deleting}
                              onClick={() => deletePlayer(player)}
                            >
                              Confirm
                            </Button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="text-xs text-muted hover:text-foreground transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(player.id)}
                            className="text-muted hover:text-danger transition-colors"
                            title="Delete player"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
