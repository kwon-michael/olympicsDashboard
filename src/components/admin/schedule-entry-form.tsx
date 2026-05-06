"use client";

import { motion } from "framer-motion";
import { Save, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { allEvents } from "@/lib/events";
import type { ScheduleCategory } from "@/lib/types";

const categoryOptions: { value: ScheduleCategory; label: string }[] = [
  { value: "ceremony", label: "Ceremony" },
  { value: "solo_event", label: "Solo Event" },
  { value: "team_event", label: "Team Event" },
  { value: "break", label: "Break" },
  { value: "general", label: "General" },
];

export interface EntryFormData {
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  location: string;
  category: ScheduleCategory;
  event_slug: string;
}

interface ScheduleEntryFormProps {
  form: EntryFormData;
  onChange: (form: EntryFormData) => void;
  onSave: () => void;
  onDelete?: () => void;
  onCancel: () => void;
  isEditing: boolean;
  saving: boolean;
}

export function ScheduleEntryForm({
  form,
  onChange,
  onSave,
  onDelete,
  onCancel,
  isEditing,
  saving,
}: ScheduleEntryFormProps) {
  const showEventSlug =
    form.category === "solo_event" || form.category === "team_event";
  const eventOptions = allEvents
    .filter((e) =>
      form.category === "solo_event" ? e.type === "solo" : e.type === "team"
    )
    .map((e) => ({ value: e.slug, label: e.name }));

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="bg-card rounded-xl border border-border p-5 space-y-4"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-display text-sm font-bold text-foreground uppercase">
          {isEditing ? "Edit Entry" : "New Entry"}
        </h3>
        <button
          onClick={onCancel}
          className="p-1 text-muted hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <Input
        label="Title"
        value={form.title}
        onChange={(e) => onChange({ ...form, title: e.target.value })}
        placeholder="e.g., Opening Ceremony"
      />

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Start"
          type="time"
          value={form.start_time}
          onChange={(e) => onChange({ ...form, start_time: e.target.value })}
        />
        <Input
          label="End"
          type="time"
          value={form.end_time}
          onChange={(e) => onChange({ ...form, end_time: e.target.value })}
        />
      </div>

      <Input
        label="Location"
        value={form.location}
        onChange={(e) => onChange({ ...form, location: e.target.value })}
        placeholder="e.g., Main Field"
      />

      <Select
        label="Category"
        value={form.category}
        onChange={(e) =>
          onChange({
            ...form,
            category: e.target.value as ScheduleCategory,
            event_slug: "",
          })
        }
        options={categoryOptions}
      />

      {showEventSlug && (
        <Select
          label="Linked Event"
          value={form.event_slug}
          onChange={(e) => onChange({ ...form, event_slug: e.target.value })}
          options={[{ value: "", label: "— None —" }, ...eventOptions]}
        />
      )}

      <Textarea
        label="Description"
        value={form.description}
        onChange={(e) => onChange({ ...form, description: e.target.value })}
        placeholder="Optional details..."
        rows={2}
      />

      <div className="flex items-center gap-2 pt-2">
        <Button onClick={onSave} loading={saving} size="sm">
          {isEditing ? (
            <>
              <Save className="w-3.5 h-3.5" />
              Update
            </>
          ) : (
            <>
              <Plus className="w-3.5 h-3.5" />
              Add
            </>
          )}
        </Button>
        {isEditing && onDelete && (
          <Button variant="danger" size="sm" onClick={onDelete}>
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </Button>
        )}
      </div>
    </motion.div>
  );
}
