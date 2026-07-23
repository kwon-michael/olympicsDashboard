"use client";
import { SkeletonList } from "@/components/ui/skeleton";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Trophy, Trash2, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageTransition } from "@/components/ui/page-transition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { logAudit } from "@/lib/audit";
import { fetchRosterData, type RosterData } from "@/lib/roster";
import type { RosterScore } from "@/lib/types";

export default function AdminScoresPage() {
  const [data, setData] = useState<RosterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [teamId, setTeamId] = useState("");
  const [playerId, setPlayerId] = useState(""); // "" = whole team
  const [label, setLabel] = useState("");
  const [points, setPoints] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient();
    setData(await fetchRosterData(supabase));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const teamPlayers = useMemo(
    () => (data?.players ?? []).filter((p) => p.team_id === teamId),
    [data, teamId]
  );
  const teamName = useMemo(
    () => data?.teams.find((t) => t.id === teamId)?.name ?? "",
    [data, teamId]
  );
  const playerNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of data?.players ?? []) m.set(p.id, p.name);
    return m;
  }, [data]);
  const teamNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of data?.teams ?? []) m.set(t.id, t.name);
    return m;
  }, [data]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const pts = parseInt(points, 10);
    if (!teamId || !label.trim() || Number.isNaN(pts)) return;

    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: inserted, error } = await supabase
      .from("roster_scores")
      .insert({
        team_id: teamId,
        player_id: playerId || null,
        label: label.trim(),
        points: pts,
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();

    if (!error) {
      await logAudit(
        supabase,
        "create",
        "roster_score",
        teamId,
        {
          team: teamName,
          player: playerId ? playerNameById.get(playerId) : null,
          label: label.trim(),
          points: pts,
        },
        {
          table: "roster_scores",
          rowId: inserted.id,
          after: { team_id: teamId, label: label.trim(), points: pts },
        }
      );
      setLabel("");
      setPoints("");
      setPlayerId("");
      window.dispatchEvent(new Event("scores-updated"));
      await load();
    }
    setSaving(false);
  }

  async function handleDelete(score: RosterScore) {
    const supabase = createClient();
    const { error } = await supabase
      .from("roster_scores")
      .delete()
      .eq("id", score.id);
    if (!error) {
      await logAudit(
        supabase,
        "delete",
        "roster_score",
        score.team_id,
        {
          team: teamNameById.get(score.team_id),
          label: score.label,
          points: score.points,
        },
        {
          table: "roster_scores",
          rowId: score.id,
          // Full row so a revert can re-insert the score as it was.
          before: { ...score },
        }
      );
      window.dispatchEvent(new Event("scores-updated"));
      await load();
    }
  }

  const recentScores = data?.scores ?? [];

  return (
    <PageTransition className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Admin
      </Link>

      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center">
          <Trophy className="w-6 h-6 text-gold" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            SCORE MANAGEMENT
          </h1>
          <p className="text-sm text-muted">
            Award points to a team or an individual player
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <SkeletonList rows={6} />
        </div>
      ) : (
        <>
          {/* Score entry form */}
          <form
            onSubmit={handleSubmit}
            className="bg-card rounded-2xl border border-border p-6 mb-8 space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Team
                </label>
                <select
                  value={teamId}
                  onChange={(e) => {
                    setTeamId(e.target.value);
                    setPlayerId("");
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-coral/30 focus:border-coral"
                  required
                >
                  <option value="">Select a team…</option>
                  {data?.teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Award to
                </label>
                <select
                  value={playerId}
                  onChange={(e) => setPlayerId(e.target.value)}
                  disabled={!teamId}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-coral/30 focus:border-coral disabled:opacity-50"
                >
                  <option value="">Whole team</option>
                  {teamPlayers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.is_active ? "" : " (crossed out)"}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Label
                </label>
                <Input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. 100m Dash, Tug of War win"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Points
                </label>
                <Input
                  type="number"
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                  placeholder="0"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" loading={saving}>
                <Plus className="w-4 h-4" />
                Add Score
              </Button>
            </div>
          </form>

          {/* Recent scores */}
          <h2 className="font-display text-lg font-bold text-foreground mb-4">
            RECENT SCORES
          </h2>
          {recentScores.length > 0 ? (
            <div className="bg-card rounded-2xl border border-border divide-y divide-border overflow-hidden">
              {recentScores.map((score) => (
                <div
                  key={score.id}
                  className="flex items-center justify-between px-4 py-3 gap-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {score.label}
                    </p>
                    <p className="text-xs text-muted truncate">
                      {teamNameById.get(score.team_id) ?? "Team"}
                      {score.player_id
                        ? ` · ${playerNameById.get(score.player_id) ?? "Player"}`
                        : " · Team score"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono text-lg font-bold text-foreground">
                      {score.points > 0 ? "+" : ""}
                      {score.points}
                    </span>
                    <button
                      onClick={() => handleDelete(score)}
                      className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                      title="Delete score"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted text-center py-10">
              No scores recorded yet.
            </p>
          )}
        </>
      )}
    </PageTransition>
  );
}
