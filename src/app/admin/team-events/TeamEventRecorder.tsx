"use client";
import { SkeletonList } from "@/components/ui/skeleton";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Trash2, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageTransition } from "@/components/ui/page-transition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { logAudit } from "@/lib/audit";
import { fetchRosterData, type RosterData } from "@/lib/roster";
import { recorderTeamEvents, recorderScoreLabel, computeRelayStandings } from "@/lib/teamEvents";
import {
  computeTeamComponentValue,
  parseInputToDbValue,
  type EventRule,
  type TeamScoreComponent,
} from "@/lib/events";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { RecorderCard } from "@/components/admin/recorder-card";
import { TieAlert } from "@/components/admin/tie-alert";
import { ordinal } from "@/lib/utils";
import type { RosterScore } from "@/lib/types";

/** metadata value → the string the form should show. */
function metaString(row: RosterScore | undefined, key: string): string {
  const v = row?.metadata?.[key];
  return v === undefined || v === null ? "" : String(v);
}
function metaNumber(row: RosterScore | undefined, key: string): number | null {
  const v = row?.metadata?.[key];
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Per-team recorder for a single component/rank-by-time team event (Tail Grab or
 * the Conditional Relay). Computes points automatically and writes them as
 * roster_scores rows so they flow into the leaderboard.
 */
export function TeamEventRecorder({ slug }: { slug: string }) {
  const eventSlug = slug;
  const [data, setData] = useState<RosterData | null>(null);
  const [loading, setLoading] = useState(true);
  // Unsaved edits keyed by `${eventSlug}:${teamId}`. Inner keys are component
  // keys (components method) or "time" (rank-by-time). Absent keys fall back to
  // the saved row.
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({});
  const [savingTeam, setSavingTeam] = useState<string | null>(null);
  const [errorTeam, setErrorTeam] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const supabase = createClient();
    setData(await fetchRosterData(supabase));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const event = useMemo<EventRule | undefined>(
    () => recorderTeamEvents.find((e) => e.slug === eventSlug),
    [eventSlug]
  );
  const method = event?.teamScoring?.method;
  const label = event ? recorderScoreLabel(event) : "";

  // The recorder-owned roster_scores row for each team in this event (matched by
  // the event-name label). One per team; manual scores use different labels.
  const savedByTeam = useMemo(() => {
    const m = new Map<string, RosterScore>();
    if (!data || !event) return m;
    for (const s of data.scores) {
      if (s.label === label && !m.has(s.team_id)) m.set(s.team_id, s);
    }
    return m;
  }, [data, event, label]);

  const editKey = (teamId: string) => `${eventSlug}:${teamId}`;
  const inputValue = (teamId: string, key: string): string => {
    const e = edits[editKey(teamId)];
    if (e && e[key] !== undefined) return e[key];
    return metaString(savedByTeam.get(teamId), key);
  };
  const setInput = (teamId: string, key: string, value: string) =>
    setEdits((prev) => ({
      ...prev,
      [editKey(teamId)]: { ...prev[editKey(teamId)], [key]: value },
    }));
  const clearEdit = (teamId: string) =>
    setEdits((prev) => {
      const next = { ...prev };
      delete next[editKey(teamId)];
      return next;
    });

  // Rank-by-time keeps the admin's raw entry under `timeRaw` in metadata while
  // the form keys the edit as `time`, so the saved value needs resolving by
  // hand — `inputValue(id, "time")` would always miss and blank the field.
  const savedTimeRaw = (teamId: string) =>
    metaString(savedByTeam.get(teamId), "timeRaw");
  const timeValue = (teamId: string): string => {
    const e = edits[editKey(teamId)];
    if (e && e.time !== undefined) return e.time;
    return savedTimeRaw(teamId);
  };

  /** True when this team holds edits that differ from what's stored. */
  const isDirty = (teamId: string): boolean => {
    const e = edits[editKey(teamId)];
    if (!e) return false;
    const saved = savedByTeam.get(teamId);
    return Object.entries(e).some(([key, value]) =>
      key === "time"
        ? value !== savedTimeRaw(teamId)
        : value !== metaString(saved, key)
    );
  };

  const setErr = (teamId: string, msg: string) =>
    setErrorTeam((e) => ({ ...e, [teamId]: msg }));

  /* ---------------- components method (Tail Grab) ---------------- */

  const componentInputs = (teamId: string): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const c of event?.teamScoring?.components ?? []) {
      out[c.key] = inputValue(teamId, c.key);
    }
    return out;
  };
  const componentPoints = (teamId: string): number =>
    computeTeamComponentValue(
      event?.teamScoring?.components ?? [],
      componentInputs(teamId)
    );

  async function saveComponents(teamId: string) {
    if (!event) return;
    setErr(teamId, "");
    setSavingTeam(teamId);

    const inputs = componentInputs(teamId);
    const points = computeTeamComponentValue(
      event.teamScoring!.components!,
      inputs
    );
    // Persist only the raw values actually entered.
    const metadata: Record<string, string> = {};
    for (const [k, v] of Object.entries(inputs)) {
      if (v.trim() !== "") metadata[k] = v.trim();
    }

    const supabase = createClient();
    const prior = savedByTeam.get(teamId);
    const ok = await writeRow(supabase, {
      teamId,
      label,
      points,
      metadata,
      prior,
      eventName: event.name,
      teamName: teamName(teamId),
    });
    if (ok) {
      clearEdit(teamId);
      window.dispatchEvent(new Event("scores-updated"));
      await load();
    } else {
      setErr(teamId, "Could not save. Please try again.");
    }
    setSavingTeam(null);
  }

  /* ---------------- rank-by-time method (Conditional Relay) ---------------- */

  const placementScale = event?.teamScoring?.placementScale ?? [];

  // Live relay standings from saved times overlaid with unsaved edits — drives
  // the rank/points shown on each card as the admin types.
  const relayLive = useMemo(() => {
    if (method !== "rank-by-time" || !data) return new Map<string, { rank: number; points: number }>();
    const entries: { teamId: string; timeCs: number }[] = [];
    for (const team of data.teams) {
      const raw = timeValue(team.id);
      if (raw.trim() === "") continue;
      const cs = parseInputToDbValue(raw, "time");
      if (cs !== null) entries.push({ teamId: team.id, timeCs: cs });
    }
    const standings = computeRelayStandings(entries, placementScale);
    return new Map(standings.map((s) => [s.teamId, { rank: s.rank, points: s.points }]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method, data, edits, savedByTeam, eventSlug]);

  async function saveRelay(teamId: string) {
    if (!event) return;
    setErr(teamId, "");
    const raw = timeValue(teamId);
    const cs = parseInputToDbValue(raw, "time");
    if (cs === null) {
      setErr(teamId, "Enter a valid time (e.g. 1:23.4)");
      return;
    }
    setSavingTeam(teamId);

    // Assemble every team's time: saved values for the others, the new value for
    // the team being saved. Re-rank the whole field so placement points update.
    const times = new Map<string, { cs: number; raw: string }>();
    for (const team of data?.teams ?? []) {
      if (team.id === teamId) {
        times.set(teamId, { cs, raw: raw.trim() });
        continue;
      }
      const savedCs = metaNumber(savedByTeam.get(team.id), "timeCs");
      if (savedCs !== null) {
        times.set(team.id, {
          cs: savedCs,
          raw: metaString(savedByTeam.get(team.id), "timeRaw"),
        });
      }
    }
    const standings = computeRelayStandings(
      [...times].map(([id, v]) => ({ teamId: id, timeCs: v.cs })),
      placementScale
    );
    const ptsByTeam = new Map(standings.map((s) => [s.teamId, s.points]));

    const supabase = createClient();
    let allOk = true;
    for (const [id, v] of times) {
      const ok = await writeRow(supabase, {
        teamId: id,
        label,
        points: ptsByTeam.get(id) ?? 0,
        metadata: { timeRaw: v.raw, timeCs: v.cs },
        prior: savedByTeam.get(id),
        eventName: event.name,
        teamName: teamName(id),
        // Only the team the admin actually edited is worth an audit entry; the
        // others just get their placement points recalculated.
        silent: id !== teamId,
      });
      allOk = allOk && ok;
    }

    if (allOk) {
      clearEdit(teamId);
      window.dispatchEvent(new Event("scores-updated"));
      await load();
    } else {
      setErr(teamId, "Could not save. Please try again.");
    }
    setSavingTeam(null);
  }

  /* ---------------- clear (both methods) ---------------- */

  async function clearTeam(teamId: string) {
    if (!event) return;
    const saved = savedByTeam.get(teamId);
    if (!saved) {
      clearEdit(teamId);
      return;
    }
    setSavingTeam(teamId);
    const supabase = createClient();
    const { error } = await supabase
      .from("roster_scores")
      .delete()
      .eq("id", saved.id);

    if (!error) {
      await logAudit(
        supabase,
        "delete",
        "roster_score",
        teamId,
        { event: event.name, team: teamName(teamId) },
        {
          table: "roster_scores",
          rowId: saved.id,
          before: { ...saved },
        }
      );

      // Rank-by-time: with a team removed, recompute the rest's placement points.
      if (method === "rank-by-time") {
        const times = new Map<string, number>();
        for (const team of data?.teams ?? []) {
          if (team.id === teamId) continue;
          const savedCs = metaNumber(savedByTeam.get(team.id), "timeCs");
          if (savedCs !== null) times.set(team.id, savedCs);
        }
        const standings = computeRelayStandings(
          [...times].map(([id, c]) => ({ teamId: id, timeCs: c })),
          placementScale
        );
        const ptsByTeam = new Map(standings.map((s) => [s.teamId, s.points]));
        for (const id of times.keys()) {
          const row = savedByTeam.get(id);
          if (row && (ptsByTeam.get(id) ?? 0) !== row.points) {
            await supabase
              .from("roster_scores")
              .update({ points: ptsByTeam.get(id) ?? 0 })
              .eq("id", row.id);
          }
        }
      }

      clearEdit(teamId);
      window.dispatchEvent(new Event("scores-updated"));
      await load();
    }
    setSavingTeam(null);
  }

  /* ---------------- shared write helper ---------------- */

  async function writeRow(
    supabase: ReturnType<typeof createClient>,
    args: {
      teamId: string;
      label: string;
      points: number;
      metadata: Record<string, unknown>;
      prior: RosterScore | undefined;
      eventName: string;
      teamName: string;
      silent?: boolean;
    }
  ): Promise<boolean> {
    const { teamId, points, metadata, prior, eventName, teamName, silent } = args;
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (prior) {
      const { error } = await supabase
        .from("roster_scores")
        .update({ points, metadata })
        .eq("id", prior.id);
      if (error) return false;
      if (!silent) {
        await logAudit(
          supabase,
          "update",
          "roster_score",
          teamId,
          { event: eventName, team: teamName, points },
          {
            table: "roster_scores",
            rowId: prior.id,
            before: { points: prior.points, metadata: prior.metadata ?? null },
            after: { points, metadata },
          }
        );
      }
      return true;
    }

    const { data: inserted, error } = await supabase
      .from("roster_scores")
      .insert({
        team_id: teamId,
        player_id: null,
        label: args.label,
        points,
        metadata,
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();
    if (error || !inserted) return false;
    if (!silent) {
      await logAudit(
        supabase,
        "create",
        "roster_score",
        teamId,
        { event: eventName, team: teamName, points },
        {
          table: "roster_scores",
          rowId: inserted.id,
          after: { team_id: teamId, label: args.label, points, metadata },
        }
      );
    }
    return true;
  }

  function teamName(teamId: string): string {
    return data?.teams.find((t) => t.id === teamId)?.name ?? "";
  }

  const Icon = event?.icon;

  return (
    <PageTransition className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href="/admin/team-events"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Team Events
      </Link>

      <div className="flex items-center gap-3 mb-8">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: (event?.color ?? "#E94560") + "1a" }}
        >
          {Icon && <Icon className="w-6 h-6" style={{ color: event?.color }} />}
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground uppercase">
            {event?.name ?? "Team Event"}
          </h1>
          <p className="text-sm text-muted">
            Record each team&apos;s result — points are computed automatically
            and added to the leaderboard.
          </p>
        </div>
      </div>

      {loading || !event ? (
        <div className="flex items-center justify-center py-20">
          <SkeletonList rows={6} />
        </div>
      ) : (
        <>
          <TieAlert className="mb-5" />

          <p className="mb-4 border-l-2 border-border pl-3 text-xs leading-relaxed text-muted">
            {method === "rank-by-time"
              ? "Enter each team's final time. The app ranks teams fastest-to-slowest and awards placement points automatically."
              : "Enter each team's placement and tail count per round. Points are summed automatically."}
          </p>

          {/* Team rows */}
          <div className="space-y-3">
            {data?.teams.map((team) => {
              const saved = savedByTeam.get(team.id);
              const isSaving = savingTeam === team.id;
              const err = errorTeam[team.id];
              const points =
                method === "rank-by-time"
                  ? relayLive.get(team.id)?.points ?? 0
                  : componentPoints(team.id);
              const rank =
                method === "rank-by-time"
                  ? relayLive.get(team.id)?.rank
                  : undefined;

              return (
                <RecorderCard
                  key={team.id}
                  teamName={team.name}
                  teamColor={team.color}
                  rank={rank}
                  points={points}
                  unsaved={isDirty(team.id)}
                >
                  {method === "rank-by-time" ? (
                    <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_auto]">
                      <Field label="Final time" htmlFor={`${team.id}-time`}>
                        <Input
                          id={`${team.id}-time`}
                          value={timeValue(team.id)}
                          onChange={(e) =>
                            setInput(team.id, "time", e.target.value)
                          }
                          placeholder="e.g. 1:23.4 or 83.5"
                          inputMode="decimal"
                          error={err || undefined}
                        />
                      </Field>
                      <SaveClear
                        onSave={() => saveRelay(team.id)}
                        onClear={() => clearTeam(team.id)}
                        saving={isSaving}
                        hasSaved={!!saved}
                        teamName={team.name}
                      />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {groupComponents(event.teamScoring?.components ?? []).map(
                        (group, gi) => {
                          const inputs = componentInputs(team.id);
                          const subtotal = computeTeamComponentValue(
                            group.items,
                            inputs
                          );
                          return (
                            <fieldset
                              key={group.name ?? gi}
                              className="rounded-xl border border-border bg-background/40 p-3"
                            >
                              {group.name && (
                                <div className="mb-2.5 flex items-center justify-between gap-2">
                                  <legend className="text-[11px] font-semibold tracking-wider text-muted uppercase">
                                    {group.name}
                                  </legend>
                                  <span className="font-mono text-xs font-semibold tabular-nums text-muted">
                                    {subtotal} pt{subtotal !== 1 ? "s" : ""}
                                  </span>
                                </div>
                              )}
                              <div className="grid grid-cols-2 gap-3">
                                {group.items.map((c) => (
                                  <ComponentField
                                    key={c.key}
                                    id={`${team.id}-${c.key}`}
                                    component={c}
                                    value={inputValue(team.id, c.key)}
                                    onChange={(v) => setInput(team.id, c.key, v)}
                                  />
                                ))}
                              </div>
                            </fieldset>
                          );
                        }
                      )}
                      <div className="flex items-center justify-end gap-3">
                        {err && <p className="text-xs text-danger">{err}</p>}
                        <SaveClear
                          onSave={() => saveComponents(team.id)}
                          onClear={() => clearTeam(team.id)}
                          saving={isSaving}
                          hasSaved={!!saved}
                          teamName={team.name}
                        />
                      </div>
                    </div>
                  )}
                </RecorderCard>
              );
            })}
          </div>
        </>
      )}
    </PageTransition>
  );
}

