"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, RotateCcw, ShieldAlert, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { logAudit } from "@/lib/audit";
import {
  ATTENDANCE_PENALTY_KIND,
  ATTENDANCE_PENALTY_POINTS,
  DEFAULT_LATE_CUTOFF,
  appliedAttendancePenalties,
  computeAttendancePenalties,
  penalizedPlayerIds,
  penaltyLabel,
  summarizePenalties,
} from "@/lib/penalties";
import type { CheckInEntry } from "@/lib/checkin";
import type { RosterScore } from "@/lib/types";

/**
 * The one-click attendance sweep, shown to admins on the check-in page.
 *
 * It reads the same list the desk has been tapping all morning and charges
 * every player who isn't on it — or who got on it late — {@link
 * ATTENDANCE_PENALTY_POINTS} against their team. One roster_scores row per
 * player, so the charge is attributable, shows on the team's own page, and can
 * be picked off individually in Score Management if someone was wronged.
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
  const existingRows = useMemo(
    () => appliedAttendancePenalties(scores),
    [scores]
  );
  const pending = useMemo(
    () => computeAttendancePenalties(entries, cutoff, already),
    [entries, cutoff, already]
  );
  const summary = summarizePenalties(pending);
  const charged = existingRows.reduce((sum, s) => sum + s.points, 0);

  async function apply() {
    if (pending.length === 0) return;
    const { late, absent, points } = summary;
    if (
      !confirm(
        `Charge ${pending.length} player${pending.length === 1 ? "" : "s"} ` +
          `(${late} late, ${absent} absent) ${points} points in total?`
      )
    )
      return;

    setBusy(true);
    setError(null);
    setApplied(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error: insertError } = await supabase.from("roster_scores").insert(
      pending.map((p) => ({
        team_id: p.entry.team.id,
        player_id: p.entry.player.id,
        label: penaltyLabel(p.reason),
        points: ATTENDANCE_PENALTY_POINTS,
        created_by: user?.id ?? null,
        // `kind` is what a re-run reads to skip these players; `cutoff` records
        // the line that was drawn, since it's editable above.
        metadata: {
          kind: ATTENDANCE_PENALTY_KIND,
          reason: p.reason,
          cutoff,
        },
      }))
    );

    if (insertError) {
      setError(insertError.message);
    } else {
      // One entry for the sweep rather than one per player — the individual
      // rows are already visible in Score Management.
      await logAudit(supabase, "create", "attendance_penalty", cutoff, {
        late,
        absent,
        points,
        players: pending.map((p) => p.entry.player.name),
      });
      setApplied(
        `Charged ${pending.length} player${pending.length === 1 ? "" : "s"} ${points} points.`
      );
      window.dispatchEvent(new Event("scores-updated"));
      await onChanged();
    }
    setBusy(false);
  }

  async function removeAll() {
    if (existingRows.length === 0) return;
    if (
      !confirm(
        `Remove all ${existingRows.length} attendance penalties and give back ${Math.abs(charged)} points?`
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
      setApplied(`Removed ${existingRows.length} penalties.`);
      window.dispatchEvent(new Event("scores-updated"));
      await onChanged();
    }
    setBusy(false);
  }

  return (
    <section className="mb-6 rounded-2xl border border-danger/25 bg-danger/[0.03] p-4">
      <div className="mb-3 flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 shrink-0 text-danger" />
        <h2 className="font-display text-sm font-bold text-foreground">
          ATTENDANCE PENALTIES
        </h2>
        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold tracking-wide text-muted uppercase">
          Admins only
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-foreground">
            Late after
          </span>
          <input
            type="datetime-local"
            value={cutoff}
            onChange={(e) => setCutoff(e.target.value)}
            className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm text-foreground focus:border-coral focus:ring-2 focus:ring-coral/30 focus:outline-none"
          />
        </label>

        <p className="flex-1 text-xs leading-relaxed text-muted">
          {pending.length === 0 ? (
            existingRows.length > 0 ? (
              "Everyone who owes a penalty has already been charged."
            ) : (
              "Nobody is late or absent as things stand."
            )
          ) : (
            <>
              <span className="font-semibold text-foreground">
                {summary.absent} absent
              </span>{" "}
              ·{" "}
              <span className="font-semibold text-foreground">
                {summary.late} late
              </span>{" "}
              →{" "}
              <span className="font-semibold text-danger">
                {summary.points} pts
              </span>{" "}
              across {summary.teams} team{summary.teams === 1 ? "" : "s"}
              <br />
              {ATTENDANCE_PENALTY_POINTS} each, charged to their team.
            </>
          )}
        </p>

        <Button
          onClick={apply}
          loading={busy}
          disabled={pending.length === 0}
          variant="danger"
          size="sm"
        >
          Apply {pending.length > 0 ? `${summary.points} pts` : "penalties"}
        </Button>
      </div>

      {existingRows.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-danger/15 pt-3">
          <p className="flex-1 text-xs text-muted">
            <span className="font-semibold text-foreground">
              {existingRows.length} charged so far
            </span>{" "}
            ({charged} pts). Remove one at a time in Score Management, or clear
            the lot.
          </p>
          <button
            onClick={removeAll}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-foreground/20 hover:text-foreground disabled:opacity-50"
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
    </section>
  );
}
