"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Calendar,
  Plus,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/ui/page-transition";
import { ScheduleCalendar } from "@/components/admin/schedule-calendar";
import {
  ScheduleEntryForm,
  type EntryFormData,
} from "@/components/admin/schedule-entry-form";
import { logAudit } from "@/lib/audit";
import type { ScheduleEntry, ScheduleCategory } from "@/lib/types";

const emptyForm: EntryFormData = {
  title: "",
  description: "",
  start_time: "",
  end_time: "",
  location: "",
  category: "general" as ScheduleCategory,
  event_slug: "",
};

export default function AdminSchedulePage() {
  const supabase = createClient();
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<EntryFormData>(emptyForm);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    fetchEntries();
  }, []);

  async function fetchEntries() {
    const { data } = await supabase
      .from("schedule_entries")
      .select("*")
      .order("start_time", { ascending: true });
    setEntries((data as ScheduleEntry[]) ?? []);
    setLoading(false);
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  }

  function handleClickEntry(entry: ScheduleEntry) {
    setEditingId(entry.id);
    setForm({
      title: entry.title,
      description: entry.description ?? "",
      start_time: entry.start_time.slice(0, 5),
      end_time: entry.end_time.slice(0, 5),
      location: entry.location ?? "",
      category: entry.category,
      event_slug: entry.event_slug ?? "",
    });
    setShowForm(true);
  }

  function handleClickSlot(startTime: string, endTime: string) {
    setEditingId(null);
    setForm({
      ...emptyForm,
      start_time: startTime,
      end_time: endTime,
    });
    setShowForm(true);
  }

  function handleNewEntry() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.title.trim() || !form.start_time || !form.end_time) {
      setFeedback({
        type: "error",
        message: "Title, start time, and end time are required.",
      });
      return;
    }

    setSaving(true);
    setFeedback(null);

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      start_time: form.start_time.length === 5 ? form.start_time + ":00" : form.start_time,
      end_time: form.end_time.length === 5 ? form.end_time + ":00" : form.end_time,
      location: form.location.trim() || null,
      category: form.category,
      event_slug: form.event_slug || null,
    };

    if (editingId) {
      const { error } = await supabase
        .from("schedule_entries")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", editingId);

      if (error) {
        setFeedback({ type: "error", message: error.message });
      } else {
        await logAudit(supabase, "update", "schedule_entry", editingId, {
          title: payload.title,
        });
        setFeedback({ type: "success", message: "Entry updated." });
        resetForm();
        await fetchEntries();
      }
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // sort_order based on time position
      const timeMinutes =
        parseInt(form.start_time.split(":")[0]) * 60 +
        parseInt(form.start_time.split(":")[1]);

      const { error, data: inserted } = await supabase
        .from("schedule_entries")
        .insert({
          ...payload,
          created_by: user!.id,
          sort_order: timeMinutes,
        })
        .select("id")
        .single();

      if (error) {
        setFeedback({ type: "error", message: error.message });
      } else {
        await logAudit(supabase, "create", "schedule_entry", inserted.id, {
          title: payload.title,
        });
        setFeedback({ type: "success", message: "Entry added to schedule." });
        resetForm();
        await fetchEntries();
      }
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!editingId) return;
    const { error } = await supabase
      .from("schedule_entries")
      .delete()
      .eq("id", editingId);
    if (!error) {
      await logAudit(supabase, "delete", "schedule_entry", editingId);
      setEntries(entries.filter((e) => e.id !== editingId));
      resetForm();
    }
  }

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Admin
        </Link>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">
                SCHEDULE & EVENTS
              </h1>
              <p className="text-sm text-muted">
                Build the event-day calendar — click to add, click blocks to edit
              </p>
            </div>
          </div>
          <Button onClick={handleNewEntry} size="sm">
            <Plus className="w-4 h-4" />
            New Block
          </Button>
        </div>

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

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Calendar */}
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="bg-card rounded-xl border border-border flex items-center justify-center py-20">
                <div className="w-8 h-8 border-4 border-coral border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <ScheduleCalendar
                entries={entries}
                onClickEntry={handleClickEntry}
                onClickSlot={handleClickSlot}
                selectedId={editingId}
              />
            )}
          </div>

          {/* Side panel form */}
          <AnimatePresence>
            {showForm && (
              <div className="w-full lg:w-[380px] shrink-0">
                <ScheduleEntryForm
                  form={form}
                  onChange={setForm}
                  onSave={handleSave}
                  onDelete={editingId ? handleDelete : undefined}
                  onCancel={resetForm}
                  isEditing={!!editingId}
                  saving={saving}
                />
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </PageTransition>
  );
}
