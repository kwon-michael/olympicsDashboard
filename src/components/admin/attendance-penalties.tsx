"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, RotateCcw, ShieldAlert, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { logAudit } from "@/lib/audit";
import {
  ATTENDANCE_BONUS_KIND,
  ATTENDANCE_PENALTY_KIND,
  ATTENDANCE_PENALTY_POINTS,
  DEFAULT_LATE_CUTOFF,
  PUNCTUAL_TEAM_BONUS_LABEL,
  PUNCTUAL_TEAM_BONUS_POINTS,
  appliedAttendanceRows,
  bonusedTeamIds,
  computeAttendancePenalties,
  computePunctualTeamBonuses,
  penalizedPlayerIds,
  penaltyLabel,
  summarizeSweep,
} from "@/lib/penalties";
import type { CheckInEntry } from "@/lib/checkin";
import type { RosterScore } from "@/lib/types";

/**
 * The success line after a sweep. Built up piecewise because either half can be
 * empty — an all-punctual morning charges nobody, and an early sweep may award
 * nobody, and neither should produce a sentence about zero of something.
 */
function summarizeApplied(
  charged: number,
  awarded: number,
  netPoints: number
): string {
  const parts: string[] = [];
  if (charged > 0) {
    parts.push(`Charged ${charged} player${charged === 1 ? "" : "s"}`);
  }
  if (awarded > 0) {
    parts.push(
      `${parts.length > 0 ? "awarded" : "Awarded"} ${awarded} full team${
        awarded === 1 ? "" : "s"
      }`
    );
  }
  return `${parts.join(" and ")} — ${netPoints > 0 ? "+" : ""}${netPoints} pts net.`;
}

/**
 * The one-click attendance sweep, shown to admins on the check-in page.
 *
 * It reads the same list the desk has been tapping all morning and settles it
 * both ways: every player who isn't on it — or who got on it late — costs their
 * team {@link ATTENDANCE_PENALTY_POINTS}, and every team that turned up
 * complete earns {@link PUNCTUAL_TEAM_BONUS_POINTS}.
 *
 * One roster_scores row per charge, so it's attributable, shows on the team's
 * own page, and can be picked off individually in Score Management if someone
 * was wronged. Bonus rows carry no player_id — the team earned it, not any one
 * person on it.
 *
 * Rendered only for admins (see the caller). Volunteers work the door but don't
 * decide what it costs.
 */
