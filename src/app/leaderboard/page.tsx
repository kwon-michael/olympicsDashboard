"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { PageTransition } from "@/components/ui/page-transition";
import { SkeletonList } from "@/components/ui/skeleton";
import { SegmentedTabs, type TabItem } from "@/components/ui/segmented-tabs";
import { RankBadge } from "@/components/ui/rank-badge";
import { StandingsRow } from "@/components/leaderboard/standings-row";
import { EventChips } from "@/components/ui/event-chips";
import { cn, ordinal } from "@/lib/utils";
import {
  fetchRosterData,
  computePlayerStandings,
  activeTeamSizes,
  type RosterData,
} from "@/lib/roster";
import {
  fetchSoloResults,
  computeEventStandings,
  soloPriorityTeamIds,
} from "@/lib/solo";
import {
  computeStandings,
  EMPTY_STANDINGS,
  type ResolvedTeamStanding,
} from "@/lib/standings";
import { soloEvents, getScoringInputBySlug, getUnitLabel } from "@/lib/events";
import { readableTextColor } from "@/lib/colors";
import { fetchTugData, type TugData } from "@/lib/tug";
import { fetchDodgeballData, type DodgeballData } from "@/lib/dodgeball";
import { fetchTiebreaks, type Tiebreak } from "@/lib/tiebreak";
import { TugGroups } from "@/components/tug/tug-groups";
import { TugBracket } from "@/components/tug/tug-bracket";
import { TournamentGroups } from "@/components/tournament/tournament-groups";
import { TournamentBracket } from "@/components/tournament/tournament-bracket";
import type { SoloResult } from "@/lib/types";

type Tab = "teams" | "solo" | "events" | "players" | "tug" | "dodgeball";

