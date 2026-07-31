"use client";
import { SkeletonList } from "@/components/ui/skeleton";

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
import { EventChips } from "@/components/ui/event-chips";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { RecorderCard } from "@/components/admin/recorder-card";
import { TieAlert } from "@/components/admin/tie-alert";
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
  /** True when this team holds edits that differ from what's stored. */
  const isDirty = (teamId: string): boolean => {
    const e = edits[editKey(teamId)];
    if (!e) return false;
    const saved = savedByTeam.get(teamId);
    return (
      (e.value !== undefined &&
        e.value !== (saved ? dbValueToInput(saved.value, mode) : "")) ||
      (e.playerId !== undefined && e.playerId !== (saved?.player_id ?? ""))
    );
  };

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
          <SkeletonList rows={6} />
        </div>
      ) : (
        <>
          <TieAlert className="mb-5" />

          <EventChips
            events={soloEvents}
            value={eventSlug}
            onChange={setEventSlug}
            label="Solo event"
            className="mb-5"
          />

          <p className="mb-4 border-l-2 border-border pl-3 text-xs leading-relaxed text-muted">
            Recording{" "}
            <span className="font-medium text-foreground">{event.name}</span>{" "}
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
                <RecorderCard
                  key={team.id}
                  teamName={team.name}
                  teamColor={team.color}
                  rank={standing?.rank}
                  points={standing?.points}
                  unsaved={isDirty(team.id)}
                >
                  <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
                    <Field
                      label={getUnitLabel(mode)}
                      htmlFor={`${team.id}-value`}
                    >
                      <Input
                        id={`${team.id}-value`}
                        value={currentValue(team.id)}
                        onChange={(e) =>
                          setEdit(team.id, { value: e.target.value })
                        }
                        placeholder={PLACEHOLDER[mode]}
                        error={err || undefined}
                        inputMode={mode === "points" ? "numeric" : "decimal"}
                      />
                    </Field>
                    <Field
                      label="Participant (optional)"
                      htmlFor={`${team.id}-player`}
                    >
                      <Select
                        id={`${team.id}-player`}
                        value={currentPlayer(team.id)}
                        onChange={(e) =>
                          setEdit(team.id, { playerId: e.target.value })
                        }
                        options={[
                          { value: "", label: "—" },
                          ...teamPlayers.map((p) => ({
                            value: p.id,
                            label: p.is_active
                              ? p.name
                              : `${p.name} (crossed out)`,
                          })),
                        ]}
                      />
                    </Field>
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
                          aria-label={`Clear ${team.name}'s result`}
                          className="rounded-lg p-2 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                          title="Clear result"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </RecorderCard>
              );
            })}
          </div>
        </>
      )}
    </PageTransition>
  );
}