/** Group scoring components by their optional `group` (e.g. "Round 1"), keeping
 *  order. Ungrouped components collapse into a single unnamed section. */
function groupComponents(
  components: TeamScoreComponent[]
): { name?: string; items: TeamScoreComponent[] }[] {
  const groups: { name?: string; items: TeamScoreComponent[] }[] = [];
  for (const c of components) {
    let g = groups.find((x) => x.name === c.group);
    if (!g) {
      g = { name: c.group, items: [] };
      groups.push(g);
    }
    g.items.push(c);
  }
  return groups;
}

/** One placement dropdown or tally number input for a component-scored event. */
function ComponentField({
  id,
  component,
  value,
  onChange,
}: {
  id: string;
  component: TeamScoreComponent;
  value: string;
  onChange: (v: string) => void;
}) {
  if (component.kind === "placement") {
    const places = component.placementPoints ?? [];
    return (
      <Field label={component.label} htmlFor={id}>
        <Select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          options={[
            { value: "", label: "—" },
            ...places.map((pts, i) => ({
              value: String(i + 1),
              label: `${ordinal(i + 1)} (${pts} pt${pts !== 1 ? "s" : ""})`,
            })),
          ]}
        />
      </Field>
    );
  }
  return (
    <Field label={component.label} htmlFor={id}>
      <Input
        id={id}
        type="number"
        min={0}
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
      />
    </Field>
  );
}

function SaveClear({
  onSave,
  onClear,
  saving,
  hasSaved,
  teamName,
}: {
  onSave: () => void;
  onClear: () => void;
  saving: boolean;
  hasSaved: boolean;
  teamName: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Button onClick={onSave} loading={saving} size="sm">
        <Check className="h-4 w-4" />
        Save
      </Button>
      {hasSaved && (
        <button
          onClick={onClear}
          disabled={saving}
          aria-label={`Clear ${teamName}'s result`}
          className="rounded-lg p-2 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
          title="Clear result"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

