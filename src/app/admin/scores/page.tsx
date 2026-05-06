"use client";

import { useEffect, useState, useRef } from "react";
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
  Download,
  Upload,
  X,
  Pencil,
  Check,
  Search,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
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
import { logAudit } from "@/lib/audit";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

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
  event_slug: string;
  team_id: string;
  user_id: string;
  raw_input: string;
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

function modeForSlug(slug: string): ScoringInput {
  return rulesEvents.find((e) => e.slug === slug)?.scoringInput ?? "points";
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function AdminScoresPage() {
  const supabase = createClient();

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

  // Filter, search, sort, pagination
  const [filterEvent, setFilterEvent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortCol, setSortCol] = useState<"event" | "team" | "participant" | "result" | "date">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  // Inline editing
  const [editingScoreId, setEditingScoreId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Bulk import
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importSaving, setImportSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ---- bootstrap ---- */

  useEffect(() => {
    async function bootstrap() {
      const { data: existing } = await supabase
        .from("events")
        .select("id, slug, name")
        .order("name");

      const existingBySlug: Record<string, DbEvent> = {};
      for (const e of existing ?? []) {
        existingBySlug[e.slug] = e;
      }

      const missing = rulesEvents.filter((re) => !existingBySlug[re.slug]);
      if (missing.length > 0) {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
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
                scoring_type:
                  re.scoringInput === "time" ? "time_asc" : "points",
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

      const orderedDbEvents = rulesEvents
        .map((re) => existingBySlug[re.slug])
        .filter(Boolean) as DbEvent[];
      setDbEvents(orderedDbEvents);

      const [teamsRes, membersRes, scoresRes] = await Promise.all([
        supabase.from("teams").select("id, name, color").order("name"),
        supabase
          .from("team_members")
          .select("user_id, team_id, user:users(id, display_name)"),
        supabase
          .from("scores")
          .select(
            "id, value, notes, metadata, created_at, event:events!scores_event_id_fkey(id, name, slug), team:teams!scores_team_id_fkey(id, name, color), user:users!scores_user_id_fkey(id, display_name)"
          )
          .order("created_at", { ascending: false }),
      ]);

      setTeams(teamsRes.data ?? []);

      const members: MemberOption[] = [];
      for (const m of membersRes.data ?? []) {
        const user = m.user as unknown as {
          id: string;
          display_name: string;
        } | null;
        if (user) {
          members.push({
            id: user.id,
            display_name: user.display_name,
            team_id: m.team_id,
          });
        }
      }
      setTeamMembers(members);

      setExistingScores(
        (scoresRes.data ?? []) as unknown as ExistingScore[]
      );
      setLoading(false);
    }

    bootstrap();
  }, []);

  /* ---- batch entry helpers ---- */

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

  function updateEntry(
    index: number,
    field: keyof ScoreEntry,
    value: string
  ) {
    const updated = [...batchEntries];
    (updated[index] as unknown as Record<string, string>)[field] = value;

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

  /* ---- submit new scores ---- */

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
      setFeedback({
        type: "error",
        message: "Please fill in at least one complete score entry.",
      });
      return;
    }

    setSaving(true);

    const { error, data: inserted } = await supabase
      .from("scores")
      .insert(rows)
      .select("id");

    if (error) {
      setFeedback({ type: "error", message: error.message });
    } else {
      for (const row of inserted ?? []) {
        await logAudit(supabase, "create", "score", row.id, {
          count: rows.length,
        });
      }
      setFeedback({
        type: "success",
        message: `${rows.length} score(s) saved successfully!`,
      });
      setBatchEntries([
        { event_slug: "", team_id: "", user_id: "", raw_input: "", notes: "" },
      ]);
      await refreshScores();
      window.dispatchEvent(new CustomEvent("scores-updated"));
    }
    setSaving(false);
  }

  async function refreshScores() {
    const { data } = await supabase
      .from("scores")
      .select(
        "id, value, notes, metadata, created_at, event:events!scores_event_id_fkey(id, name, slug), team:teams!scores_team_id_fkey(id, name, color), user:users!scores_user_id_fkey(id, display_name)"
      )
      .order("created_at", { ascending: false });
    setExistingScores((data ?? []) as unknown as ExistingScore[]);
  }

  /* ---- inline edit ---- */

  function startEditScore(score: ExistingScore) {
    const slug = score.event?.slug ?? "";
    const mode = modeForSlug(slug);
    setEditingScoreId(score.id);
    setEditValue(formatDbValue(score.value, mode));
    setEditNotes(score.notes ?? "");
  }

  function cancelEditScore() {
    setEditingScoreId(null);
    setEditValue("");
    setEditNotes("");
  }

  async function saveEditScore(score: ExistingScore) {
    const slug = score.event?.slug ?? "";
    const mode = modeForSlug(slug);

    // Strip unit suffixes so parseInputToDbValue can handle it
    let cleanValue = editValue.trim();
    if (mode === "time") {
      cleanValue = cleanValue.replace(/s$/i, "");
    } else if (mode === "distance") {
      cleanValue = cleanValue.replace(/m$/i, "");
    }

    const dbValue = parseInputToDbValue(cleanValue, mode);
    if (dbValue === null) {
      setFeedback({ type: "error", message: "Invalid score value." });
      return;
    }

    setEditSaving(true);
    const { error } = await supabase
      .from("scores")
      .update({ value: dbValue, notes: editNotes.trim() || null })
      .eq("id", score.id);

    if (error) {
      setFeedback({ type: "error", message: error.message });
    } else {
      await logAudit(supabase, "update", "score", score.id, {
        old_value: score.value,
        new_value: dbValue,
      });
      setFeedback({ type: "success", message: "Score updated." });
      cancelEditScore();
      await refreshScores();
      window.dispatchEvent(new CustomEvent("scores-updated"));
    }
    setEditSaving(false);
  }

  /* ---- delete ---- */

  async function deleteScore(scoreId: string) {
    const { error } = await supabase
      .from("scores")
      .delete()
      .eq("id", scoreId);
    if (!error) {
      await logAudit(supabase, "delete", "score", scoreId);
      setExistingScores(existingScores.filter((s) => s.id !== scoreId));
      window.dispatchEvent(new CustomEvent("scores-updated"));
    }
  }

  async function deleteAllScores() {
    if (
      !confirm(
        "Are you sure you want to delete ALL recorded scores? This cannot be undone."
      )
    )
      return;

    const { error } = await supabase
      .from("scores")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (!error) {
      await logAudit(supabase, "delete", "score", "all", {
        action: "bulk_delete_all",
      });
      setExistingScores([]);
      setFeedback({
        type: "success",
        message: "All scores have been deleted.",
      });
      window.dispatchEvent(new CustomEvent("scores-updated"));
    } else {
      setFeedback({ type: "error", message: error.message });
    }
  }

  /* ---- CSV export ---- */

  function exportCsv() {
    const scores = filterEvent
      ? existingScores.filter((s) => s.event?.id === filterEvent)
      : existingScores;

    const header = "Event,Team,Participant,Result,Notes,Date";
    const rows = scores.map((s) => {
      const slug = s.event?.slug ?? "";
      const mode = modeForSlug(slug);
      const result = formatDbValue(s.value, mode);
      const escape = (v: string) =>
        v.includes(",") || v.includes('"')
          ? `"${v.replace(/"/g, '""')}"`
          : v;
      return [
        escape(s.event?.name ?? ""),
        escape(s.team?.name ?? ""),
        escape(s.user?.display_name ?? ""),
        escape(result),
        escape(s.notes ?? ""),
        new Date(s.created_at).toLocaleDateString(),
      ].join(",");
    });

    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `scores-export-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  /* ---- bulk import ---- */

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImportText((ev.target?.result as string) ?? "");
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function handleBulkImport() {
    if (!importText.trim()) {
      setFeedback({ type: "error", message: "No data to import." });
      return;
    }

    setImportSaving(true);
    setFeedback(null);

    const lines = importText
      .trim()
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    // Skip header if it looks like one
    const firstLine = lines[0].toLowerCase();
    const startIdx =
      firstLine.includes("event") && firstLine.includes("team") ? 1 : 0;

    const rows: {
      event_id: string;
      team_id: string;
      user_id: string;
      value: number;
      notes: string | null;
      metadata: Record<string, unknown> | null;
    }[] = [];
    const errors: string[] = [];

    for (let i = startIdx; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      if (cols.length < 4) {
        errors.push(`Row ${i + 1}: not enough columns (need at least 4: event, team, participant, value)`);
        continue;
      }

      const [eventName, teamName, participantName, rawValue, notes] = cols;

      // Match event by name (case-insensitive)
      const ruleEvent = rulesEvents.find(
        (e) => e.name.toLowerCase() === eventName.trim().toLowerCase()
      );
      if (!ruleEvent) {
        errors.push(`Row ${i + 1}: unknown event "${eventName.trim()}"`);
        continue;
      }
      const dbEvent = dbEvents.find((e) => e.slug === ruleEvent.slug);
      if (!dbEvent) {
        errors.push(`Row ${i + 1}: event not synced "${eventName.trim()}"`);
        continue;
      }

      // Match team
      const team = teams.find(
        (t) => t.name.toLowerCase() === teamName.trim().toLowerCase()
      );
      if (!team) {
        errors.push(`Row ${i + 1}: unknown team "${teamName.trim()}"`);
        continue;
      }

      // Match participant
      const member = teamMembers.find(
        (m) =>
          m.team_id === team.id &&
          m.display_name.toLowerCase() ===
            participantName.trim().toLowerCase()
      );
      if (!member) {
        errors.push(
          `Row ${i + 1}: "${participantName.trim()}" not found on team "${team.name}"`
        );
        continue;
      }

      const mode = modeForSlug(ruleEvent.slug);
      const dbValue = parseInputToDbValue(rawValue.trim(), mode);
      if (dbValue === null) {
        errors.push(
          `Row ${i + 1}: invalid value "${rawValue.trim()}" for ${mode}`
        );
        continue;
      }

      rows.push({
        event_id: dbEvent.id,
        team_id: team.id,
        user_id: member.id,
        value: dbValue,
        notes: notes?.trim() || null,
        metadata: { input_type: mode, source: "csv_import" },
      });
    }

    if (rows.length === 0) {
      setFeedback({
        type: "error",
        message:
          errors.length > 0
            ? `No valid rows. Errors:\n${errors.slice(0, 5).join("\n")}`
            : "No valid rows found in the data.",
      });
      setImportSaving(false);
      return;
    }

    const { error } = await supabase.from("scores").insert(rows).select("id");

    if (error) {
      setFeedback({ type: "error", message: error.message });
    } else {
      await logAudit(supabase, "create", "score", "bulk_import", {
        count: rows.length,
        errors: errors.length,
      });
      const msg = `Imported ${rows.length} score(s) successfully!${
        errors.length > 0
          ? ` ${errors.length} row(s) skipped.`
          : ""
      }`;
      setFeedback({ type: "success", message: msg });
      setImportText("");
      setShowImport(false);
      await refreshScores();
      window.dispatchEvent(new CustomEvent("scores-updated"));
    }
    setImportSaving(false);
  }

  // Filter → Search → Sort → Paginate
  const afterFilter = filterEvent
    ? existingScores.filter((s) => s.event?.id === filterEvent)
    : existingScores;

  const query = searchQuery.toLowerCase().trim();
  const afterSearch = query
    ? afterFilter.filter(
        (s) =>
          (s.user?.display_name ?? "").toLowerCase().includes(query) ||
          (s.team?.name ?? "").toLowerCase().includes(query)
      )
    : afterFilter;

  const sortedScores = [...afterSearch].sort((a, b) => {
    let cmp = 0;
    switch (sortCol) {
      case "event":
        cmp = (a.event?.name ?? "").localeCompare(b.event?.name ?? "");
        break;
      case "team":
        cmp = (a.team?.name ?? "").localeCompare(b.team?.name ?? "");
        break;
      case "participant":
        cmp = (a.user?.display_name ?? "").localeCompare(b.user?.display_name ?? "");
        break;
      case "result":
        cmp = a.value - b.value;
        break;
      case "date":
        cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        break;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  const totalPages = Math.max(1, Math.ceil(sortedScores.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedScores = sortedScores.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  function toggleSort(col: typeof sortCol) {
    if (sortCol === col) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir(col === "date" ? "desc" : "asc");
    }
    setPage(1);
  }

  function SortIcon({ col }: { col: typeof sortCol }) {
    if (sortCol !== col) return <ChevronsUpDown className="w-3 h-3 text-muted/50" />;
    return sortDir === "asc" ? (
      <ChevronUp className="w-3 h-3 text-coral" />
    ) : (
      <ChevronDown className="w-3 h-3 text-coral" />
    );
  }

  /* ---- event options ---- */

  const eventOptions: { value: string; label: string }[] = [
    { value: "", label: "Select event..." },
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
            className={`mb-6 p-4 rounded-xl flex items-start gap-2 ${
              feedback.type === "success"
                ? "bg-success/10 text-success"
                : "bg-danger/10 text-danger"
            }`}
          >
            {feedback.type === "success" ? (
              <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            )}
            <p className="text-sm font-medium whitespace-pre-line">
              {feedback.message}
            </p>
          </motion.div>
        )}

        {/* Batch Entry */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-bold text-foreground">
              ENTER SCORES
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowImport(!showImport)}
            >
              <Upload className="w-3.5 h-3.5" />
              {showImport ? "Hide Import" : "Bulk Import"}
            </Button>
          </div>

          {/* Bulk Import Panel */}
          {showImport && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="bg-card rounded-xl border border-border p-6 mb-4 space-y-4"
            >
              <div>
                <h3 className="font-display text-sm font-bold text-foreground uppercase mb-1">
                  BULK IMPORT FROM CSV
                </h3>
                <p className="text-xs text-muted">
                  Paste CSV data or upload a file. Format: <code className="bg-background px-1 py-0.5 rounded text-foreground">Event, Team, Participant, Value, Notes</code> (one row per score). The header row is optional.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload CSV
                </Button>
                <span className="text-xs text-muted">or paste below</span>
              </div>

              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={`Event, Team, Participant, Value, Notes\n100m Sprint, Team Alpha, John Doe, 12.34, Great run\nStanding Long Jump, Team Beta, Jane Smith, 3.45,`}
                rows={6}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-coral/30 focus:border-coral"
              />

              <div className="flex items-center gap-3">
                <Button
                  onClick={handleBulkImport}
                  loading={importSaving}
                  size="sm"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Import Scores
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowImport(false);
                    setImportText("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          )}

          <div className="bg-card rounded-xl border border-border p-6">
            {loading ? (
              <div className="text-center text-muted py-8 text-sm">
                Loading...
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {batchEntries.map((entry, i) => {
                    const mode = entry.event_slug
                      ? modeForSlug(entry.event_slug)
                      : "points";
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
                              if (e.target.value.startsWith("__")) return;
                              updateEntry(i, "event_slug", e.target.value);
                            }}
                            options={eventOptions}
                          />
                          <Select
                            label="Team"
                            value={entry.team_id}
                            onChange={(e) =>
                              updateEntry(i, "team_id", e.target.value)
                            }
                            options={[
                              { value: "", label: "Select team..." },
                              ...teams.map((t) => ({
                                value: t.id,
                                label: t.name,
                              })),
                            ]}
                          />
                          <Select
                            label="Participant"
                            value={entry.user_id}
                            onChange={(e) =>
                              updateEntry(i, "user_id", e.target.value)
                            }
                            options={
                              entry.team_id
                                ? [
                                    {
                                      value: "",
                                      label: "Select member...",
                                    },
                                    ...memberOptions,
                                  ]
                                : [
                                    {
                                      value: "",
                                      label: "Select a team first",
                                    },
                                  ]
                            }
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
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
                            onChange={(e) =>
                              updateEntry(i, "raw_input", e.target.value)
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
          <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
            <h2 className="font-display text-lg font-bold text-foreground">
              RECORDED SCORES
              {existingScores.length > 0 && (
                <span className="text-xs font-normal text-muted ml-2">
                  ({sortedScores.length}{filterEvent || query ? ` of ${existingScores.length}` : ""})
                </span>
              )}
            </h2>
            <div className="flex items-center gap-3 flex-wrap">
              {existingScores.length > 0 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportCsv}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export CSV
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={deleteAllScores}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete All
                  </Button>
                </>
              )}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search name or team..."
                  className="w-48 pl-8 pr-3 py-2 rounded-xl border border-border bg-background text-foreground text-xs placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-coral/30 focus:border-coral"
                />
              </div>
              <div className="w-44">
                <Select
                  value={filterEvent}
                  onChange={(e) => {
                    setFilterEvent(e.target.value);
                    setPage(1);
                  }}
                  options={[
                    { value: "", label: "All Events" },
                    ...dbEvents.map((ev) => ({
                      value: ev.id,
                      label: ev.name,
                    })),
                  ]}
                />
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border overflow-hidden">
            {sortedScores.length === 0 ? (
              <p className="text-center text-muted text-sm py-8">
                {existingScores.length === 0
                  ? "No scores recorded yet."
                  : "No scores match your filters."}
              </p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-background border-b border-border">
                      <tr>
                        <th
                          className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase cursor-pointer hover:text-foreground transition-colors select-none"
                          onClick={() => toggleSort("event")}
                        >
                          <span className="inline-flex items-center gap-1">
                            Event <SortIcon col="event" />
                          </span>
                        </th>
                        <th
                          className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase cursor-pointer hover:text-foreground transition-colors select-none"
                          onClick={() => toggleSort("team")}
                        >
                          <span className="inline-flex items-center gap-1">
                            Team <SortIcon col="team" />
                          </span>
                        </th>
                        <th
                          className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase cursor-pointer hover:text-foreground transition-colors select-none"
                          onClick={() => toggleSort("participant")}
                        >
                          <span className="inline-flex items-center gap-1">
                            Participant <SortIcon col="participant" />
                          </span>
                        </th>
                        <th
                          className="text-right px-4 py-3 font-semibold text-muted text-xs uppercase cursor-pointer hover:text-foreground transition-colors select-none"
                          onClick={() => toggleSort("result")}
                        >
                          <span className="inline-flex items-center gap-1 justify-end">
                            Result <SortIcon col="result" />
                          </span>
                        </th>
                        <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase">
                          Notes
                        </th>
                        <th
                          className="text-right px-4 py-3 font-semibold text-muted text-xs uppercase cursor-pointer hover:text-foreground transition-colors select-none"
                          onClick={() => toggleSort("date")}
                        >
                          <span className="inline-flex items-center gap-1 justify-end">
                            Date <SortIcon col="date" />
                          </span>
                        </th>
                        <th className="px-4 py-3 w-20"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {paginatedScores.map((score) => {
                        const slug = score.event?.slug ?? "";
                        const mode = modeForSlug(slug);
                        const isEditing = editingScoreId === score.id;

                        return (
                          <tr
                            key={score.id}
                            className={
                              isEditing
                                ? "bg-coral/5"
                                : "hover:bg-background/50"
                            }
                          >
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
                            <td className="px-4 py-3 text-right">
                              {isEditing ? (
                                <input
                                  value={editValue}
                                  onChange={(e) =>
                                    setEditValue(e.target.value)
                                  }
                                  className="w-24 px-2 py-1 rounded-lg border border-border bg-background text-foreground text-sm font-mono font-bold text-right focus:outline-none focus:ring-2 focus:ring-coral/30 focus:border-coral"
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter")
                                      saveEditScore(score);
                                    if (e.key === "Escape")
                                      cancelEditScore();
                                  }}
                                  autoFocus
                                />
                              ) : (
                                <span className="font-mono font-bold text-foreground">
                                  {formatDbValue(score.value, mode)}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {isEditing ? (
                                <input
                                  value={editNotes}
                                  onChange={(e) =>
                                    setEditNotes(e.target.value)
                                  }
                                  className="w-full px-2 py-1 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-coral/30 focus:border-coral"
                                  placeholder="Notes"
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter")
                                      saveEditScore(score);
                                    if (e.key === "Escape")
                                      cancelEditScore();
                                  }}
                                />
                              ) : (
                                <span className="text-muted">
                                  {score.notes || "—"}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right text-xs text-muted whitespace-nowrap">
                              {new Date(score.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1 justify-end">
                                {isEditing ? (
                                  <>
                                    <button
                                      onClick={() => saveEditScore(score)}
                                      disabled={editSaving}
                                      className="p-1 text-success hover:text-green-600 transition-colors"
                                    >
                                      <Check className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={cancelEditScore}
                                      className="p-1 text-muted hover:text-foreground transition-colors"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => startEditScore(score)}
                                      className="p-1 text-muted hover:text-coral transition-colors"
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => deleteScore(score.id)}
                                      className="p-1 text-muted hover:text-danger transition-colors"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                    <span className="text-xs text-muted">
                      Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, sortedScores.length)} of {sortedScores.length}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setPage(1)}
                        disabled={safePage === 1}
                        className="px-2 py-1 text-xs rounded-lg text-muted hover:text-foreground hover:bg-background disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        First
                      </button>
                      <button
                        onClick={() => setPage(safePage - 1)}
                        disabled={safePage === 1}
                        className="p-1 rounded-lg text-muted hover:text-foreground hover:bg-background disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(
                          (p) =>
                            p === 1 ||
                            p === totalPages ||
                            Math.abs(p - safePage) <= 1
                        )
                        .reduce<(number | "ellipsis")[]>((acc, p, i, arr) => {
                          if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("ellipsis");
                          acc.push(p);
                          return acc;
                        }, [])
                        .map((item, i) =>
                          item === "ellipsis" ? (
                            <span key={`e${i}`} className="px-1 text-xs text-muted">
                              ...
                            </span>
                          ) : (
                            <button
                              key={item}
                              onClick={() => setPage(item as number)}
                              className={`w-8 h-8 text-xs rounded-lg transition-colors ${
                                safePage === item
                                  ? "bg-coral text-white font-bold"
                                  : "text-muted hover:text-foreground hover:bg-background"
                              }`}
                            >
                              {item}
                            </button>
                          )
                        )}
                      <button
                        onClick={() => setPage(safePage + 1)}
                        disabled={safePage === totalPages}
                        className="p-1 rounded-lg text-muted hover:text-foreground hover:bg-background disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setPage(totalPages)}
                        disabled={safePage === totalPages}
                        className="px-2 py-1 text-xs rounded-lg text-muted hover:text-foreground hover:bg-background disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        Last
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </PageTransition>
  );
}

/* ------------------------------------------------------------------ */
/*  CSV line parser (handles quoted fields with commas)                */
/* ------------------------------------------------------------------ */

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}
