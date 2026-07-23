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
  { value: "admin", label: "Admin" },
];

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

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setCurrentUserId(user?.id ?? null);

    const { data } = await supabase
      .from("users")
      .select("id, email, display_name, role, profile_completed, created_at")
      .order("display_name");

    setPlayers(data ?? []);
    setLoading(false);
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
            <div className="text-center text-muted py-8 text-sm">
              Loading players...
            </div>
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

                  {/* Role */}
                  <div className="shrink-0">
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
