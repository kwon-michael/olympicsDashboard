"use client";

import { useEffect, useState } from "react";
import {
  Clock,
  MapPin,
  Calendar,
  Coffee,
  Flag,
  Users,
  User,
  List,
  LayoutGrid,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  PageTransition,
  StaggerContainer,
  StaggerItem,
} from "@/components/ui/page-transition";
import { ScheduleCalendar } from "@/components/admin/schedule-calendar";
import { getEventBySlug } from "@/lib/events";
import type { ScheduleEntry, ScheduleCategory } from "@/lib/types";

const categoryConfig: Record<
  ScheduleCategory,
  { label: string; icon: React.ElementType; color: string }
> = {
  ceremony: { label: "Ceremony", icon: Flag, color: "#F5A623" },
  solo_event: { label: "Solo Event", icon: User, color: "#E94560" },
  team_event: { label: "Team Event", icon: Users, color: "#3B82F6" },
  break: { label: "Break", icon: Coffee, color: "#6B7280" },
  general: { label: "General", icon: Calendar, color: "#22C55E" },
};

function formatTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

const EVENT_DATE = "2026-08-08";

function isEventDay(): boolean {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}` === EVENT_DATE;
}

function getCurrentTimeMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

type ViewMode = "timeline" | "calendar";

export default function SchedulePage() {
  const supabase = createClient();
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMinutes, setCurrentMinutes] = useState(getCurrentTimeMinutes());
  const [view, setView] = useState<ViewMode>("calendar");

  async function fetchEntries() {
    const { data } = await supabase
      .from("schedule_entries")
      .select("*")
      .order("start_time", { ascending: true });
    setEntries((data as ScheduleEntry[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetchEntries();

    const handleUpdate = () => fetchEntries();
    window.addEventListener("schedule-updated", handleUpdate);

    const timer = setInterval(() => {
      setCurrentMinutes(getCurrentTimeMinutes());
    }, 60_000);

    return () => {
      window.removeEventListener("schedule-updated", handleUpdate);
      clearInterval(timer);
    };
  }, []);

  return (
    <PageTransition>
      {/* Header */}
      <div className="bg-navy text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-2 mb-4">
              <Clock className="w-4 h-4 text-gold" />
              <span className="text-sm font-medium text-white/80">
                Event Day
              </span>
            </div>
            <h1 className="font-display text-4xl sm:text-5xl font-bold">
              SCHEDULE
            </h1>
            <p className="mt-3 text-white/60 max-w-lg mx-auto">
              The full event-day timeline. Check back for real-time updates.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* View toggle */}
        {!loading && entries.length > 0 && (
          <div className="flex items-center justify-end mb-6">
            <div className="inline-flex items-center bg-card border border-border rounded-xl p-1">
              <button
                onClick={() => setView("timeline")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  view === "timeline"
                    ? "bg-coral text-white"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <List className="w-3.5 h-3.5" />
                Timeline
              </button>
              <button
                onClick={() => setView("calendar")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  view === "calendar"
                    ? "bg-coral text-white"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Calendar
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center text-muted py-16 text-sm">
            Loading schedule...
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16">
            <Calendar className="w-12 h-12 text-muted mx-auto mb-4" />
            <h2 className="font-display text-xl font-bold text-foreground mb-2">
              SCHEDULE NOT YET PUBLISHED
            </h2>
            <p className="text-sm text-muted">
              Check back soon for the event-day timeline.
            </p>
          </div>
        ) : view === "calendar" ? (
          <ScheduleCalendar entries={entries} readOnly />
        ) : (
          <TimelineView
            entries={entries}
            currentMinutes={currentMinutes}
          />
        )}
      </div>
    </PageTransition>
  );
}

function TimelineView({
  entries,
  currentMinutes,
}: {
  entries: ScheduleEntry[];
  currentMinutes: number;
}) {
  return (
    <StaggerContainer className="relative">
      {/* Vertical timeline line */}
      <div className="absolute left-[23px] top-0 bottom-0 w-0.5 bg-border" />

      {entries.map((entry) => {
        const event = entry.event_slug
          ? getEventBySlug(entry.event_slug)
          : null;
        const config =
          categoryConfig[entry.category] ?? categoryConfig.general;
        const color = event?.color ?? config.color;
        const Icon = event?.icon ?? config.icon;

        const entryStart = timeToMinutes(entry.start_time);
        const entryEnd = timeToMinutes(entry.end_time);
        const today = isEventDay();
        const isActive =
          today && currentMinutes >= entryStart && currentMinutes < entryEnd;
        const isPast = today && currentMinutes >= entryEnd;

        return (
          <StaggerItem key={entry.id}>
            <div
              className={`relative flex gap-4 pb-8 ${
                isPast ? "opacity-50" : ""
              }`}
            >
              {/* Timeline dot */}
              <div className="relative z-10 shrink-0">
                <div
                  className={`w-[48px] h-[48px] rounded-xl flex items-center justify-center ${
                    isActive
                      ? "ring-2 ring-offset-2 ring-offset-background"
                      : ""
                  }`}
                  style={{
                    backgroundColor: color + "15",
                    ...(isActive ? { ringColor: color } : {}),
                  }}
                >
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                {isActive && (
                  <span
                    className="absolute -top-1 -right-1 w-3 h-3 rounded-full animate-pulse"
                    style={{ backgroundColor: color }}
                  />
                )}
              </div>

              {/* Content */}
              <div
                className={`flex-1 bg-card rounded-xl border p-5 ${
                  isActive ? "border-current shadow-lg" : "border-border"
                }`}
                style={isActive ? { borderColor: color } : undefined}
              >
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: color + "15",
                      color,
                    }}
                  >
                    {event ? event.name : config.label}
                  </span>
                  {isActive && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white px-2 py-0.5 rounded-full bg-coral animate-pulse">
                      Now
                    </span>
                  )}
                </div>

                <h3 className="font-display text-lg font-bold text-foreground">
                  {entry.title}
                </h3>

                <div className="flex items-center gap-4 mt-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                    <Clock className="w-3.5 h-3.5" />
                    {formatTime(entry.start_time)} –{" "}
                    {formatTime(entry.end_time)}
                  </span>
                  {entry.location && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                      <MapPin className="w-3.5 h-3.5" />
                      {entry.location}
                    </span>
                  )}
                </div>

                {entry.description && (
                  <p className="text-sm text-muted mt-3 leading-relaxed">
                    {entry.description}
                  </p>
                )}
              </div>
            </div>
          </StaggerItem>
        );
      })}
    </StaggerContainer>
  );
}
