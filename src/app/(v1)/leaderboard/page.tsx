"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageTransition } from "@/components/ui/page-transition";
import { SkeletonList } from "@/components/ui/skeleton";
import { SegmentedTabs, type TabItem } from "@/components/ui/segmented-tabs";
import { RankBadge } from "@/components/ui/rank-badge";
import { TableCard, Th, TeamCell } from "@/components/leaderboard/table-card";
import {
  LeaderboardHiddenNotice,
  LeaderboardHiddenBanner,
} from "@/components/leaderboard/hidden-notice";
import { TeamEventBoard } from "@/components/leaderboard/team-event-board";
import { EventChips } from "@/components/ui/event-chips";
import { cn, ordinal } from "@/lib/utils";
import { fetchRosterData, activeTeamSizes, type RosterData } from "@/lib/roster";
import {
  fetchSoloResults,
  computeEventStandings,
  soloPriorityTeamIds,
} from "@/lib/solo";
import { computeStandings, EMPTY_STANDINGS } from "@/lib/standings";
import {
  recorderTeamEvents,
  computeTeamEventStandings,
  type TeamEventRow,
} from "@/lib/teamEvents";
import {
  soloEvents,
  getScoringInputBySlug,
  getUnitLabel,
  type EventRule,
} from "@/lib/events";
import { fetchTugData, type TugData } from "@/lib/tug";
import { fetchDodgeballData, type DodgeballData } from "@/lib/dodgeball";
import { fetchTiebreaks, type Tiebreak } from "@/lib/tiebreak";
import { useLeaderboardVisibility } from "@/lib/useLeaderboardVisibility";
import { TugGroups } from "@/components/tug/tug-groups";
import { TugBracket } from "@/components/tug/tug-bracket";
import { TournamentGroups } from "@/components/tournament/tournament-groups";
import { TournamentBracket } from "@/components/tournament/tournament-bracket";
import type { SoloResult } from "@/lib/types";

type Tab =
  | "teams"
  | "solo"
  | "events"
  | "tug"
  | "dodgeball"
  | "tail-grab"
  | "conditioned-relay";

// The four team games sit in the order they're played on the day (see
// TEAM_EVENT_DAY_ORDER). Tug of War and Dodgeball draw brackets; Tail Grab and
// the Relay are a single recorded result per team, so they get a breakdown
// board instead.
const TABS = [
  { value: "teams", label: "Teams" },
  { value: "solo", label: "Solo" },
  { value: "events", label: "Events" },
  { value: "tug", label: "Tug of War" },
  { value: "dodgeball", label: "Dodgeball" },
  { value: "tail-grab", label: "Tail Grab" },
  { value: "conditioned-relay", label: "Relay" },
] as const satisfies readonly TabItem<Tab>[];

function initialTab(): Tab {
  if (typeof window !== "undefined") {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t && TABS.some((tab) => tab.value === t)) return t as Tab;
  }
  return "teams";
}

