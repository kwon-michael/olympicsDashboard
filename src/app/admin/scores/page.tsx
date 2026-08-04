"use client";
import { SkeletonList } from "@/components/ui/skeleton";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Trophy, Trash2, Plus, Minus, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageTransition } from "@/components/ui/page-transition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { TieAlert } from "@/components/admin/tie-alert";
import { logAudit } from "@/lib/audit";
import { fetchRosterData, type RosterData } from "@/lib/roster";
import { signedPoints } from "@/lib/penalties";
import type { RosterScore } from "@/lib/types";

type Direction = "award" | "deduct";

export default function AdminScoresPage() {
  const [data, setData] = useState<RosterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [teamId, setTeamId] = useState("");
  const [playerId, setPlayerId] = useState(""); // "" = whole team
  const [label, setLabel] = useState("");
  // A magnitude only — the sign comes from `direction`. Asking for "how many"
  // and "which way" separately means a mistyped minus can't quietly turn a
  // penalty into a reward.
  const [points, setPoints] = useState("");
  const [direction, setDirection] = useState<Direction>("award");
  const [formError, setFormError] = useState<string | null>(null);

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
  const teamColorById = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of data?.teams ?? []) m.set(t.id, t.color);
    return m;
  }, [data]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const pts = signedPoints(points, direction);
    if (!teamId) {
      setFormError("Pick a team first.");
      return;
    }
    if (!label.trim()) {
      setFormError("Give the entry a label so the leaderboard can explain it.");
      return;
    }
    if (pts === null) {
      setFormError("Points must be a whole number above zero.");
      return;
    }
    setFormError(null);

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
    } else {
      // A rejected write used to end here silently, leaving the admin looking
      // at a filled-in form they thought had saved. A deduction refused by RLS
      // is the likely case now.
      setFormError(error.message);
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
            Award or deduct points for a team or an individual player
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <SkeletonList rows={6} />
        </div>
      ) : (
        <>
          <TieAlert className="mb-6" />

          {/* Score entry form */}
          <form
            onSubmit={handleSubmit}
            className="bg-card rounded-2xl border border-border p-6 mb-8 space-y-4"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Team" htmlFor="score-team">
                <Select
                  id="score-team"
                  value={teamId}
                  onChange={(e) => {
                    setTeamId(e.target.value);
                    setPlayerId("");
                  }}
                  required
                  options={[
                    { value: "", label: "Select a team…" },
                    ...(data?.teams ?? []).map((t) => ({
                      value: t.id,
                      label: t.name,
                    })),
                  ]}
                />
              </Field>

              <Field label="Award to" htmlFor="score-player">
                <Select
                  id="score-player"
                  value={playerId}
                  onChange={(e) => setPlayerId(e.target.value)}
                  disabled={!teamId}
                  options={[
                    { value: "", label: "Whole team" },
                    ...teamPlayers.map((p) => ({
                      value: p.id,
                      label: p.is_active ? p.name : `${p.name} (crossed out)`,
                    })),
                  ]}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto_120px]">
              <Field label="Label" htmlFor="score-label">
                <Input
                  id="score-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder={
                    direction === "deduct"
                      ? "e.g. Late arrival, unsporting conduct"
                      : "e.g. 100m Dash, Tug of War win"
                  }
                  required
                />
              </Field>

              {/* Not a <Field>: its label points at a single control, and this
                  is a group of two. The group carries its own aria-label. */}
              <div>
                <span className="mb-1.5 block text-[11px] font-medium tracking-wide text-muted uppercase">
                  Award or deduct
                </span>
                <div
                  role="radiogroup"
                  aria-label="Award or deduct"
                  className="flex h-[42px] items-center gap-1 rounded-xl border border-border bg-card p-1"
                >
                  {(
                    [
                      { value: "award", label: "Award", icon: Plus },
                      { value: "deduct", label: "Deduct", icon: Minus },
                    ] as const
                  ).map(({ value, label: text, icon: Icon }) => {
                    const active = direction === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setDirection(value)}
                        className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                          active
                            ? value === "deduct"
                              ? "bg-danger text-white"
                              : "bg-success text-white"
                            : "text-muted hover:text-foreground"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {text}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Field label="Points" htmlFor="score-points">
                <Input
                  id="score-points"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                  placeholder="0"
                  required
                />
              </Field>
            </div>

            {formError && (
              <p className="flex items-center gap-1.5 text-xs text-danger">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {formError}
              </p>
            )}

            <div className="flex items-center justify-end gap-3">
              {points.trim() && (
                <span
                  className={`font-mono text-sm font-semibold tabular-nums ${
                    direction === "deduct" ? "text-danger" : "text-success"
                  }`}
                >
                  {direction === "deduct" ? "−" : "+"}
                  {points.trim()} pts
                </span>
              )}
              <Button
                type="submit"
                loading={saving}
                variant={direction === "deduct" ? "danger" : "primary"}
              >
                {direction === "deduct" ? (
                  <Minus className="w-4 h-4" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                {direction === "deduct" ? "Deduct Points" : "Award Points"}
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
                  className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-foreground/[0.02]"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          teamColorById.get(score.team_id) ?? "#94A3B8",
                      }}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {score.label}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {teamNameById.get(score.team_id) ?? "Team"}
                        {score.player_id
                          ? ` · ${playerNameById.get(score.player_id) ?? "Player"}`
                          : " · Team score"}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span
                      className={`font-mono text-lg font-semibold tabular-nums ${
                        score.points < 0 ? "text-danger" : ""
                      }`}
                    >
                      {score.points > 0 ? "+" : ""}
                      {score.points}
                    </span>
                    <button
                      onClick={() => handleDelete(score)}
                      aria-label={`Delete score: ${score.label}`}
                      className="rounded-lg p-1.5 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                      title="Delete score"
                    >
                      <Trash2 className="h-4 w-4" />
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
