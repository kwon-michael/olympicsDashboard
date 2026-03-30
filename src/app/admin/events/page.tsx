"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Calendar,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  MapPin,
  Clock,
  Edit2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { PageTransition } from "@/components/ui/page-transition";
import type { Event } from "@/lib/types";

export default function AdminEventsPage() {
  const supabase = createClient();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Form
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [status, setStatus] = useState<"upcoming" | "in_progress" | "completed">("upcoming");
  const [maxParticipants, setMaxParticipants] = useState(0);

  useEffect(() => {
    fetchEvents();
  }, []);

  async function fetchEvents() {
    const { data } = await supabase
      .from("events")
      .select("*")
      .order("scheduled_at", { ascending: true });
    setEvents((data as Event[]) ?? []);
    setLoading(false);
  }

  async function createEvent() {
    if (!name.trim()) {
      setFeedback({ type: "error", message: "Event name is required." });
      return;
    }
    setSaving(true);
    setFeedback(null);

    const { error } = await supabase.from("events").insert({
      name: name.trim(),
      description: description.trim() || null,
      location: location.trim() || null,
      scheduled_at: scheduledAt || null,
      status,
      max_participants: maxParticipants || null,
    });

    if (error) {
      setFeedback({ type: "error", message: error.message });
    } else {
      setFeedback({ type: "success", message: "Event created!" });
      setName("");
      setDescription("");
      setLocation("");
      setScheduledAt("");
      setStatus("upcoming");
      setMaxParticipants(0);
      setShowForm(false);
      fetchEvents();
    }
    setSaving(false);
  }

  async function updateStatus(id: string, newStatus: string) {
    await supabase.from("events").update({ status: newStatus }).eq("id", id);
    fetchEvents();
  }

  async function deleteEvent(id: string) {
    await supabase.from("events").delete().eq("id", id);
    setEvents(events.filter((e) => e.id !== id));
  }

  const statusColors: Record<string, string> = {
    upcoming: "#3B82F6",
    in_progress: "#F5A623",
    completed: "#22C55E",
  };

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Admin
        </Link>

        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-info/10 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-info" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">
                EVENT MANAGEMENT
              </h1>
              <p className="text-sm text-muted">Create and manage events</p>
            </div>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="w-4 h-4 mr-1" />
            New Event
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

        {/* New event form */}
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="bg-card rounded-xl border border-border p-6 mb-8 space-y-4"
          >
            <h3 className="font-display text-sm font-bold uppercase text-muted">
              Create Event
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                label="Event Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Relay Race"
              />
              <Input
                label="Location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., Main Field"
              />
              <Input
                label="Scheduled At"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
              <Input
                label="Max Participants"
                type="number"
                min={0}
                value={maxParticipants || ""}
                onChange={(e) => setMaxParticipants(Number(e.target.value))}
              />
              <Select
                label="Status"
                value={status}
                onChange={(e) =>
                  setStatus(
                    e.target.value as "upcoming" | "in_progress" | "completed"
                  )
                }
                options={[
                  { value: "upcoming", label: "Upcoming" },
                  { value: "in_progress", label: "In Progress" },
                  { value: "completed", label: "Completed" },
                ]}
              />
            </div>
            <Textarea
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the event..."
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
              <Button onClick={createEvent} loading={saving}>
                Create Event
              </Button>
            </div>
          </motion.div>
        )}

        {/* Events list */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-center text-muted py-8 text-sm">
              Loading events...
            </div>
          ) : events.length === 0 ? (
            <div className="text-center text-muted py-8 text-sm">
              No events created yet.
            </div>
          ) : (
            events.map((event) => (
              <div
                key={event.id}
                className="bg-card rounded-xl border border-border p-4 flex items-start justify-between gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-foreground text-sm">
                      {event.name}
                    </h3>
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor:
                          (statusColors[event.status] ?? "#666") + "15",
                        color: statusColors[event.status] ?? "#666",
                      }}
                    >
                      {event.status.replace("_", " ")}
                    </span>
                  </div>
                  {event.description && (
                    <p className="text-xs text-muted line-clamp-1 mb-1">
                      {event.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-muted">
                    {event.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {event.location}
                      </span>
                    )}
                    {event.scheduled_at && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(event.scheduled_at).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Select
                    value={event.status}
                    onChange={(e) => updateStatus(event.id, e.target.value)}
                    options={[
                      { value: "upcoming", label: "Upcoming" },
                      { value: "in_progress", label: "In Progress" },
                      { value: "completed", label: "Completed" },
                    ]}
                  />
                  <button
                    onClick={() => deleteEvent(event.id)}
                    className="text-muted hover:text-danger transition-colors p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </PageTransition>
  );
}
