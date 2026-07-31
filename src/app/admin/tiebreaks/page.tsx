"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Scale, Trash2, Check, ChevronUp, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageTransition } from "@/components/ui/page-transition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { SkeletonList } from "@/components/ui/skeleton";
import { RankBadge } from "@/components/ui/rank-badge";
import { logAudit } from "@/lib/audit";
import { fetchRosterData, activeTeamSizes, type RosterData } from "@/lib/roster";
import { fetchSoloResults } from "@/lib/solo";
import { fetchTugData, type TugData } from "@/lib/tug";
import { fetchDodgeballData, type DodgeballData } from "@/lib/dodgeball";
import { computeStandings } from "@/lib/standings";
import {
  fetchTiebreaks,
  findTieGroups,
  inactiveTiebreaks,
  teamKeyOf,
  type Tiebreak,
  type TieGroup,
  type TiebreakBoard,
} from "@/lib/tiebreak";
import { readableTextColor } from "@/lib/colors";
import { ordinal } from "@/lib/utils";
import type { RosterTeam, SoloResult } from "@/lib/types";

const BOARD_LABEL: Record<TiebreakBoard, string> = {
  teams: "Team standings",
  solo: "Solo standings",
};

export default function AdminTiebreaksPage() {
  const [data, setData] = useState<RosterData | null>(null);
  const [solo, setSolo] = useState<SoloResult[]>([]);
  const [tiebreaks, setTiebreaks] = useState<Tiebreak[]>([]);
  // Both tournaments feed the team totals, so ties have to be found on a board
  // that includes them — not on manual points alone.
  const [tug, setTug] = useState<TugData | null>(null);
  const [dodge, setDodge] = useState<DodgeballData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [roster, soloResults, tiebreakRows, tugData, dodgeData] =
      await Promise.all([
        fetchRosterData(supabase),
        fetchSoloResults(supabase),
        fetchTiebreaks(supabase),
        fetchTugData(supabase),
        fetchDodgeballData(supabase),
      ]);
    setData(roster);
    setSolo(soloResults);
    setTiebreaks(tiebreakRows);
    setTug(tugData);
    setDodge(dodgeData);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener("scores-updated", handler);
    return () => window.removeEventListener("scores-updated", handler);
  }, [load]);

  // Ties are detected on the raw standings: once a resolution is applied the
  // tied rows no longer share a rank.
  const groups = useMemo<TieGroup[]>(() => {
    if (!data) return [];
    const { rawTeams, rawSolo } = computeStandings(
      data.teams,
      data.scores,
      solo,
      tiebreaks,
      {
        tug: tug?.matches,
        dodgeball: dodge?.matches,
        teamSizes: activeTeamSizes(data.players),
      }
    );
    return [
      ...findTieGroups(rawTeams, "teams", tiebreaks),
      ...findTieGroups(rawSolo, "solo", tiebreaks),
    ];
  }, [data, solo, tiebreaks, tug, dodge]);

  const unresolved = groups.filter((g) => g.resolution === null);
  const resolved = groups.filter((g) => g.resolution !== null);
  const stale = useMemo(
    () => inactiveTiebreaks(tiebreaks, groups),
    [tiebreaks, groups]
  );

  async function saveOrder(
    group: TieGroup,
    orderedTeamIds: string[],
    note: string
  ) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const teamNames = orderedTeamIds
      .map((id) => data?.teams.find((t) => t.id === id)?.name ?? "?")
      .join(" > ");
    const details = {
      board: group.board,
      rank: group.rank,
      points: group.points,
      order: teamNames,
      note: note.trim() || null,
    };

    const row = {
      board: group.board,
      team_key: teamKeyOf(orderedTeamIds),
      team_ids: orderedTeamIds,
      tied_rank: group.rank,
      tied_points: group.points,
      note: note.trim() || null,
      decided_by: user?.id ?? null,
    };

    const prior = group.resolution;
    if (prior) {
      const { error } = await supabase
        .from("tiebreaks")
        .update(row)
        .eq("id", prior.id);
      if (error) return error.message;
      await logAudit(supabase, "update", "tiebreak", prior.id, details, {
        table: "tiebreaks",
        rowId: prior.id,
        before: { team_ids: prior.team_ids, note: prior.note },
        after: { team_ids: orderedTeamIds, note: row.note },
      });
    } else {
      const { data: inserted, error } = await supabase
        .from("tiebreaks")
        .insert(row)
        .select("id")
        .single();
      if (error || !inserted) return error?.message ?? "Could not save.";
      await logAudit(supabase, "create", "tiebreak", inserted.id, details, {
        table: "tiebreaks",
        rowId: inserted.id,
        after: row,
      });
    }

    window.dispatchEvent(new Event("scores-updated"));
    await load();
    return null;
  }

  async function removeTiebreak(t: Tiebreak) {
    const supabase = createClient();
    const { error } = await supabase.from("tiebreaks").delete().eq("id", t.id);
    if (error) return;
    await logAudit(
      supabase,
      "delete",
      "tiebreak",
      t.id,
      { board: t.board, rank: t.tied_rank, points: t.tied_points },
      { table: "tiebreaks", rowId: t.id, before: { ...t } }
    );
    window.dispatchEvent(new Event("scores-updated"));
    await load();
  }

  const teamById = useMemo(
    () => new Map((data?.teams ?? []).map((t) => [t.id, t])),
    [data]
  );

  return (
    <PageTransition className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/admin"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Admin
      </Link>

      <div className="mb-8 flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-info/10">
          <Scale className="h-6 w-6 text-info" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Tiebreaks
          </h1>
          <p className="text-sm text-muted">
            Record the result of a tiebreaker game played outside the app. This
            sets the listed order only — no team&apos;s points change.
          </p>
        </div>
      </div>

      {loading ? (
        <SkeletonList rows={3} />
      ) : (
        <div className="space-y-10">
          <section>
            <h2 className="font-display mb-1 text-base font-semibold">
              Needs a tiebreaker
            </h2>
            <p className="mb-4 text-xs text-muted">
              Ties inside the top 3 that decide a placing. Ties at 4th or below,
              and teams level on zero, are left alone.
            </p>
            {unresolved.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center">
                <p className="font-display text-base font-semibold">
                  No ties to settle
                </p>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
                  You&apos;ll see a prompt here — and on the admin dashboard — the
                  moment two or more teams finish level inside the top 3.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {unresolved.map((group) => (
                  <TieGroupCard
                    key={`${group.board}:${group.teamKey}`}
                    group={group}
                    onSave={saveOrder}
                  />
                ))}
              </div>
            )}
          </section>

          {resolved.length > 0 && (
            <section>
              <h2 className="font-display mb-1 text-base font-semibold">
                Settled
              </h2>
              <p className="mb-4 text-xs text-muted">
                Live on the leaderboard now. Reorder to correct a result, or
                clear it to put the teams back to a shared rank.
              </p>
              <div className="space-y-3">
                {resolved.map((group) => (
                  <TieGroupCard
                    key={`${group.board}:${group.teamKey}`}
                    group={group}
                    onSave={saveOrder}
                    onRemove={removeTiebreak}
                  />
                ))}
              </div>
            </section>
          )}

          {stale.length > 0 && (
            <section>
              <h2 className="font-display mb-1 text-base font-semibold">
                No longer applies
              </h2>
              <p className="mb-4 text-xs text-muted">
                These teams aren&apos;t level any more, or a different team joined
                the tie. Kept for the record and having no effect — safe to clear.
              </p>
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                {stale.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-4 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {t.team_ids
                          .map((id) => teamById.get(id)?.name ?? "Removed team")
                          .join(" › ")}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {BOARD_LABEL[t.board]} · was {ordinal(t.tied_rank)} on{" "}
                        {t.tied_points} pts
                        {t.note ? ` · ${t.note}` : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => removeTiebreak(t)}
                      aria-label="Delete this tiebreak record"
                      title="Delete"
                      className="shrink-0 rounded-lg p-2 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </PageTransition>
  );
}

/**
 * One tie, with the tied teams in a reorderable list. The admin moves them into
 * the order the external game produced; index 0 is the winner.
 */
function TieGroupCard({
  group,
  onSave,
  onRemove,
}: {
  group: TieGroup;
  onSave: (
    group: TieGroup,
    orderedTeamIds: string[],
    note: string
  ) => Promise<string | null>;
  onRemove?: (t: Tiebreak) => void;
}) {
  // Seed from the stored result when there is one, otherwise standings order.
  // Intersected with the teams actually tied so the order can never reference a
  // team that isn't shown — which would misalign the reorder buttons.
  const initial = useMemo(() => {
    const tiedIds = group.teams.map((t) => t.id);
    const stored = (group.resolution?.team_ids ?? []).filter((id) =>
      tiedIds.includes(id)
    );
    return [...stored, ...tiedIds.filter((id) => !stored.includes(id))];
  }, [group]);

  const [order, setOrder] = useState<string[]>(initial);
  const [note, setNote] = useState(group.resolution?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const teamById = new Map(group.teams.map((t) => [t.id, t]));
  const rows = order
    .map((id) => teamById.get(id))
    .filter((t): t is RosterTeam => !!t);

  const dirty =
    JSON.stringify(order) !== JSON.stringify(initial) ||
    note !== (group.resolution?.note ?? "");

  function move(index: number, delta: number) {
    const next = [...order];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
  }

  async function save() {
    setSaving(true);
    setError(null);
    const message = await onSave(group, order, note);
    if (message) setError(message);
    setSaving(false);
  }

  const fieldId = `tb-note-${group.board}-${group.teamKey}`;

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-info/40 bg-info/10 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-info uppercase">
          {BOARD_LABEL[group.board]}
        </span>
        <span className="text-sm font-medium">
          {group.teams.length}-way tie for {ordinal(group.rank)}
        </span>
        <span className="font-mono text-xs tabular-nums text-muted">
          {group.points} pts each
        </span>
      </div>

      <ol className="mb-3 divide-y divide-border overflow-hidden rounded-xl border border-border">
        {rows.map((team, i) => (
          <li key={team.id} className="flex items-center gap-3 px-3 py-2.5">
            <RankBadge rank={group.rank + i} />
            <span
              aria-hidden
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[11px] font-bold"
              style={{
                backgroundColor: team.color,
                color: readableTextColor(team.color),
              }}
            >
              {team.name.charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {team.name}
            </span>
            <span className="shrink-0 text-xs text-muted">
              {ordinal(i + 1)} in tiebreaker
            </span>
            <div className="flex shrink-0 flex-col">
              <button
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label={`Move ${team.name} up`}
                className="rounded p-0.5 text-muted transition-colors hover:text-foreground disabled:opacity-30"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                onClick={() => move(i, 1)}
                disabled={i === rows.length - 1}
                aria-label={`Move ${team.name} down`}
                className="rounded p-0.5 text-muted transition-colors hover:text-foreground disabled:opacity-30"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ol>

      <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_auto]">
        <Field label="What was played (optional)" htmlFor={fieldId}>
          <Input
            id={fieldId}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Rock-paper-scissors, best of 3"
            error={error || undefined}
          />
        </Field>
        <div className="flex items-center gap-2">
          <Button onClick={save} loading={saving} size="sm" disabled={!dirty}>
            <Check className="h-4 w-4" />
            {group.resolution ? "Update order" : "Save order"}
          </Button>
          {group.resolution && onRemove && (
            <button
              onClick={() => onRemove(group.resolution!)}
              disabled={saving}
              aria-label="Clear this tiebreak"
              title="Clear tiebreak"
              className="rounded-lg p-2 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
