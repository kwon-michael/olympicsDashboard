"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Medal, Trash2, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageTransition } from "@/components/ui/page-transition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { logAudit } from "@/lib/audit";
import { fetchRosterData, type RosterData } from "@/lib/roster";
import {
  fetchSoloResults,
  computeEventStandings,
  type SoloEventRow,
} from "@/lib/solo";
import {
  soloEvents,
  getScoringInputBySlug,
  getUnitLabel,
  parseInputToDbValue,
  type ScoringInput,
} from "@/lib/events";
import { getMedalEmoji } from "@/lib/utils";
import type { SoloResult } from "@/lib/types";

const PLACEHOLDER: Record<ScoringInput, string> = {
  time: "e.g. 12.34 or 1:05.2",
  distance: "e.g. 3.45 (m)",
  points: "e.g. 42",
};

/** Stored integer → an editable string that parseInputToDbValue round-trips. */
function dbValueToInput(value: number, mode: ScoringInput): string {
  if (mode === "points") return String(value);
  return String(value / 100); // time & distance are stored ×100
}

export default function AdminSoloPage() {
  const [data, setData] = useState<RosterData | null>(null);
  const [solo, setSolo] = useState<SoloResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventSlug, setEventSlug] = useState(soloEvents[0].slug);
  // Unsaved edits keyed by `${eventSlug}:${teamId}`. Absent keys fall back to
  // the saved result, so switching events shows the right values without an
  // effect that resets local state.
  const [edits, setEdits] = useState<
    Record<string, { value?: string; playerId?: string }>
  >({});
  const [savingTeam, setSavingTeam] = useState<string | null>(null);
  const [errorTeam, setErrorTeam] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const supabase = createClient();
    const [roster, soloResults] = await Promise.all([
      fetchRosterData(supabase),
      fetchSoloResults(supabase),
    ]);
    setData(roster);
    setSolo(soloResults);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const mode = getScoringInputBySlug(eventSlug);
  const event = soloEvents.find((e) => e.slug === eventSlug)!;

  const savedByTeam = useMemo(() => {
    const m = new Map<string, SoloResult>();
    for (const r of solo) if (r.event_slug === eventSlug) m.set(r.team_id, r);
    return m;
  }, [solo, eventSlug]);

  const editKey = (teamId: string) => `${eventSlug}:${teamId}`;
  const currentValue = (teamId: string): string => {
    const e = edits[editKey(teamId)];
    if (e?.value !== undefined) return e.value;
    const saved = savedByTeam.get(teamId);
    return saved ? dbValueToInput(saved.value, mode) : "";
  };
  const currentPlayer = (teamId: string): string => {
    const e = edits[editKey(teamId)];
    if (e?.playerId !== undefined) return e.playerId;
    return savedByTeam.get(teamId)?.player_id ?? "";
  };
  const setEdit = (
    teamId: string,
    patch: { value?: string; playerId?: string }
  ) =>
    setEdits((prev) => ({
      ...prev,
      [editKey(teamId)]: { ...prev[editKey(teamId)], ...patch },
    }));
  const clearEdit = (teamId: string) =>
    setEdits((prev) => {
      const next = { ...prev };
      delete next[editKey(teamId)];
      return next;
    });

  const standingByTeam = useMemo(() => {
    const m = new Map<string, SoloEventRow>();
    if (!data) return m;
    for (const row of computeEventStandings(eventSlug, solo, data.teams, data.players)) {
      m.set(row.team.id, row);
    }
    return m;
  }, [data, solo, eventSlug]);

  async function saveTeam(teamId: string) {
    const rawValue = currentValue(teamId);
    const dbValue = parseInputToDbValue(rawValue, mode);
    if (dbValue === null) {
      setErrorTeam((e) => ({ ...e, [teamId]: "Invalid value" }));
      return;
    }
    setErrorTeam((e) => ({ ...e, [teamId]: "" }));
    setSavingTeam(teamId);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // An upsert here is a create when no result exists yet for this team+event,
    // otherwise an in-place update — track which so the entry reverts correctly.
    const prior = savedByTeam.get(teamId);
    const { data: upserted, error } = await supabase
      .from("solo_results")
      .upsert(
        {
          event_slug: eventSlug,
          team_id: teamId,
          player_id: currentPlayer(teamId) || null,
          value: dbValue,
          created_by: user?.id ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "event_slug,team_id" }
      )
      .select("id")
      .single();

    if (!error) {
      const details = {
        event: event.name,
        team: data?.teams.find((t) => t.id === teamId)?.name,
        value: rawValue,
      };
      if (prior) {
        await logAudit(supabase, "update", "solo_result", teamId, details, {
          table: "solo_results",
          rowId: prior.id,
          before: { value: prior.value, player_id: prior.player_id },
          after: { value: dbValue },
        });
      } else {
        await logAudit(supabase, "create", "solo_result", teamId, details, {
          table: "solo_results",
          rowId: upserted.id,
          after: { value: dbValue },
        });
      }
      clearEdit(teamId); // fall back to the freshly-saved value
      window.dispatchEvent(new Event("scores-updated"));
      await load();
    } else {
      setErrorTeam((e) => ({ ...e, [teamId]: error.message }));
    }
    setSavingTeam(null);
  }

  async function clearTeam(teamId: string) {
    const saved = savedByTeam.get(teamId);
    if (!saved) {
      clearEdit(teamId);
      return;
    }
    setSavingTeam(teamId);
    const supabase = createClient();
    const { error } = await supabase
      .from("solo_results")
      .delete()
      .eq("id", saved.id);
    if (!error) {
      await logAudit(
        supabase,
        "delete",
        "solo_result",
        teamId,
        {
          event: event.name,
          team: data?.teams.find((t) => t.id === teamId)?.name,
        },
        {
          table: "solo_results",
          rowId: saved.id,
          // Full row so a revert can re-insert the result as it was.
          before: { ...saved },
        }
      );
      clearEdit(teamId);
      window.dispatchEvent(new Event("scores-updated"));
      await load();
    }
    setSavingTeam(null);
  }

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
        <div className="w-12 h-12 rounded-xl bg-info/10 flex items-center justify-center">
          <Medal className="w-6 h-6 text-info" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            SOLO EVENT RESULTS
          </h1>
          <p className="text-sm text-muted">
            Record each team&apos;s result — the app ranks teams and awards
            7/5/3/2/1 placement points automatically.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-coral border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Event selector */}
          <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
            {soloEvents.map((ev) => {
              const Icon = ev.icon;
              const active = ev.slug === eventSlug;
              return (
                <button
                  key={ev.slug}
                  onClick={() => setEventSlug(ev.slug)}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors border ${
                    active
                      ? "text-white border-transparent"
                      : "bg-card border-border text-muted hover:text-foreground"
                  }`}
                  style={active ? { backgroundColor: ev.color } : undefined}
                >
                  <Icon className="w-4 h-4" />
                  {ev.name}
                </button>
              );
            })}
          </div>

          <p className="text-xs text-muted mb-4">
            Recording <span className="font-semibold text-foreground">{event.name}</span>{" "}
            &middot; enter each team&apos;s {getUnitLabel(mode).toLowerCase()}.
          </p>

          {/* Team rows */}
          <div className="space-y-3">
            {data?.teams.map((team) => {
              const standing = standingByTeam.get(team.id);
              const teamPlayers = data.players.filter(
                (p) => p.team_id === team.id
              );
              const saved = savedByTeam.get(team.id);
              const isSaving = savingTeam === team.id;
              const err = errorTeam[team.id];

              return (
                <div
                  key={team.id}
                  className="bg-card rounded-xl border border-border p-4"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ backgroundColor: team.color }}
                    >
                      {team.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-display text-sm font-bold uppercase tracking-wide flex-1 truncate">
                      {team.name}
                    </span>
                    {standing && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold shrink-0">
                        <span className="text-base leading-none">
                          {getMedalEmoji(standing.rank) || `#${standing.rank}`}
                        </span>
                        <span
                          className="font-mono"
                          style={{ color: team.color }}
                        >
                          {standing.points} pt{standing.points !== 1 ? "s" : ""}
                        </span>
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
                    <div>
                      <label className="block text-[11px] font-medium text-muted mb-1">
                        {getUnitLabel(mode)}
                      </label>
                      <Input
                        value={currentValue(team.id)}
                        onChange={(e) =>
                          setEdit(team.id, { value: e.target.value })
                        }
                        placeholder={PLACEHOLDER[mode]}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-muted mb-1">
                        Participant (optional)
                      </label>
                      <select
                        value={currentPlayer(team.id)}
                        onChange={(e) =>
                          setEdit(team.id, { playerId: e.target.value })
                        }
                        className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-coral/30 focus:border-coral"
                      >
                        <option value="">—</option>
                        {teamPlayers.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                            {p.is_active ? "" : " (crossed out)"}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => saveTeam(team.id)}
                        loading={isSaving}
                        size="sm"
                      >
                        <Check className="w-4 h-4" />
                        Save
                      </Button>
                      {saved && (
                        <button
                          onClick={() => clearTeam(team.id)}
                          disabled={isSaving}
                          className="p-2 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                          title="Clear result"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  {err && (
                    <p className="text-xs text-danger mt-2">{err}</p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </PageTransition>
  );
}