export default function LeaderboardPage() {
  const [data, setData] = useState<RosterData | null>(null);
  const [solo, setSolo] = useState<SoloResult[]>([]);
  const [tug, setTug] = useState<TugData | null>(null);
  const [dodge, setDodge] = useState<DodgeballData | null>(null);
  const [tiebreaks, setTiebreaks] = useState<Tiebreak[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [eventSlug, setEventSlug] = useState<string>(soloEvents[0].slug);
  // The admin switch that takes the standings off the public site. Admins keep
  // seeing the real board (with a banner saying so); everyone else gets the
  // hidden notice in place of every tab on this page.
  const visibility = useLeaderboardVisibility();

  const load = useCallback(async () => {
    const supabase = createClient();
    const [roster, soloResults, tugData, dodgeData, tiebreakRows] =
      await Promise.all([
        fetchRosterData(supabase),
        fetchSoloResults(supabase),
        fetchTugData(supabase),
        fetchDodgeballData(supabase),
        fetchTiebreaks(supabase),
      ]);
    setData(roster);
    setSolo(soloResults);
    setTug(tugData);
    setDodge(dodgeData);
    setTiebreaks(tiebreakRows);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener("scores-updated", handler);
    return () => window.removeEventListener("scores-updated", handler);
  }, [load]);

  // Both boards come out of the shared pipeline: solo tiebreaks are applied,
  // the top 3 is settled from those places, the bonus follows, and the two
  // tournaments are scored into the team totals. See src/lib/standings.ts for
  // why the order matters.
  const { solo: soloStandings, teams: teamStandings } = useMemo(
    () =>
      data
        ? computeStandings(data.teams, data.scores, solo, tiebreaks, {
            tug: tug?.matches,
            dodgeball: dodge?.matches,
            teamSizes: activeTeamSizes(data.players),
          })
        : EMPTY_STANDINGS,
    [data, solo, tiebreaks, tug, dodge]
  );
  // Only used to order teams left level on round wins inside a group, matching
  // how the wildcard is drawn.
  const priorityTeamIds = useMemo(
    () => soloPriorityTeamIds(soloStandings),
    [soloStandings]
  );
  // slug → per-event board for Tail Grab and the Relay, read back out of the
  // roster_scores rows the team-event recorder writes.
  const teamEventRows = useMemo(() => {
    const bySlug = new Map<string, TeamEventRow[]>();
    if (!data) return bySlug;
    for (const event of recorderTeamEvents) {
      bySlug.set(
        event.slug,
        computeTeamEventStandings(event, data.teams, data.scores)
      );
    }
    return bySlug;
  }, [data]);
  const eventRows = useMemo(
    () =>
      data ? computeEventStandings(eventSlug, solo, data.teams, data.players) : [],
    [data, solo, eventSlug]
  );

  const totalPoints = teamStandings.reduce((sum, s) => sum + s.totalPoints, 0);

  // Nothing renders until *both* the data and the switch have resolved —
  // drawing the board first and hiding it a moment later would flash exactly
  // what the switch exists to hide.
  const busy = loading || visibility.loading;
  const showBoard = !busy && visibility.canView;

  return (
    <PageTransition>
      {/* Header */}
      <header className="bg-navy text-white">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="text-center">
            {showBoard || busy ? (
              <p className="inline-flex items-center gap-2 text-[11px] font-medium tracking-[0.18em] text-white/55 uppercase">
                <span aria-hidden className="relative grid place-items-center">
                  <span className="absolute h-1.5 w-1.5 rounded-full bg-success motion-safe:animate-ping" />
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                </span>
                Live standings
              </p>
            ) : (
              <p className="inline-flex items-center gap-2 text-[11px] font-medium tracking-[0.18em] text-white/55 uppercase">
                <EyeOff aria-hidden className="h-3 w-3" />
                Standings hidden
              </p>
            )}
            <h1 className="font-display mt-4 text-4xl font-bold sm:text-5xl">
              Leaderboard
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/55">
              {showBoard || busy
                ? "Rankings update the moment a result is recorded."
                : "Results are still being recorded — the standings are under wraps for now."}
            </p>
          </div>

          {/* The stat strip is part of the standings: it gives away the running
              team-point total, so it goes when the board does. */}
          {showBoard && teamStandings.length > 0 && (
            <dl className="mt-10 grid grid-cols-3 divide-x divide-white/10">
              <HeaderStat value={teamStandings.length} label="Teams" />
              <HeaderStat value={totalPoints} label="Team points" accent />
              <HeaderStat value={solo.length} label="Solo results" />
            </dl>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {busy ? (
          <SkeletonList rows={6} />
        ) : !visibility.canView ? (
          <LeaderboardHiddenNotice />
        ) : (
          <>
            {visibility.isAdminPreview && (
              <LeaderboardHiddenBanner className="mb-6" />
            )}
            <SegmentedTabs
              items={TABS}
              value={tab}
              onChange={setTab}
              label="Leaderboard views"
              className="mb-6"
            />

            {tab === "teams" ? (
              teamStandings.some(
                (s) => s.scoreCount > 0 || s.bonusPoints > 0 || s.tournamentPoints > 0
              ) ? (
                <section>
                  <Note>
                    Team-event points, plus a{" "}
                    <span className="font-medium text-gold">+1 bonus</span> for each
                    of the top-3 solo teams. Tug of War and Dodgeball score
                    themselves as they&rsquo;re played: 1 point per round won, 1 per
                    dodgeball elimination in the group stage, and 5/3/2/1 for
                    finishing 1st–4th.
                  </Note>
                  <TableCard>
                    <thead>
                      <tr className="border-b border-border">
                        <Th className="w-16">Place</Th>
                        <Th>Team</Th>
                        <Th align="right" className="w-20">
                          Pts
                        </Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {teamStandings.map((s) => (
                        <tr
                          key={s.team.id}
                          className="transition-colors hover:bg-foreground/[0.02]"
                        >
                          <td className="px-4 py-3">
                            {/* The solo-aware position, so the board reads 1..N
                                even when several teams are level on points. */}
                            <RankBadge rank={s.position} />
                          </td>
                          <td className="px-4 py-3">
                            <TeamCell name={s.team.name} color={s.team.color} />
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-[15px] font-semibold tabular-nums">
                            {s.levelOnPoints && (
                              <span
                                title="Level on points with at least one other team"
                                className="mr-1.5 font-medium text-muted/70"
                              >
                                <span aria-hidden>=</span>
                                <span className="sr-only">Level on points —</span>
                              </span>
                            )}
                            {s.totalPoints}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </TableCard>
                  {teamStandings.some((s) => s.levelOnPoints) && (
                    <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-muted">
                      <span
                        aria-hidden
                        className="mt-px shrink-0 font-mono text-base leading-none text-muted/70"
                      >
                        =
                      </span>
                      <span>
                        Level on points. Places are ordered by the solo events until
                        team-event results separate them — the team board is never
                        settled by a tiebreaker game.
                      </span>
                    </p>
                  )}
                </section>
              ) : (
                <EmptyState />
              )
            ) : tab === "solo" ? (
              soloStandings.some((s) => s.totalPoints > 0) ? (
                <section>
                  <Note>
                    Placement points across all {soloEvents.length} solo events (1st
                    = 7, 2nd = 5, 3rd = 3, 4th = 2, 5th = 1). The top 3 teams each
                    earn a{" "}
                    <span className="font-medium text-gold">
                      +1 team-event point
                    </span>{" "}
                    and playoff priority.
                  </Note>
                  <TableCard>
                    <thead>
                      <tr className="border-b border-border">
                        <Th className="w-16">Place</Th>
                        <Th>Team</Th>
                        <Th align="right">Events</Th>
                        <Th align="right" className="w-20">
                          Pts
                        </Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {soloStandings.map((s) => (
                        <tr
                          key={s.team.id}
                          className="transition-colors hover:bg-foreground/[0.02]"
                        >
                          <td className="px-4 py-3">
                            <RankBadge rank={s.rank} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <TeamCell name={s.team.name} color={s.team.color} />
                              {/* The two things that make a solo place matter, kept
                                  beside the name rather than in columns of their
                                  own — they apply to three rows out of nine. */}
                              {s.isTop3 && (
                                <span
                                  title="Top 3 — earns the +1 team-event point and playoff priority"
                                  className="shrink-0 rounded-full border border-gold/40 bg-gold/10 px-1.5 py-px text-[10px] font-semibold tracking-wide text-gold uppercase"
                                >
                                  Bonus
                                </span>
                              )}
                              {s.tiebreak && (
                                <span
                                  title={`Tied on points — placed ${ordinal(s.tiebreak.position)} of ${s.tiebreak.of} in a tiebreaker game`}
                                  className="shrink-0 rounded-full border border-info/40 bg-info/10 px-1.5 py-px text-[10px] font-semibold tracking-wide text-info uppercase"
                                >
                                  TB {s.tiebreak.position}/{s.tiebreak.of}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums text-muted">
                            {s.eventsEntered}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-[15px] font-semibold tabular-nums">
                            {s.totalPoints}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </TableCard>
                  <TiebreakLegend show={soloStandings.some((s) => s.tiebreak)} />
                </section>
              ) : (
                <EmptyState label="No solo results yet" />
              )
            ) : tab === "events" ? (
              <section>
                <EventChips
                  events={soloEvents}
                  value={eventSlug}
                  onChange={setEventSlug}
                  label="Solo event"
                  className="mb-5"
                />

                {eventRows.length > 0 ? (
                  <TableCard>
                    <thead>
                      <tr className="border-b border-border">
                        <Th className="w-16">Place</Th>
                        <Th>Team</Th>
                        <Th>Participant</Th>
                        <Th align="right">
                          {getUnitLabel(getScoringInputBySlug(eventSlug))}
                        </Th>
                        <Th align="right" className="w-16">
                          Pts
                        </Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {eventRows.map((row) => (
                        <tr
                          key={row.team.id}
                          className="transition-colors hover:bg-foreground/[0.02]"
                        >
                          <td className="px-4 py-3">
                            <RankBadge rank={row.rank} />
                          </td>
                          <td className="px-4 py-3">
                            <TeamCell
                              name={row.team.name}
                              color={row.team.color}
                            />
                          </td>
                          <td className="px-4 py-3 text-muted">
                            {row.playerName ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums">
                            {row.display}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-[15px] font-semibold tabular-nums">
                            {row.points}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </TableCard>
                ) : (
                  <EmptyState
                    label="Nothing recorded yet"
                    hint="This event's results will show up here once they're in."
                  />
                )}
              </section>
            ) : tab === "tug" ? (
              <BracketTab
                locked={tug?.state?.groups_locked ?? false}
                hasData={!!tug}
                notStarted="Groups are decided once the solo events wrap up."
                groups={
                  <TugGroups
                    teams={data?.teams ?? []}
                    tug={tug!}
                    priorityTeamIds={priorityTeamIds}
                  />
                }
                bracket={<TugBracket teams={data?.teams ?? []} tug={tug!} />}
              />
            ) : tab === "dodgeball" ? (
              <BracketTab
                locked={dodge?.state?.groups_locked ?? false}
                hasData={!!dodge}
                notStarted="Groups are decided once Tug of War wraps up."
                groups={
                  <TournamentGroups
                    teams={data?.teams ?? []}
                    data={dodge!}
                    priorityTeamIds={priorityTeamIds}
                  />
                }
                bracket={<TournamentBracket teams={data?.teams ?? []} data={dodge!} />}
              />
            ) : (
              <TeamEventTab
                event={recorderTeamEvents.find((e) => e.slug === tab)}
                rows={teamEventRows.get(tab) ?? []}
              />
            )}
          </>
        )}
      </div>
    </PageTransition>
  );
}

function HeaderStat({
  value,
  label,
  accent,
}: {
  value: number;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="px-2 text-center">
      <dd
        className={cn(
          "font-mono text-2xl font-semibold tabular-nums sm:text-3xl",
          accent ? "text-gold" : "text-white"
        )}
      >
        {value.toLocaleString()}
      </dd>
      <dt className="mt-1.5 text-[11px] tracking-wider text-white/45 uppercase">
        {label}
      </dt>
    </div>
  );
}

/**
 * Explains the TB pill when any solo row carries one. The point is to make clear
 * the standings themselves haven't been altered — the teams really are level,
 * and only the listed order came from elsewhere. Solo-only: the team board is
 * never played off, so no row there can carry a pill.
 */
function TiebreakLegend({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-muted">
      <span className="mt-px shrink-0 rounded-full border border-info/40 bg-info/10 px-1.5 py-px text-[10px] font-semibold tracking-wide text-info uppercase">
        TB
      </span>
      <span>
        These teams are level on points — the totals shown are unchanged. Their
        order was decided by a tiebreaker game played outside the app, and only
        the settled top 3 earn the +1 team-event point and playoff priority.
      </span>
    </p>
  );
}

/** A short explanatory line above a standings list. */
function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 border-l-2 border-border pl-3 text-xs leading-relaxed text-muted">
      {children}
    </p>
  );
}

/**
 * Tail Grab and the Conditional Relay. Both are scored from a single recorded
 * result per team rather than a bracket, so the tab is the event's own scoring
 * rule plus a board showing how each team's points were made up.
 */
function TeamEventTab({
  event,
  rows,
}: {
  event: EventRule | undefined;
  rows: TeamEventRow[];
}) {
  if (!event) return <EmptyState />;
  if (rows.length === 0) {
    return (
      <EmptyState
        label="Not played yet"
        hint={`${event.name} results show up here as soon as they're recorded.`}
      />
    );
  }
  return (
    <section>
      {event.scoring && <Note>{event.scoring}</Note>}
      <TeamEventBoard event={event} rows={rows} />
      <p className="mt-4 text-xs leading-relaxed text-muted">
        These points are already part of each team&rsquo;s total on the Teams
        board.
      </p>
    </section>
  );
}

function BracketTab({
  locked,
  hasData,
  notStarted,
  groups,
  bracket,
}: {
  locked: boolean;
  hasData: boolean;
  notStarted: string;
  groups: React.ReactNode;
  bracket: React.ReactNode;
}) {
  if (!locked || !hasData) {
    return <EmptyState label="Not started yet" hint={notStarted} />;
  }
  return (
    <div className="space-y-10">
      <section>
        <h2 className="font-display mb-4 text-base font-semibold">
          Group stage
        </h2>
        {groups}
      </section>
      <section>
        <h2 className="font-display mb-4 text-base font-semibold">
          Playoff bracket
        </h2>
        {bracket}
      </section>
    </div>
  );
}

function EmptyState({ label, hint }: { label?: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center">
      <p className="font-display text-base font-semibold text-foreground">
        {label ?? "No scores yet"}
      </p>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
        {hint ?? "Standings fill in here as results are recorded."}
      </p>
    </div>
  );
}
