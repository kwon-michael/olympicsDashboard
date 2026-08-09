"use client";

import { AlertTriangle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { SoloEventCoverage } from "@/lib/solo";
import {
  GROUP_LABELS,
  groupRoundRobin,
  type GroupAssignment,
  type SeedStanding,
} from "@/lib/tournament";

/** Header/label colours, keyed so Tailwind sees whole class names. */
const ACCENTS = {
  indigo: { tile: "bg-indigo-500/10 text-indigo-500", text: "text-indigo-500" },
  orange: { tile: "bg-orange-500/10 text-orange-500", text: "text-orange-500" },
} as const;

interface LockGroupsDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  busy: boolean;
  /** Shown as the header eyebrow, e.g. "Tug of War". */
  tournament: string;
  accent: keyof typeof ACCENTS;
  /** One-line description of the seeding pattern. */
  rule: string;
  standings: SeedStanding[];
  /** The split this tournament would produce — the page's own `assignGroups`. */
  assignments: GroupAssignment[];
  /** Solo events still missing results, repeated here as a last warning. */
  soloGaps: SoloEventCoverage[];
}

/**
 * Confirms locking the standings into groups, showing the exact split that is
 * about to be written rather than describing it. Replaces the browser `confirm()`
 * these pages used to call: the decision hinges on *which* teams land together,
 * which a text-only prompt can't show.
 */
export function LockGroupsDialog({
  open,
  onClose,
  onConfirm,
  busy,
  tournament,
  accent,
  rule,
  standings,
  assignments,
  soloGaps,
}: LockGroupsDialogProps) {
  const standingById = new Map(standings.map((s) => [s.team.id, s]));
  const groups = GROUP_LABELS.map((label) => ({
    label,
    members: assignments
      .filter((a) => a.group_label === label)
      .sort((a, b) => a.seed - b.seed),
  })).filter((g) => g.members.length > 0);

  const matchCount = groups.reduce(
    (n, g) => n + groupRoundRobin(g.members.map((m) => m.team_id)).length,
    0
  );
  const colors = ACCENTS[accent];

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={busy}
      eyebrow={tournament}
      title="Lock & generate groups"
      icon={<Lock className="h-5 w-5" />}
      accentClassName={colors.tile}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-muted transition-colors hover:text-foreground disabled:opacity-50"
          >
            Cancel
          </button>
          <Button size="sm" loading={busy} onClick={onConfirm}>
            <Lock className="h-3.5 w-3.5" />
            Lock &amp; generate
          </Button>
        </>
      }
    >
      {soloGaps.length > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/[0.07] p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p className="text-xs leading-relaxed text-foreground">
            <span className="font-semibold">
              {soloGaps.length} solo{" "}
              {soloGaps.length === 1 ? "event isn't" : "events aren't"} fully
              scored
            </span>{" "}
            <span className="text-muted">
              ({soloGaps.map((g) => g.name).join(", ")}). The seeding below was
              drawn from those results as they stand.
            </span>
          </p>
        </div>
      )}

      <dl className="grid grid-cols-3 gap-2">
        <Stat label="Teams" value={assignments.length} />
        <Stat label="Groups" value={groups.length} />
        <Stat label="Matches" value={matchCount} />
      </dl>

      <p className="mt-4 text-xs text-muted">
        <span className={`font-semibold ${colors.text}`}>Seeding</span> {rule}
      </p>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {groups.map((g) => (
          <section
            key={g.label}
            className="rounded-xl border border-border bg-background p-3"
          >
            <h3 className="mb-2 font-display text-sm font-bold text-foreground">
              GROUP {g.label}
            </h3>
            <ul className="space-y-1.5">
              {g.members.map((m) => {
                const s = standingById.get(m.team_id);
                return (
                  <li
                    key={m.team_id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span className="w-4 shrink-0 font-mono text-xs text-muted">
                      {m.seed}
                    </span>
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: s?.team.color }}
                    />
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {s?.team.name}
                    </span>
                    <span className="shrink-0 font-mono text-xs text-muted">
                      {s?.totalPoints ?? 0}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-4 border-t border-border pt-4 text-xs leading-relaxed text-muted">
        This snapshots the standings as they are right now. Scores recorded later
        won&apos;t reshuffle these groups — changing them means resetting the
        tournament.
      </p>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-background px-3 py-2.5">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted">
        {label}
      </dt>
      <dd className="font-mono text-xl font-bold text-foreground">{value}</dd>
    </div>
  );
}
