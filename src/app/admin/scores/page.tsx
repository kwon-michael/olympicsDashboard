"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Trophy,
  Plus,
  Save,
  Trash2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PageTransition } from "@/components/ui/page-transition";
import {
  allEvents as rulesEvents,
  parseInputToDbValue,
  formatDbValue,
  type ScoringInput,
} from "@/lib/events";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/** DB event row (id comes from Supabase, slug ties back to rules page) */
interface DbEvent {
  id: string;
  slug: string;
  name: string;
}

interface TeamOption {
  id: string;
  name: string;
  color: string;
}

interface MemberOption {
  id: string;
  display_name: string;
  team_id: string;
}

interface ScoreEntry {
  event_slug: string;   // ties to the rules page event
  team_id: string;
  user_id: string;
  raw_input: string;    // the admin types time / distance / points here
  notes: string;
}

interface ExistingScore {
  id: string;
  value: number;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  event: { id: string; name: string; slug: string } | null;
  team: { id: string; name: string; color: string } | null;
  user: { id: string; display_name: string } | null;
  created_at: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Get the ScoringInput for a rules-page event by slug */
function modeForSlug(slug: string): ScoringInput {
  return rulesEvents.find((e) => e.slug === slug)?.scoringInput ?? "points";
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function AdminScoresPage() {
  const supabase = createClient();

  // DB-backed data
  const [dbEvents, setDbEvents] = useState<DbEvent[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [teamMembers, setTeamMembers] = useState<MemberOption[]>([]);
  const [existingScores, setExistingScores] = useState<ExistingScore[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Batch entry
  const [batchEntries, setBatchEntries] = useState<ScoreEntry[]>([
    { event_slug: "", team_id: "", user_id: "", raw_input: "", notes: "" },
  ]);

  // Filter for existing scores
  const [filterEvent, setFilterEvent] = useState("");

  /* ---- bootstrap: ensure every rules-page event has a row in the DB events table ---- */

  useEffect(() => {
    async function bootstrap() {
      // 1. Fetch existing DB events
      const { data: existing } = await supabase
        .from("events")
        .select("id, slug, name")
        .order("name");

      const existingBySlug: Record<string, DbEvent> = {};
      for (const e of existing ?? []) {
        existingBySlug[e.slug] = e;
      }

      // 2. Upsert any rules-page events that don't exist yet
      const missing = rulesEvents.filter((re) => !existingBySlug[re.slug]);
      if (missing.length > 0) {
        // Need the current user's ID for the created_by column
        const { data: { user: authUser } } = await supabase.auth.getUser();
        const createdBy = authUser?.id;

        if (createdBy) {
          const { data: inserted } = await supabase
            .from("events")
            .upsert(
              missing.map((re) => ({
                name: re.name,
                slug: re.slug,
                description: re.description,
                category: re.category,
                scoring_type: re.scoringInput === "time" ? "time_asc" : "points",
                difficulty: "medium" as const,
                status: "upcoming" as const,
                created_by: createdBy,
              })),
              { onConflict: "slug" }
            )
            .select("id, slug, name");

          for (const row of inserted ?? []) {
            existingBySlug[row.slug] = row;
          }
        }
      }

      // 3. Build the ordered DB events list (only those from the rules page)
      const orderedDbEvents = rulesEvents
        .map((re) => existingBySlug[re.slug])
        .filter(Boolean) as DbEvent[];
      setDbEvents(orderedDbEvents);

      // 4. Fetch teams, members, scores in parallel
      const [teamsRes, membersRes, scoresRes] = await Promise.all([
        supabase.from("teams").select("id, name, color").order("name"),
        supabase
          .from("team_members")
          .select("user_id, team_id, user:users(id, display_name)"),
        supabase
          .from("scores")
          .select(
            "id, value, notes, metadata, created_at, event:events(id, name, slug), team:teams(id, name, color), user:users(id, display_name)"
          )
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      setTeams(teamsRes.data ?? []);

      const members: MemberOption[] = [];
      for (const m of membersRes.data ?? []) {
        const user = m.user as unknown as { id: string; display_name: string } | null;
        if (user) {
          members.push({ id: user.id, display_name: user.display_name, team_id: m.team_id });
        }
      }
      setTeamMembers(members);

      setExistingScores((scoresRes.data ?? []) as unknown as ExistingScore[]);
      setLoading(false);
    }

    bootstrap();
  }, []);

  /* ---- entry helpers ---- */

  function addEntry() {
    setBatchEntries([
      ...batchEntries,
      { event_slug: "", team_id: "", user_id: "", raw_input: "", notes: "" },
    ]);
  }

  function removeEntry(index: number) {
    if (batchEntries.length === 1) return;
    setBatchEntries(batchEntries.filter((_, i) => i !== index));
  }

  function updateEntry(index: number, field: keyof ScoreEntry, value: string) {
    const updated = [...batchEntries];
    (updated[index] as unknown as Record<string, string>)[field] = value;

    // Clear participant when team changes
    if (field === "team_id") {
      const currentUserId = updated[index].user_id;
      const belongsToTeam = teamMembers.some(
        (m) => m.id === currentUserId && m.team_id === value
      );
      if (!belongsToTeam) updated[index].user_id = "";
    }

    setBatchEntries(updated);
  }

  function membersForEntry(entry: ScoreEntry) {
    if (!entry.team_id) return [];
    return teamMembers
      .filter((m) => m.team_id === entry.team_id)
      .map((m) => ({ value: m.id, label: m.display_name }));
  }

  /* ---- submit ---- */

  async function submitScores() {
    setFeedback(null);

    const rows: {
      event_id: string;
      team_id: string;
      user_id: string;
      value: number;
      notes: string | null;
      metadata: Record<string, unknown> | null;
    }[] = [];

    for (const entry of batchEntries) {
      if (!entry.event_slug || !entry.team_id || !entry.user_id) continue;

      const mode = modeForSlug(entry.event_slug);
      const dbValue = parseInputToDbValue(entry.raw_input, mode);
      if (dbValue === null) continue;

      const dbEvent = dbEvents.find((e) => e.slug === entry.event_slug);
      if (!dbEvent) continue;

      rows.push({
        event_id: dbEvent.id,
        team_id: entry.team_id,
        user_id: entry.user_id,
        value: dbValue,
        notes: entry.notes || null,
        metadata: { input_type: mode },
      });
    }

    if (rows.length === 0) {
      setFeedback({ type: "error", message: "Please fill in at least one complete score entry." });
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("scores").insert(rows);

    if (error) {
      setFeedback({ type: "error", message: error.message });
    } else {
      setFeedback({ type: "success", message: `${rows.length} score(s) saved successfully!` });
      setBatchEntries([{ event_slug: "", team_id: "", user_id: "", raw_input: "", notes: "" }]);
      await refreshScores();
      window.dispatchEvent(new CustomEvent("scores-updated"));
    }
    setSaving(false);
  }

  async function refreshScores() {
    const { data } = await supabase
      .from("scores")
      .select(
        "id, value, notes, metadata, created_at, event:events(id, name, slug), team:teams(id, name, color), user:users(id, display_name)"
      )
      .order("created_at", { ascending: false })
      .limit(50);
    setExistingScores((data ?? []) as unknown as ExistingScore[]);
  }

  async function deleteScore(scoreId: string) {
    const { error } = await supabase.from("scores").delete().eq("id", scoreId);
    if (!error) {
      setExistingScores(existingScores.filter((s) => s.id !== scoreId));
      window.dispatchEvent(new CustomEvent("scores-updated"));
    }
  }

  const filteredScores = filterEvent
    ? existingScores.filter((s) => s.event?.id === filterEvent)
    : existingScores;

  /* ---- grouped event options for the dropdown ---- */

  const soloEventSlugs = new Set(rulesEvents.filter((e) => e.type === "solo").map((e) => e.slug));

  const eventOptions: { value: string; label: string }[] = [
    { value: "", label: "Select event..." },
    // We use a separator-style label for grouping
    { value: "__solo_header__", label: "── Solo Events ──" },
    ...rulesEvents
      .filter((e) => e.type === "solo")
      .map((e) => ({ value: e.slug, label: e.name })),
    { value: "__team_header__", label: "── Team Events ──" },
    ...rulesEvents
      .filter((e) => e.type === "team")
      .map((e) => ({ value: e.slug, label: e.name })),
  ];

  /* ---- render ---- */

  return (
    <PageTransition>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
              Enter and manage event scores
            </p>
          </div>
        </div>

        {/* Feedback */}
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mb-6 p-4 rounded-xl flex items-center gap-2 ${
              feedback.type === "success"
                ? "bg-success/10 text-success"
                : "bg-danger/10 text-danger"
            }`}
          >
            {feedback.type === "success" ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <p className="text-sm font-medium">{feedback.message}</p>
          </motion.div>
        )}

        {/* Batch Entry */}
        <section className="mb-10">
          <h2 className="font-display text-lg font-bold text-foreground mb-4">
            ENTER SCORES
          </h2>
          <div className="bg-card rounded-xl border border-border p-6">
            {loading ? (
              <div className="text-center text-muted py-8 text-sm">Loading...</div>
            ) : (
              <>
                <div className="space-y-4">
                  {batchEntries.map((entry, i) => {
                    const mode = entry.event_slug ? modeForSlug(entry.event_slug) : "points";
                    const memberOptions = membersForEntry(entry);

                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-3 bg-background rounded-lg border border-border space-y-3"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <Select
                            label="Event"
                            value={entry.event_slug}
                            onChange={(e) => {
                              // Ignore header options
                              if (e.target.value.startsWith("__")) return;
                              updateEntry(i, "event_slug", e.target.value);
                            }}
                            options={eventOptions}
                          />
                          <Select
                            label="Team"
                            value={entry.team_id}
                            onChange={(e) => updateEntry(i, "team_id", e.target.value)}
                            options={[
                              { value: "", label: "Select team..." },
                              ...teams.map((t) => ({ value: t.id, label: t.name })),
                            ]}
                          />
                          <Select
                            label="Participant"
                            value={entry.user_id}
                            onChange={(e) => updateEntry(i, "user_id", e.target.value)}
                            options={
                              entry.team_id
                                ? [{ value: "", label: "Select member..." }, ...memberOptions]
                                : [{ value: "", label: "Select a team first" }]
                            }
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                          {/* Score input – adapts based on event type */}
                          <Input
                            label={
                              mode === "time"
                                ? "Time (e.g. 12.34 or 1:12.34)"
                                : mode === "distance"
                                ? "Distance in meters (e.g. 3.45)"
                                : "Points"
                            }
                            type={mode === "distance" ? "number" : "text"}
                            step={mode === "distance" ? "0.01" : undefined}
                            min={mode !== "time" ? 0 : undefined}
                            placeholder={
                              mode === "time"
                                ? "e.g. 12.34 or 1:12.34"
                                : mode === "distance"
                                ? "e.g. 3.45"
                                : "e.g. 5"
                            }
                            value={entry.raw_input}
                            onChange={(e) => updateEntry(i, "raw_input", e.target.value)}
                          />

                          <Input
                            label="Notes"
                            value={entry.notes}
                            onChange={(e) => updateEntry(i, "notes", e.target.value)}
                            placeholder="Optional"
                          />

                          <button
                            onClick={() => removeEntry(i)}
                            className="text-muted hover:text-danger transition-colors p-2 self-end"
                            disabled={batchEntries.length === 1}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                  <button
                    onClick={addEntry}
                    className="flex items-center gap-1 text-sm text-coral hover:text-coral-light transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Another Entry
                  </button>

                  <Button onClick={submitScores} loading={saving}>
                    <Save className="w-4 h-4 mr-1" />
                    Save All Scores
                  </Button>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Existing Scores */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-bold text-foreground">
              RECORDED SCORES
            </h2>
            <div className="w-48">
              <Select
                value={filterEvent}
                onChange={(e) => setFilterEvent(e.target.value)}
                options={[
                  { value: "", label: "All Events" },
                  ...dbEvents.map((ev) => ({ value: ev.id, label: ev.name })),
                ]}
              />
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border overflow-hidden">
            {filteredScores.length === 0 ? (
              <p className="text-center text-muted text-sm py-8">
                No scores recorded yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-background border-b border-border">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase">
                        Event
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase">
                        Team
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase">
                        Participant
                      </th>
                      <th className="text-right px-4 py-3 font-semibold text-muted text-xs uppercase">
                        Result
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase">
                        Notes
                      </th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredScores.map((score) => {
                      const slug = score.event?.slug ?? "";
                      const mode = modeForSlug(slug);

                      return (
                        <tr key={score.id} className="hover:bg-background/50">
                          <td className="px-4 py-3">
                            {score.event?.name ?? "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span className="flex items-center gap-2">
                              {score.team?.color && (
                                <span
                                  className="w-3 h-3 rounded-full inline-block"
                                  style={{ backgroundColor: score.team.color }}
                                />
                              )}
                              {score.team?.name ?? "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {score.user?.display_name ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-foreground">
                            {formatDbValue(score.value, mode)}
                          </td>
                          <td className="px-4 py-3 text-muted">
                            {score.notes || "—"}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => deleteScore(score.id)}
                              className="text-muted hover:text-danger transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </PageTransition>
  );
}
