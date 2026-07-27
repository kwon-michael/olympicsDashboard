"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Coins, Swords, Trophy, Check, X, AlertCircle, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { readableTextColor } from "@/lib/colors";
import {
  fetchWagerData,
  placeWager,
  wagersByMatch,
  isOpenForBets,
  stageLabel,
  type PlayoffMatch,
  type WagerData,
} from "@/lib/wagers";
import type { RosterTeam, Wager } from "@/lib/types";

// The captain playoff betting panel shown on the dashboard. Renders every Tug of
// War / Dodgeball bracket match with the captain's stake state, and lets them
// wager a single team point on a winner via the place_wager RPC.
//
// `preview` is the admin "view as captain" mode: the layout renders exactly as a
// captain sees it, but betting is disabled (UI only) — no writes happen.
export function WagerPanel({
  userId,
  preview = false,
}: {
  userId: string;
  preview?: boolean;
}) {
  const [data, setData] = useState<WagerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // The match+team the captain is about to confirm, keyed `${tournament}:${matchId}`.
  const [pendingPick, setPendingPick] = useState<{ key: string; teamId: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const next = await fetchWagerData(supabase, userId);
    setData(next);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  async function confirmBet(match: PlayoffMatch, teamId: string) {
    setSubmitting(true);
    setError(null);
    try {
      const supabase = createClient();
      await placeWager(supabase, match.tournament, match.id, teamId);
      setPendingPick(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't place that wager.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-card rounded-2xl border border-border p-6 flex items-center justify-center h-40">
        <Loader2 className="w-6 h-6 text-muted animate-spin" />
      </div>
    );
  }
  if (!data) return null;

  const { matches, teamsById, wagers, myTeam, wagerablePoints } = data;
  const byMatch = wagersByMatch(wagers);
  // In preview mode betting is always disabled, regardless of points.
  const canAfford = !preview && wagerablePoints >= 1;

  return (
    <div className="bg-card rounded-2xl border border-border p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-1 gap-3">
        <h2 className="font-display text-lg font-bold flex items-center gap-2">
          <Coins className="w-5 h-5 text-gold" />
          CAPTAIN&apos;S WAGER
          {preview && (
            <span className="text-[10px] font-bold uppercase tracking-wide text-amber-600 bg-amber-500/15 rounded-full px-2 py-0.5">
              Preview
            </span>
          )}
        </h2>
        {myTeam && (
          <div className="flex items-center gap-2 shrink-0">
            <span
              className="text-xs font-bold px-2.5 py-1 rounded-full"
              style={{ backgroundColor: myTeam.color, color: readableTextColor(myTeam.color) }}
            >
              {myTeam.name}
            </span>
            <span className="text-sm font-mono font-bold text-foreground">
              {wagerablePoints} pt{wagerablePoints !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>
      <p className="text-sm text-muted mb-4">
        {preview ? (
          <>This is what a captain sees. Stake <strong>1 point</strong> on a playoff
          winner — pick right and the team wins a point (net +1), pick wrong and it
          loses the point. Betting is disabled in preview.</>
        ) : (
          <>Stake <strong>1 point</strong> on a playoff winner. Pick right and your
          team wins a point (net +1); pick wrong and you lose the point.</>
        )}
      </p>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 flex items-center gap-2 text-sm text-danger bg-danger/10 rounded-lg px-3 py-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </motion.div>
      )}

      {!myTeam && !preview ? (
        <div className="text-center py-8 text-muted">
          <Swords className="w-10 h-10 mx-auto mb-3 opacity-60" />
          <p className="text-sm">
            Your captain account isn&apos;t linked to a player yet. Ask an admin to
            assign you one.
          </p>
        </div>
      ) : matches.length === 0 ? (
        <div className="text-center py-8 text-muted">
          <Swords className="w-10 h-10 mx-auto mb-3 opacity-60" />
          <p className="text-sm">No playoff matches are set yet. Check back once the brackets are drawn.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {matches.map((match) => {
            const key = `${match.tournament}:${match.id}`;
            return (
              <MatchRow
                key={key}
                match={match}
                teamsById={teamsById}
                wager={byMatch.get(key) ?? null}
                canAfford={canAfford}
                preview={preview}
                pendingTeamId={pendingPick?.key === key ? pendingPick.teamId : null}
                submitting={submitting}
                onPick={(teamId) => {
                  setError(null);
                  setPendingPick({ key, teamId });
                }}
                onCancel={() => setPendingPick(null)}
                onConfirm={(teamId) => confirmBet(match, teamId)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function MatchRow({
  match,
  teamsById,
  wager,
  canAfford,
  preview,
  pendingTeamId,
  submitting,
  onPick,
  onCancel,
  onConfirm,
}: {
  match: PlayoffMatch;
  teamsById: Map<string, RosterTeam>;
  wager: Wager | null;
  canAfford: boolean;
  preview: boolean;
  pendingTeamId: string | null;
  submitting: boolean;
  onPick: (teamId: string) => void;
  onCancel: () => void;
  onConfirm: (teamId: string) => void;
}) {
  const teamA = match.team_a ? teamsById.get(match.team_a) : undefined;
  const teamB = match.team_b ? teamsById.get(match.team_b) : undefined;
  const decided = match.winner_id != null;
  const open = isOpenForBets(match);
  const tournamentLabel = match.tournament === "tug" ? "Tug of War" : "Dodgeball";

  return (
    <div className="rounded-xl border border-border bg-background/50 p-3">
      {/* Match heading */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted flex items-center gap-1.5">
          <Swords className="w-3.5 h-3.5 text-indigo-500" />
          {tournamentLabel} · {stageLabel(match.stage)}
        </span>
        {wager && <StatusBadge wager={wager} />}
      </div>

      {/* Teams */}
      <div className="grid grid-cols-2 gap-2">
        {[teamA, teamB].map((team, i) => {
          if (!team) {
            return (
              <div
                key={i}
                className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted text-center"
              >
                TBD
              </div>
            );
          }
          const isPicked = wager?.picked_team_id === team.id;
          const isWinner = match.winner_id === team.id;
          const isPending = pendingTeamId === team.id;
          // Betting is only offered when the match is open and the captain has
          // no bet on it yet.
          const selectable = open && !wager && canAfford;

          return (
            <button
              key={team.id}
              type="button"
              disabled={!selectable || submitting}
              onClick={() => onPick(team.id)}
              className={`relative rounded-lg px-3 py-2 text-sm font-semibold text-left transition-all ${
                selectable ? "hover:ring-2 hover:ring-coral/40 cursor-pointer" : "cursor-default"
              } ${isPicked || isPending ? "ring-2 ring-coral" : "ring-1 ring-border"}`}
              style={{
                backgroundColor: team.color,
                color: readableTextColor(team.color),
                opacity: decided && !isWinner ? 0.5 : 1,
              }}
            >
              <span className="flex items-center justify-between gap-1">
                <span className="truncate">{team.name}</span>
                {isWinner && <Trophy className="w-3.5 h-3.5 shrink-0" />}
                {isPicked && !decided && <Check className="w-3.5 h-3.5 shrink-0" />}
              </span>
            </button>
          );
        })}
      </div>

      {/* Action / state footer */}
      <div className="mt-2 min-h-[1.25rem]">
        {pendingTeamId ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted">
              Stake 1 point on {teamsById.get(pendingTeamId)?.name}?
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => onConfirm(pendingTeamId)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-coral hover:bg-coral-light rounded-lg px-2.5 py-1 transition-colors disabled:opacity-60"
              >
                {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                Confirm
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={onCancel}
                className="inline-flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors"
              >
                <X className="w-3 h-3" />
                Cancel
              </button>
            </div>
          </div>
        ) : wager ? (
          <p className="text-xs text-muted">
            Your pick: <strong>{teamsById.get(wager.picked_team_id)?.name ?? "—"}</strong>
          </p>
        ) : decided ? (
          <p className="text-xs text-muted">
            Won by {teamsById.get(match.winner_id ?? "")?.name ?? "—"} — no bet placed.
          </p>
        ) : !open ? (
          <p className="text-xs text-muted">Waiting for both teams to be set.</p>
        ) : preview ? (
          <p className="text-xs text-muted">Preview — betting is disabled.</p>
        ) : !canAfford ? (
          <p className="text-xs text-muted">Your team has no points to wager.</p>
        ) : (
          <p className="text-xs text-muted">Tap a team to stake 1 point.</p>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ wager }: { wager: Wager }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "Pending", cls: "bg-warning/10 text-warning" },
    won: { label: "Won +1", cls: "bg-success/10 text-success" },
    lost: { label: "Lost −1", cls: "bg-danger/10 text-danger" },
    void: { label: "Void", cls: "bg-muted/10 text-muted" },
  };
  const s = map[wager.status] ?? map.pending;
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${s.cls}`}>
      {s.label}
    </span>
  );
}
