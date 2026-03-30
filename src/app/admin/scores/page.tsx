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

interface EventOption {
  id: string;
  name: string;
}

interface TeamOption {
  id: string;
  name: string;
  color: string;
}

interface ScoreEntry {
  id?: string;
  event_id: string;
  team_id: string;
  user_id: string;
  value: number;
  notes: string;
}

interface ExistingScore {
  id: string;
  value: number;
  notes: string | null;
  event: { id: string; name: string } | null;
  team: { id: string; name: string; color: string } | null;
  user: { id: string; display_name: string } | null;
  created_at: string;
}

export default function AdminScoresPage() {
  const supabase = createClient();
  const [events, setEvents] = useState<EventOption[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [users, setUsers] = useState<{ id: string; display_name: string }[]>([]);
  const [existingScores, setExistingScores] = useState<ExistingScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Batch entry
  const [batchEntries, setBatchEntries] = useState<ScoreEntry[]>([
    { event_id: "", team_id: "", user_id: "", value: 0, notes: "" },
  ]);

  // Filter for existing scores
  const [filterEvent, setFilterEvent] = useState("");

  useEffect(() => {
    async function fetchData() {
      const [eventsRes, teamsRes, usersRes, scoresRes] = await Promise.all([
        supabase.from("events").select("id, name").order("name"),
        supabase.from("teams").select("id, name, color").order("name"),
        supabase
          .from("users")
          .select("id, display_name")
          .order("display_name"),
        supabase
          .from("scores")
          .select(
            "id, value, notes, created_at, event:events(id, name), team:teams(id, name, color), user:users(id, display_name)"
          )
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      setEvents(eventsRes.data ?? []);
      setTeams(teamsRes.data ?? []);
      setUsers(usersRes.data ?? []);
      setExistingScores((scoresRes.data ?? []) as unknown as ExistingScore[]);
      setLoading(false);
    }

    fetchData();
  }, []);

  function addEntry() {
    setBatchEntries([
      ...batchEntries,
      { event_id: "", team_id: "", user_id: "", value: 0, notes: "" },
    ]);
  }

  function removeEntry(index: number) {
    if (batchEntries.length === 1) return;
    setBatchEntries(batchEntries.filter((_, i) => i !== index));
  }

  function updateEntry(
    index: number,
    field: keyof ScoreEntry,
    value: string | number
  ) {
    const updated = [...batchEntries];
    (updated[index] as unknown as Record<string, string | number>)[field] = value;
    setBatchEntries(updated);
  }

  async function submitScores() {
    // Validate
    const valid = batchEntries.filter(
      (e) => e.event_id && e.team_id && e.user_id && e.value > 0
    );
    if (valid.length === 0) {
      setFeedback({
        type: "error",
        message: "Please fill in at least one complete score entry.",
      });
      return;
    }

    setSaving(true);
    setFeedback(null);

    const { error } = await supabase.from("scores").insert(
      valid.map((e) => ({
        event_id: e.event_id,
        team_id: e.team_id,
        user_id: e.user_id,
        value: e.value,
        notes: e.notes || null,
      }))
    );

    if (error) {
      setFeedback({ type: "error", message: error.message });
    } else {
      setFeedback({
        type: "success",
        message: `${valid.length} score(s) saved successfully!`,
      });
      setBatchEntries([
        { event_id: "", team_id: "", user_id: "", value: 0, notes: "" },
      ]);
      // Refresh existing scores
      const { data } = await supabase
        .from("scores")
        .select(
          "id, value, notes, created_at, event:events(id, name), team:teams(id, name, color), user:users(id, display_name)"
        )
        .order("created_at", { ascending: false })
        .limit(50);
      setExistingScores((data ?? []) as unknown as ExistingScore[]);
    }
    setSaving(false);
  }

  async function deleteScore(scoreId: string) {
    const { error } = await supabase.from("scores").delete().eq("id", scoreId);
    if (!error) {
      setExistingScores(existingScores.filter((s) => s.id !== scoreId));
    }
  }

  const filteredScores = filterEvent
    ? existingScores.filter((s) => s.event?.id === filterEvent)
    : existingScores;

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
              <div className="text-center text-muted py-8 text-sm">
                Loading...
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {batchEntries.map((entry, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="grid grid-cols-1 sm:grid-cols-6 gap-3 items-end p-3 bg-background rounded-lg border border-border"
                    >
                      <Select
                        label="Event"
                        value={entry.event_id}
                        onChange={(e) =>
                          updateEntry(i, "event_id", e.target.value)
                        }
                        options={events.map((ev) => ({
                          value: ev.id,
                          label: ev.name,
                        }))}
                      />
                      <Select
                        label="Team"
                        value={entry.team_id}
                        onChange={(e) =>
                          updateEntry(i, "team_id", e.target.value)
                        }
                        options={teams.map((t) => ({
                          value: t.id,
                          label: t.name,
                        }))}
                      />
                      <Select
                        label="Participant"
                        value={entry.user_id}
                        onChange={(e) =>
                          updateEntry(i, "user_id", e.target.value)
                        }
                        options={users.map((u) => ({
                          value: u.id,
                          label: u.display_name,
                        }))}
                      />
                      <Input
                        label="Score"
                        type="number"
                        min={0}
                        value={entry.value || ""}
                        onChange={(e) =>
                          updateEntry(i, "value", Number(e.target.value))
                        }
                      />
                      <Input
                        label="Notes"
                        value={entry.notes}
                        onChange={(e) =>
                          updateEntry(i, "notes", e.target.value)
                        }
                        placeholder="Optional"
                      />
                      <button
                        onClick={() => removeEntry(i)}
                        className="text-muted hover:text-danger transition-colors p-2 self-end"
                        disabled={batchEntries.length === 1}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ))}
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
                  ...events.map((ev) => ({ value: ev.id, label: ev.name })),
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
                        Score
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase">
                        Notes
                      </th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredScores.map((score) => (
                      <tr key={score.id} className="hover:bg-background/50">
                        <td className="px-4 py-3">
                          {score.event?.name ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-2">
                            {score.team?.color && (
                              <span
                                className="w-3 h-3 rounded-full inline-block"
                                style={{
                                  backgroundColor: score.team.color,
                                }}
                              />
                            )}
                            {score.team?.name ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {score.user?.display_name ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-foreground">
                          {score.value}
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
                    ))}
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