const TABS = [
  { value: "teams", label: "Teams" },
  { value: "solo", label: "Solo" },
  { value: "events", label: "Events" },
  { value: "players", label: "Players" },
  { value: "tug", label: "Tug of War" },
  { value: "dodgeball", label: "Dodgeball" },
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
  const playerStandings = useMemo(
    () =>
      data
        ? computePlayerStandings(data.teams, data.players, data.scores)
        : [],
    [data]
  );
  const eventRows = useMemo(
    () =>
      data ? computeEventStandings(eventSlug, solo, data.teams, data.players) : [],
    [data, solo, eventSlug]
  );

  const totalPoints = teamStandings.reduce((sum, s) => sum + s.totalPoints, 0);
  const teamLead = Math.max(...teamStandings.map((s) => s.totalPoints), 1);
  const soloLead = Math.max(...soloStandings.map((s) => s.totalPoints), 1);

  return (
    <PageTransition>
      {/* Header */}
      <header className="bg-navy text-white">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="inline-flex items-center gap-2 text-[11px] font-medium tracking-[0.18em] text-white/55 uppercase">
              <span aria-hidden className="relative grid place-items-center">
                <span className="absolute h-1.5 w-1.5 rounded-full bg-success motion-safe:animate-ping" />
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
              </span>
              Live standings
            </p>
            <h1 className="font-display mt-4 text-4xl font-bold sm:text-5xl">
              Leaderboard
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/55">
              Rankings update the moment a result is recorded.
            </p>
          </div>

          {!loading && teamStandings.length > 0 && (
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
        <SegmentedTabs
          items={TABS}
          value={tab}
          onChange={setTab}
          label="Leaderboard views"
          className="mb-6"
        />

        {loading ? (
          <SkeletonList rows={6} />
        ) : tab === "teams" ? (
          teamStandings.some(
            (s) => s.scoreCount > 0 || s.bonusPoints > 0 || s.tournamentPoints > 0
          ) ? (
            <section>
              <Note>
                Team-event points, plus a{" "}
                <span className="font-medium text-gold">+1 bonus</span> for each
                of the top-3 solo teams. Tug of War and Dodgeball score
                themselves as they&rsquo;re played: 1 point per round won, 1 per
                dodgeball elimination, and 5/3/2/1 for finishing 1st–4th.
              </Note>
              <StandingsList>
                <AnimatePresence initial={false} mode="popLayout">
                  {teamStandings.map((s) => (
                    <StandingsRow
                      key={s.team.id}
                      // The solo-aware position, so the board reads 1..N even
                      // when several teams are level on points.
                      rank={s.position}
                      name={s.team.name}
                      color={s.team.color}
                      points={s.totalPoints}
                      pointsLabel="pts"
                      meta={teamMeta(s)}
                      note={
                        s.bonusPoints > 0
                          ? `+${s.bonusPoints} solo bonus`
                          : undefined
                      }
                      share={s.totalPoints / teamLead}
                      tiebreak={s.tiebreak}
                      levelOnPoints={s.levelOnPoints}
                      // Only worth naming when the team actually scored in the
                      // solo events; otherwise it explains nothing.
                      orderedBy={
                        s.levelOnPoints && !s.tiebreak && s.soloPoints > 0
                          ? `Solo ${ordinal(s.soloRank)}`
                          : undefined
                      }
                    />
                  ))}
                </AnimatePresence>
              </StandingsList>
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
                    team-event results separate them.
                  </span>
                </p>
              )}
              <TiebreakLegend
                board="teams"
                show={teamStandings.some((s) => s.tiebreak)}
              />
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
              <StandingsList>
                {soloStandings.map((s) => (
                  <StandingsRow
                    key={s.team.id}
                    rank={s.rank}
                    name={s.team.name}
                    color={s.team.color}
                    points={s.totalPoints}
                    pointsLabel="solo pts"
                    meta={`${s.eventsEntered} event${s.eventsEntered !== 1 ? "s" : ""}`}
                    note={s.isTop3 ? "Bonus + playoff priority" : undefined}
                    share={s.totalPoints / soloLead}
                    tiebreak={s.tiebreak}
                  />
                ))}
              </StandingsList>
              <TiebreakLegend
                board="solo"
                show={soloStandings.some((s) => s.tiebreak)}
              />
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
        ) : playerStandings.length > 0 ? (
          <TableCard>
            <thead>
              <tr className="border-b border-border">
                <Th className="w-16">Rank</Th>
                <Th>Player</Th>
                <Th>Team</Th>
                <Th align="right">Points</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {playerStandings.map((p) => (
                <tr
                  key={p.player.id}
                  className="transition-colors hover:bg-foreground/[0.02]"
                >
                  <td className="px-4 py-3">
                    <RankBadge rank={p.rank} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        aria-hidden
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[11px] font-bold"
                        style={{
                          backgroundColor: p.teamColor,
                          color: readableTextColor(p.teamColor),
                        }}
                      >
                        {p.player.name.charAt(0).toUpperCase()}
                      </span>
                      <span
                        className={cn(
                          "font-medium",
                          !p.player.is_active && "text-muted line-through"
                        )}
                      >
                        {p.player.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <TeamCell name={p.teamName} color={p.teamColor} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-[15px] font-semibold tabular-nums">
                    {p.totalPoints.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </TableCard>
        ) : (
          <EmptyState />
        )}
      </div>
    </PageTransition>
  );
}

/**
 * The sub-line under a team's name: how many scores it has, then what each
 * tournament has paid out so far. A tournament is named only once it's actually
 * worth something — every team appears in the match table the moment groups are
 * locked, so listing a run of zeroes would say nothing.
 */
function teamMeta(s: ResolvedTeamStanding): string {
  const parts = [`${s.scoreCount} score${s.scoreCount !== 1 ? "s" : ""}`];
  if (s.tug && s.tug.total > 0) parts.push(`Tug ${s.tug.total}`);
  if (s.dodgeball && s.dodgeball.total > 0)
    parts.push(`Dodgeball ${s.dodgeball.total}`);
  return parts.join(" · ");
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
 * Explains the TB pill when any row on the board carries one. The point is to
 * make clear the standings themselves haven't been altered — the teams really
 * are level, and only the listed order came from elsewhere.
 */
function TiebreakLegend({
  show,
  board,
}: {
  show: boolean;
  board: "teams" | "solo";
}) {
  if (!show) return null;
  return (
    <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-muted">
      <span className="mt-px shrink-0 rounded-full border border-info/40 bg-info/10 px-1.5 py-px text-[10px] font-semibold tracking-wide text-info uppercase">
        TB
      </span>
      <span>
        These teams are level on points — the totals shown are unchanged. Their
        order was decided by a tiebreaker game played outside the app
        {board === "solo"
          ? ", and only the settled top 3 earn the +1 team-event point and playoff priority."
          : "."}
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

/** The shared surface for standings rows: one card, hairline-divided rows. */
function StandingsList({ children }: { children: React.ReactNode }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
      {children}
    </ul>
  );
}

function TableCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">{children}</table>
      </div>
    </div>
  );
}

function Th({
  children,
  align = "left",
  className,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "px-4 py-3 text-[11px] font-semibold tracking-wider text-muted uppercase",
        align === "right" ? "text-right" : "text-left",
        className
      )}
    >
      {children}
    </th>
  );
}

/** Team name preceded by its colour — the colour is the team's identity here. */
function TeamCell({ name, color }: { name: string; color: string }) {
  return (
    <span className="flex items-center gap-2">
      <span
        aria-hidden
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="truncate font-medium">{name}</span>
    </span>
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
