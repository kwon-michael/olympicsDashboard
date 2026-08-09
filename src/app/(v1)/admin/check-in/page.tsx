"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Search,
  UserCheck,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageTransition } from "@/components/ui/page-transition";
import { SkeletonList } from "@/components/ui/skeleton";
import { EventChips } from "@/components/ui/event-chips";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { AttendancePenalties } from "@/components/admin/attendance-penalties";
import { useAppStore } from "@/lib/store";
import { logAudit } from "@/lib/audit";
import { fetchRosterData, type RosterData } from "@/lib/roster";
import {
  buildCheckInEntries,
  fetchCheckins,
  filterCheckInEntries,
  groupCheckInsByTeam,
  tallyCheckIns,
  tallyCheckInsByTeam,
  type CheckInEntry,
  type CheckInStatus,
} from "@/lib/checkin";
import type { RosterCheckin } from "@/lib/types";

/** "9:04 AM" — the desk only ever cares about the time of day. */
function arrivalTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * The registration desk. Both admins and volunteers work this page, on a phone,
 * usually with a queue in front of them — so the whole thing is one tap per
 * person, and tapping again undoes it.
 */
export default function AdminCheckInPage() {
  const [data, setData] = useState<RosterData | null>(null);
  const [checkins, setCheckins] = useState<RosterCheckin[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);
  // Players with a tap still in flight, so a double-tap can't race itself.
  const [pending, setPending] = useState<Set<string>>(new Set());

  const [teamId, setTeamId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<CheckInStatus>("all");

  // Deciding what absence costs is an admin call, so the penalty sweep is
  // hidden from volunteers — and from an admin previewing their view, which is
  // the whole point of that preview. The database enforces the same rule
  // independently (see migrate_admin_only_deductions.sql).
  const user = useAppStore((s) => s.user);
  const viewAsVolunteer = useAppStore((s) => s.viewAsVolunteer);
  const canDeduct = user?.role === "admin" && !viewAsVolunteer;

  const load = useCallback(async () => {
    const supabase = createClient();
    try {
      const [roster, rows] = await Promise.all([
        fetchRosterData(supabase),
        fetchCheckins(supabase),
      ]);
      setData(roster);
      setCheckins(rows);
      setLoadError(null);
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : "Could not load the check-in list."
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // The door is usually worked by more than one person at once. Without this
  // each phone shows a stale list and they re-tap names the other already did.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("roster-checkins")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "roster_checkins" },
        async () => {
          try {
            setCheckins(await fetchCheckins(supabase));
          } catch {
            // A dropped refetch just means this phone stays on what it has;
            // the next event (or a reload) picks the truth back up.
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const entries = useMemo(
    () =>
      buildCheckInEntries(data?.teams ?? [], data?.players ?? [], checkins),
    [data, checkins]
  );

  // Progress is scoped to the selected team only — deliberately not to the
  // search box or the status tab, so the meter doesn't leap around while
  // someone types a name.
  const teamScope = useMemo(
    () => filterCheckInEntries(entries, { teamId }),
    [entries, teamId]
  );
  const progress = tallyCheckIns(teamScope);
  const percent =
    progress.total === 0 ? 0 : (progress.arrived / progress.total) * 100;

  // The status tabs count what you'd actually see after clicking them, so they
  // do follow the search box.
  const searchScope = useMemo(
    () => filterCheckInEntries(entries, { teamId, query }),
    [entries, teamId, query]
  );
  const searchTally = tallyCheckIns(searchScope);

  const visible = useMemo(
    () => filterCheckInEntries(searchScope, { status }),
    [searchScope, status]
  );
  const groups = useMemo(() => groupCheckInsByTeam(visible), [visible]);
  // Team headers show the team's real standing, not the filtered slice.
  const teamTallies = useMemo(() => tallyCheckInsByTeam(entries), [entries]);

  const teamChips = useMemo(
    () => [
      { slug: "", name: "All teams", color: "#E94560" },
      ...(data?.teams ?? []).map((t) => ({
        slug: t.id,
        name: t.name,
        color: t.color,
      })),
    ],
    [data]
  );

  async function toggle(entry: CheckInEntry) {
    const id = entry.player.id;
    if (pending.has(id)) return;
    const wasArrived = entry.checkedInAt !== null;
    const original = checkins.find((c) => c.player_id === id) ?? null;

    setPending((prev) => new Set(prev).add(id));
    setWriteError(null);

    // Show the result immediately — the queue moves faster than the round trip.
    const at = new Date().toISOString();
    const others = (rows: RosterCheckin[]) =>
      rows.filter((c) => c.player_id !== id);
    setCheckins((prev) =>
      wasArrived
        ? others(prev)
        : [...others(prev), { player_id: id, checked_in_at: at, checked_in_by: null }]
    );

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Checking out can come back having matched no row when another volunteer
    // got there first. That's not a failure — reads and writes sit behind the
    // same RLS predicate, so a row this phone could see is a row it could
    // delete, and the end state is the one we wanted either way.
    const { error } = wasArrived
      ? await supabase.from("roster_checkins").delete().eq("player_id", id)
      : await supabase.from("roster_checkins").upsert(
          { player_id: id, checked_in_at: at, checked_in_by: user?.id ?? null },
          { onConflict: "player_id" }
        );

    if (error) {
      // Put the row back the way it was rather than leaving the desk looking at
      // a check mark the database never accepted.
      setCheckins((prev) =>
        wasArrived && original ? [...others(prev), original] : others(prev)
      );
      setWriteError(
        `Couldn't check ${entry.player.name} ${wasArrived ? "out" : "in"} — ${error.message}`
      );
    } else {
      // Not revertible from the Activity Logs page (the table is keyed by
      // player_id, and undoing a check-in is one tap here anyway) — this is a
      // record of who was on the door, not something to roll back.
      await logAudit(
        supabase,
        wasArrived ? "delete" : "create",
        "player_checkin",
        id,
        { player: entry.player.name, team: entry.team.name }
      );
    }

    setPending((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  return (
    <PageTransition className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Admin
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
          <UserCheck className="w-6 h-6 text-success" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            CHECK-IN
          </h1>
          <p className="text-sm text-muted">
            Tap a name as they arrive. Tap it again to undo.
          </p>
        </div>
      </div>

      {loadError ? (
        <div className="rounded-xl border border-danger/30 bg-danger/5 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-danger">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Couldn&apos;t load the check-in list
          </p>
          <p className="mt-1 text-xs text-muted">{loadError}</p>
          <button
            onClick={() => {
              setLoading(true);
              load();
            }}
            className="mt-3 text-xs font-semibold text-coral hover:underline"
          >
            Try again
          </button>
        </div>
      ) : loading ? (
        <SkeletonList rows={8} />
      ) : (
        <>
          {canDeduct && (
            <AttendancePenalties
              entries={entries}
              scores={data?.scores ?? []}
              onChanged={load}
            />
          )}

          {/* Filters and progress stay put while the list scrolls — on a phone
              the desk needs the search box within reach at all times. The
              offset clears the sticky navbar. */}
          <div className="sticky top-16 z-20 -mx-4 mb-4 space-y-3 border-b border-border bg-background/95 px-4 pt-1 pb-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-display text-lg font-bold text-foreground">
                  {progress.arrived}
                  <span className="text-muted"> / {progress.total} arrived</span>
                </p>
                <p className="text-xs text-muted">
                  {progress.total - progress.arrived} still to come
                </p>
              </div>
              <div
                className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-foreground/10"
                role="progressbar"
                aria-valuenow={progress.arrived}
                aria-valuemin={0}
                aria-valuemax={progress.total}
                aria-label="Players checked in"
              >
                <div
                  className="h-full rounded-full bg-success transition-[width] duration-300"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search a name…"
                aria-label="Search a name"
                autoComplete="off"
                className="w-full rounded-xl border border-border bg-card py-2.5 pr-9 pl-9 text-sm text-foreground transition-colors placeholder:text-muted focus:border-coral focus:ring-2 focus:ring-coral/30 focus:outline-none"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-muted transition-colors hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <EventChips
              events={teamChips}
              value={teamId ?? ""}
              onChange={(slug) => setTeamId(slug || null)}
              label="Filter by team"
            />

            <SegmentedTabs
              items={[
                { value: "all", label: `All ${searchScope.length}` },
                {
                  value: "waiting",
                  label: `Waiting ${searchTally.total - searchTally.arrived}`,
                },
                { value: "arrived", label: `Arrived ${searchTally.arrived}` },
              ]}
              value={status}
              onChange={setStatus}
              label="Filter by arrival"
            />
          </div>

          {writeError && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/5 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
              <p className="flex-1 text-xs text-danger">{writeError}</p>
              <button
                onClick={() => setWriteError(null)}
                aria-label="Dismiss"
                className="text-danger/70 transition-colors hover:text-danger"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {groups.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted">
              {query
                ? `Nobody matching “${query.trim()}”.`
                : status === "waiting"
                  ? "Everyone here is checked in."
                  : status === "arrived"
                    ? "Nobody has checked in yet."
                    : "No players on the roster yet."}
            </p>
          ) : (
            <div className="space-y-4">
              {groups.map((group) => {
                const tally = teamTallies.get(group.team.id);
                const complete = tally && tally.arrived === tally.total;
                return (
                  <section
                    key={group.team.id}
                    className="overflow-hidden rounded-2xl border border-border bg-card"
                  >
                    <div
                      className="flex items-center gap-2 px-4 py-2.5"
                      style={{ backgroundColor: group.team.color + "15" }}
                    >
                      <span
                        aria-hidden
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: group.team.color }}
                      />
                      <h2 className="font-display font-bold text-foreground">
                        {group.team.name}
                      </h2>
                      <span
                        className={`ml-auto text-xs font-semibold ${
                          complete ? "text-success" : "text-muted"
                        }`}
                      >
                        {tally?.arrived ?? 0} / {tally?.total ?? 0}
                      </span>
                    </div>

                    <ul className="divide-y divide-border">
                      {group.entries.map((entry) => {
                        const arrived = entry.checkedInAt !== null;
                        const busy = pending.has(entry.player.id);
                        return (
                          <li key={entry.player.id}>
                            <button
                              onClick={() => toggle(entry)}
                              disabled={busy}
                              aria-pressed={arrived}
                              aria-label={
                                arrived
                                  ? `${entry.player.name} is checked in — tap to undo`
                                  : `Check in ${entry.player.name}`
                              }
                              className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors disabled:opacity-60 ${
                                arrived
                                  ? "bg-success/[0.07] hover:bg-success/[0.12]"
                                  : "hover:bg-background"
                              }`}
                            >
                              <span
                                aria-hidden
                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                                  arrived
                                    ? "border-success bg-success text-white"
                                    : "border-border"
                                }`}
                              >
                                {arrived && <Check className="h-4 w-4" />}
                              </span>

                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[15px] font-medium text-foreground">
                                  {entry.player.name}
                                </span>
                                {!entry.player.is_active && (
                                  <span className="text-[11px] text-warning">
                                    crossed out — checked in anyway
                                  </span>
                                )}
                              </span>

                              <span
                                className={`shrink-0 text-xs whitespace-nowrap ${
                                  arrived
                                    ? "font-semibold text-success"
                                    : "text-muted"
                                }`}
                              >
                                {arrived
                                  ? arrivalTime(entry.checkedInAt!)
                                  : "Not here"}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}
    </PageTransition>
  );
}