export function AttendancePenalties({
  entries,
  scores,
  onChanged,
}: {
  entries: CheckInEntry[];
  scores: RosterScore[];
  onChanged: () => Promise<void> | void;
}) {
  const [cutoff, setCutoff] = useState(DEFAULT_LATE_CUTOFF);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<string | null>(null);

  const already = useMemo(() => penalizedPlayerIds(scores), [scores]);
  const awarded = useMemo(() => bonusedTeamIds(scores), [scores]);
  const existingRows = useMemo(() => appliedAttendanceRows(scores), [scores]);
  const pending = useMemo(
    () => computeAttendancePenalties(entries, cutoff, already),
    [entries, cutoff, already]
  );
  const bonuses = useMemo(
    () => computePunctualTeamBonuses(entries, cutoff, awarded),
    [entries, cutoff, awarded]
  );
  const summary = summarizeSweep(pending, bonuses);
  const charged = existingRows.reduce((sum, s) => sum + s.points, 0);
  const nothingToDo = pending.length === 0 && bonuses.length === 0;

  async function apply() {
    if (nothingToDo) return;
    const { late, absent, penaltyPoints, bonusPoints, netPoints } = summary;
    const parts: string[] = [];
    if (pending.length > 0) {
      parts.push(
        `charge ${pending.length} player${pending.length === 1 ? "" : "s"} ` +
          `(${late} late, ${absent} absent) ${penaltyPoints} points`
      );
    }
    if (bonuses.length > 0) {
      parts.push(
        `award ${bonuses.length} full team${bonuses.length === 1 ? "" : "s"} ` +
          `+${bonusPoints} points`
      );
    }
    if (!confirm(`${parts.join(" and ")} — ${netPoints} net?`)) return;

    setBusy(true);
    setError(null);
    setApplied(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // `kind` is what a re-run reads to skip these players and teams; `cutoff`
    // records the line that was drawn, since it's editable above. Both halves
    // go in one insert so a failure leaves neither applied.
    const { error: insertError } = await supabase.from("roster_scores").insert([
      ...pending.map((p) => ({
        team_id: p.entry.team.id,
        player_id: p.entry.player.id,
        label: penaltyLabel(p.reason),
        points: ATTENDANCE_PENALTY_POINTS,
        created_by: user?.id ?? null,
        metadata: {
          kind: ATTENDANCE_PENALTY_KIND,
          reason: p.reason,
          cutoff,
        },
      })),
      ...bonuses.map((b) => ({
        team_id: b.team.id,
        player_id: null,
        label: PUNCTUAL_TEAM_BONUS_LABEL,
        points: PUNCTUAL_TEAM_BONUS_POINTS,
        created_by: user?.id ?? null,
        metadata: {
          kind: ATTENDANCE_BONUS_KIND,
          players: b.players,
          cutoff,
        },
      })),
    ]);

    if (insertError) {
      setError(insertError.message);
    } else {
      // One entry for the sweep rather than one per player — the individual
      // rows are already visible in Score Management.
      await logAudit(supabase, "create", "attendance_penalty", cutoff, {
        late,
        absent,
        penaltyPoints,
        bonusTeams: bonuses.length,
        bonusPoints,
        netPoints,
        players: pending.map((p) => p.entry.player.name),
        teams: bonuses.map((b) => b.team.name),
      });
      setApplied(summarizeApplied(pending.length, bonuses.length, netPoints));
      window.dispatchEvent(new Event("scores-updated"));
      await onChanged();
    }
    setBusy(false);
  }

  async function removeAll() {
    if (existingRows.length === 0) return;
    // `charged` is the net of penalties and bonuses, so undoing it can take
    // points away as easily as give them back — say which, rather than
    // assuming a refund the way this did when the sweep only ever deducted.
    if (
      !confirm(
        `Remove all ${existingRows.length} attendance adjustments? ` +
          `Standings move by ${-charged > 0 ? "+" : ""}${-charged} points.`
      )
    )
      return;

    setBusy(true);
    setError(null);
    setApplied(null);

    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("roster_scores")
      .delete()
      .in(
        "id",
        existingRows.map((s) => s.id)
      );

    if (deleteError) {
      setError(deleteError.message);
    } else {
      await logAudit(supabase, "delete", "attendance_penalty", cutoff, {
        removed: existingRows.length,
        points: -charged,
      });
      setApplied(`Removed ${existingRows.length} attendance adjustments.`);
      window.dispatchEvent(new Event("scores-updated"));
      await onChanged();
    }
    setBusy(false);
  }

  return (
    // Neutral rather than the old red wash: the sweep gives points as often as
    // it takes them, so the box shouldn't read as a warning before you've even
    // looked at it. The two tiles below carry the colour instead.
    <section className="mb-6 overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border bg-background/40 px-4 py-3">
        <ShieldAlert className="h-4 w-4 shrink-0 text-warning" />
        <h2 className="font-display text-sm font-bold text-foreground">
          ATTENDANCE ADJUSTMENTS
        </h2>
        <span className="ml-auto shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold tracking-wide text-muted uppercase">
          Admins only
        </span>
      </div>

      <div className="p-4">
        {/* The cutoff and the button are the only two controls, so they get a
            row to themselves — the summary underneath can then grow to as many
            lines as it likes without dragging them around with it. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-foreground">
              Late after
            </span>
            <input
              type="datetime-local"
              value={cutoff}
              onChange={(e) => setCutoff(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm text-foreground focus:border-coral focus:ring-2 focus:ring-coral/30 focus:outline-none sm:w-auto"
            />
          </label>

          <Button
            onClick={apply}
            loading={busy}
            disabled={nothingToDo}
            // Drop the red when the sweep is only handing points out, so the
            // button doesn't read as a punishment when nobody is being punished.
            variant={pending.length === 0 ? "primary" : "danger"}
            size="sm"
            className="w-full sm:w-auto"
          >
            Apply{" "}
            {nothingToDo
              ? "adjustments"
              : `${summary.netPoints > 0 ? "+" : ""}${summary.netPoints} pts`}
          </Button>
        </div>

        <p className="mt-2 text-[11px] leading-relaxed text-muted">
          Moving this time only redraws the preview — nothing is written until
          you press Apply. {ATTENDANCE_PENALTY_POINTS} per player who missed the
          cutoff, +{PUNCTUAL_TEAM_BONUS_POINTS} per team that didn&apos;t.
        </p>

        {/* Both halves always shown, greyed when empty, so the pair keeps the
            same shape as the morning goes on instead of popping in and out. */}
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <PreviewTile
            tone="danger"
            points={summary.penaltyPoints}
            idle={pending.length === 0}
            headline={`${summary.late} late · ${summary.absent} absent`}
            caption={`across ${summary.teams} team${summary.teams === 1 ? "" : "s"}`}
            idleLabel={
              existingRows.length > 0 ? "All charged already" : "Nobody to charge"
            }
          />
          <PreviewTile
            tone="success"
            points={summary.bonusPoints}
            idle={bonuses.length === 0}
            headline={`${summary.bonusTeams} full team${summary.bonusTeams === 1 ? "" : "s"}`}
            caption="everyone in before the cutoff"
            idleLabel={
              existingRows.length > 0 ? "All awarded already" : "No complete teams"
            }
          />
        </div>

        {existingRows.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <p className="flex-1 text-xs text-muted">
              <span className="font-semibold text-foreground">
                {existingRows.length} applied so far
              </span>{" "}
              ({charged > 0 ? "+" : ""}
              {charged} pts net). Remove one at a time in Score Management, or
              clear the lot.
            </p>
            <button
              onClick={removeAll}
              disabled={busy}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-foreground/20 hover:text-foreground disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Remove all
            </button>
          </div>
        )}

        {applied && (
          <p className="mt-3 text-xs font-semibold text-success">{applied}</p>
        )}

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 p-2.5">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" />
            <p className="flex-1 text-xs text-danger">{error}</p>
            <button
              onClick={() => setError(null)}
              aria-label="Dismiss"
              className="text-danger/70 transition-colors hover:text-danger"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * One side of the sweep, previewed. Kept as a pair of equal tiles rather than a
 * run of prose so the penalty and the bonus read as two halves of one decision,
 * and so neither changes the box's height as the numbers move.
 */
function PreviewTile({
  tone,
  points,
  idle,
  headline,
  caption,
  idleLabel,
}: {
  tone: "danger" | "success";
  points: number;
  /** Nothing due on this side — greyed out rather than shouting a zero. */
  idle: boolean;
  headline: string;
  caption: string;
  idleLabel: string;
}) {
  const box = idle
    ? "border-border bg-background/40"
    : tone === "danger"
      ? "border-danger/25 bg-danger/[0.04]"
      : "border-success/25 bg-success/[0.04]";
  const figure = idle
    ? "text-muted"
    : tone === "danger"
      ? "text-danger"
      : "text-success";

  return (
    <div className={`rounded-xl border px-3 py-2.5 ${box}`}>
      <p className={`font-display text-lg leading-none font-bold ${figure}`}>
        {points > 0 ? "+" : ""}
        {points} pts
      </p>
      {idle ? (
        <p className="mt-1.5 text-[11px] text-muted">{idleLabel}</p>
      ) : (
        <>
          <p className="mt-1.5 text-xs font-medium text-foreground">
            {headline}
          </p>
          <p className="text-[11px] text-muted">{caption}</p>
        </>
      )}
    </div>
  );
}
