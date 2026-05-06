"use client";

import { useRef } from "react";
import { Clock, MapPin, Pencil } from "lucide-react";
import { getEventBySlug } from "@/lib/events";
import type { ScheduleEntry, ScheduleCategory } from "@/lib/types";

const DAY_START_HOUR = 7;
const DAY_END_HOUR = 20;
const HOUR_HEIGHT = 90;
const TOTAL_HOURS = DAY_END_HOUR - DAY_START_HOUR;
const TOTAL_HEIGHT = TOTAL_HOURS * HOUR_HEIGHT;

const categoryColors: Record<ScheduleCategory, string> = {
  ceremony: "#F5A623",
  solo_event: "#E94560",
  team_event: "#3B82F6",
  break: "#6B7280",
  general: "#22C55E",
};

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToPosition(minutes: number): number {
  const dayStartMinutes = DAY_START_HOUR * 60;
  return ((minutes - dayStartMinutes) / (TOTAL_HOURS * 60)) * TOTAL_HEIGHT;
}

function minutesToTimeStr(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatTimeLabel(hour: number): string {
  const ampm = hour >= 12 ? "PM" : "AM";
  const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${display} ${ampm}`;
}

function formatTimeShort(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${display}:${m} ${ampm}`;
}

interface ScheduleCalendarProps {
  entries: ScheduleEntry[];
  onClickEntry?: (entry: ScheduleEntry) => void;
  onClickSlot?: (startTime: string, endTime: string) => void;
  selectedId?: string | null;
  readOnly?: boolean;
}

export function ScheduleCalendar({
  entries,
  onClickEntry,
  onClickSlot,
  selectedId,
  readOnly = false,
}: ScheduleCalendarProps) {
  const gridRef = useRef<HTMLDivElement>(null);

  const sortedEntries = [...entries].sort(
    (a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time)
  );

  // Compute overlap columns
  const columns = computeColumns(sortedEntries);

  function handleGridClick(e: React.MouseEvent) {
    if (readOnly || !onClickSlot) return;
    if (e.target !== e.currentTarget) return;
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return;

    const y = e.clientY - rect.top + (gridRef.current?.scrollTop ?? 0);
    const rawMinutes = DAY_START_HOUR * 60 + (y / TOTAL_HEIGHT) * TOTAL_HOURS * 60;
    const snapped = Math.round(rawMinutes / 15) * 15;
    const clamped = Math.max(DAY_START_HOUR * 60, Math.min(snapped, (DAY_END_HOUR - 1) * 60));

    onClickSlot(minutesToTimeStr(clamped), minutesToTimeStr(clamped + 30));
  }

  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => DAY_START_HOUR + i);

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Category legend */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border flex-wrap">
        {(Object.entries(categoryColors) as [ScheduleCategory, string][]).map(
          ([cat, color]) => (
            <span key={cat} className="flex items-center gap-1.5 text-[10px] text-muted uppercase tracking-wider">
              <span
                className="w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: color }}
              />
              {cat.replace("_", " ")}
            </span>
          )
        )}
      </div>

      <div className="overflow-y-auto max-h-[800px]">
        <div className="flex" style={{ minHeight: TOTAL_HEIGHT }}>
          {/* Hour labels */}
          <div className="w-16 shrink-0 border-r border-border relative">
            {hours.map((hour) => (
              <div
                key={hour}
                className="absolute w-full text-right pr-2"
                style={{
                  top: (hour - DAY_START_HOUR) * HOUR_HEIGHT - 8,
                  height: HOUR_HEIGHT,
                }}
              >
                <span className="text-[10px] text-muted font-medium">
                  {formatTimeLabel(hour)}
                </span>
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div
            ref={gridRef}
            className={`flex-1 relative ${readOnly ? "" : "cursor-pointer"}`}
            style={{ height: TOTAL_HEIGHT }}
            onClick={handleGridClick}
          >
            {/* Hour lines */}
            {hours.map((hour) => (
              <div
                key={hour}
                className="absolute left-0 right-0 border-t border-border"
                style={{ top: (hour - DAY_START_HOUR) * HOUR_HEIGHT }}
              />
            ))}

            {/* Half-hour lines */}
            {hours.map((hour) => (
              <div
                key={`half-${hour}`}
                className="absolute left-0 right-0 border-t border-border/30"
                style={{ top: (hour - DAY_START_HOUR) * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
              />
            ))}

            {/* Entry blocks */}
            {sortedEntries.map((entry) => {
              const startMin = timeToMinutes(entry.start_time);
              const endMin = timeToMinutes(entry.end_time);
              const top = minutesToPosition(startMin);
              const height = Math.max(
                ((endMin - startMin) / (TOTAL_HOURS * 60)) * TOTAL_HEIGHT,
                28
              );

              const event = entry.event_slug
                ? getEventBySlug(entry.event_slug)
                : null;
              const color =
                event?.color ??
                categoryColors[entry.category] ??
                categoryColors.general;
              const Icon = event?.icon ?? null;
              const col = columns.get(entry.id) ?? { index: 0, total: 1 };
              const widthPct = 100 / col.total;
              const leftPct = col.index * widthPct;
              const isSelected = selectedId === entry.id;
              const isCompact = height < 50;

              return (
                <div
                  key={entry.id}
                  className={`absolute rounded-lg border-l-[3px] px-2 py-1 transition-all group overflow-hidden ${
                    readOnly ? "z-[1]" : "cursor-pointer"
                  } ${
                    isSelected
                      ? "ring-2 ring-coral shadow-lg z-20"
                      : readOnly
                      ? ""
                      : "hover:shadow-md hover:z-10 z-[1]"
                  }`}
                  style={{
                    top,
                    height,
                    left: `calc(${leftPct}% + 4px)`,
                    width: `calc(${widthPct}% - 8px)`,
                    borderLeftColor: color,
                    backgroundColor: color + "12",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!readOnly && onClickEntry) onClickEntry(entry);
                  }}
                >
                  {isCompact ? (
                    <div className="flex items-center gap-1.5 h-full">
                      {Icon && (
                        <Icon
                          className="w-3 h-3 shrink-0"
                          style={{ color }}
                        />
                      )}
                      <span className="text-[11px] font-semibold text-foreground truncate">
                        {entry.title}
                      </span>
                      <span className="text-[10px] text-muted ml-auto shrink-0">
                        {formatTimeShort(entry.start_time)}
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-1.5">
                        {Icon && (
                          <Icon
                            className="w-3.5 h-3.5 shrink-0"
                            style={{ color }}
                          />
                        )}
                        <span className="text-xs font-bold text-foreground truncate">
                          {entry.title}
                        </span>
                        {!readOnly && (
                          <Pencil className="w-3 h-3 text-muted opacity-0 group-hover:opacity-100 transition-opacity ml-auto shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          {formatTimeShort(entry.start_time)} –{" "}
                          {formatTimeShort(entry.end_time)}
                        </span>
                      </div>
                      {entry.location && height >= 70 && (
                        <span className="text-[10px] text-muted flex items-center gap-0.5 mt-0.5">
                          <MapPin className="w-2.5 h-2.5" />
                          {entry.location}
                        </span>
                      )}
                    </>
                  )}
                </div>
              );
            })}

            {/* Click hint when empty */}
            {sortedEntries.length === 0 && !readOnly && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-sm text-muted">
                  Click anywhere to add a time block
                </p>
              </div>
            )}
            {sortedEntries.length === 0 && readOnly && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-sm text-muted">
                  Schedule not yet published
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function computeColumns(
  entries: ScheduleEntry[]
): Map<string, { index: number; total: number }> {
  const result = new Map<string, { index: number; total: number }>();
  const groups: ScheduleEntry[][] = [];

  for (const entry of entries) {
    const startMin = timeToMinutes(entry.start_time);
    let placed = false;

    for (const group of groups) {
      const lastInGroup = group[group.length - 1];
      if (timeToMinutes(lastInGroup.end_time) <= startMin) {
        group.push(entry);
        placed = true;
        break;
      }
    }

    if (!placed) {
      groups.push([entry]);
    }
  }

  // For overlapping entries, assign columns
  const active: { entry: ScheduleEntry; col: number }[] = [];
  for (const entry of entries) {
    const startMin = timeToMinutes(entry.start_time);

    // Remove entries that have ended
    for (let i = active.length - 1; i >= 0; i--) {
      if (timeToMinutes(active[i].entry.end_time) <= startMin) {
        active.splice(i, 1);
      }
    }

    // Find first free column
    const usedCols = new Set(active.map((a) => a.col));
    let col = 0;
    while (usedCols.has(col)) col++;

    active.push({ entry, col });
    result.set(entry.id, { index: col, total: 0 });
  }

  // Compute max columns per overlap group
  for (const entry of entries) {
    const startMin = timeToMinutes(entry.start_time);
    const endMin = timeToMinutes(entry.end_time);

    let maxCol = result.get(entry.id)!.index;
    for (const other of entries) {
      if (other.id === entry.id) continue;
      const oStart = timeToMinutes(other.start_time);
      const oEnd = timeToMinutes(other.end_time);
      if (oStart < endMin && oEnd > startMin) {
        maxCol = Math.max(maxCol, result.get(other.id)!.index);
      }
    }

    const current = result.get(entry.id)!;
    current.total = Math.max(current.total, maxCol + 1);
  }

  // Normalize totals for overlapping groups
  for (const entry of entries) {
    const startMin = timeToMinutes(entry.start_time);
    const endMin = timeToMinutes(entry.end_time);
    let groupMax = result.get(entry.id)!.total;

    for (const other of entries) {
      if (other.id === entry.id) continue;
      const oStart = timeToMinutes(other.start_time);
      const oEnd = timeToMinutes(other.end_time);
      if (oStart < endMin && oEnd > startMin) {
        groupMax = Math.max(groupMax, result.get(other.id)!.total);
      }
    }

    result.get(entry.id)!.total = groupMax;
  }

  return result;
}
