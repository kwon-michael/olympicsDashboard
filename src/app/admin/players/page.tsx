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
import { PageTransition } from "@/components/ui/page-transition";

interface PlayerRow {
  id: string;
  email: string;
  display_name: string;
  role: string;
  profile_completed: boolean;
  created_at: string;
}

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

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const { data } = await supabase
      .from("users")
      .select("id, email, display_name, role, profile_completed, created_at")
      .order("display_name");

    setPlayers(data ?? []);
    setLoading(false);
  }

  async function deletePlayer(userId: string) {
    setDeleting(true);
    setFeedback(null);

    const { error: scoresErr } = await supabase
      .from("scores")
      .delete()
      .eq("user_id", userId);

    if (scoresErr) {
      setFeedback({ type: "error", message: `Failed to remove scores: ${scoresErr.message}` });
      setDeleting(false);
      return;
    }

    const { error: membersErr } = await supabase
      .from("team_members")
      .delete()
      .eq("user_id", userId);

    if (membersErr) {
      setFeedback({ type: "error", message: `Failed to remove team membership: ${membersErr.message}` });
      setDeleting(false);
      return;
    }

    await supabase
      .from("teams")
      .update({ captain_id: "" })
      .eq("captain_id", userId);

    const { error: userErr } = await supabase
      .from("users")
      .delete()
      .eq("id", userId);

    if (userErr) {
      setFeedback({ type: "error", message: `Failed to delete user: ${userErr.message}` });
    } else {
      setFeedback({
        type: "success",
        message: "Player deleted. They will need to re-register to create a new account.",
      });
      setPlayers(players.filter((p) => p.id !== userId));
    }

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

        {/* Players Table */}
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-background border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase">
                      Player
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase">
                      Email
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase">
                      Role
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase">
                      Joined
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-muted text-xs uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredPlayers.map((player) => (
                    <tr key={player.id} className="hover:bg-background/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-navy/10 flex items-center justify-center text-xs font-bold text-navy">
                            {player.display_name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-foreground">
                            {player.display_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted">{player.email}</td>
                      <td className="px-4 py-3">
                        {player.role === "admin" ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-danger bg-danger/10 rounded-full px-2 py-0.5">
                            <Shield className="w-3 h-3" />
                            Admin
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted bg-background rounded-full px-2 py-0.5">
                            Player
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted text-xs">
                        {new Date(player.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {player.role !== "admin" && (
                          <>
                            {confirmDelete === player.id ? (
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="danger"
                                  size="sm"
                                  loading={deleting}
                                  onClick={() => deletePlayer(player.id)}
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
