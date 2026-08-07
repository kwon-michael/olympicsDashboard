"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Swords,
  CircleDot,
  Lock,
  RotateCcw,
  Shuffle,
  Trophy,
  Check,
  AlertTriangle,
  Star,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { PostgrestError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { PageTransition } from "@/components/ui/page-transition";
import { SkeletonList } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { LockGroupsDialog } from "@/components/admin/lock-groups-dialog";
import { MatchResultPicker } from "@/components/admin/match-result-picker";
import { logAudit } from "@/lib/audit";
import { fetchRosterData, activeTeamSizes, type RosterData } from "@/lib/roster";
import {
  fetchTournamentData,
  assignGroupsInterleaved,
  assignGroupsSnake,
  groupRoundRobin,
  computeGroupStandings,
  computeQualifiers,
  groupStageComplete,
  resolvedWildcard,
  resolvedQualifiers,
  bracketMatches,
  loserOf,
  GROUP_LABELS,
  type TournamentTables,
  type TournamentData,
  type TournamentMatch,
  type GroupAssignment,
  type Qualifiers,
  type GroupTeamStanding,
  type SeedStanding,
} from "@/lib/tournament";
import { TUG_TABLES } from "@/lib/tug";
import { DODGEBALL_TABLES } from "@/lib/dodgeball";
import {
  fetchSoloResults,
  soloPriorityTeamIds,
  soloEventsIncomplete,
  type SoloEventCoverage,
} from "@/lib/solo";
import { computeStandings, EMPTY_STANDINGS } from "@/lib/standings";
import { fetchTiebreaks, type Tiebreak } from "@/lib/tiebreak";
import type { RosterTeam, SoloResult } from "@/lib/types";

// ============================================
// Shared tournament admin
// ============================================
// Tug of War and Dodgeball are the same tournament run twice, so they're the
// same screen run twice — one component, two configurations. They used to be two
// near-identical 800-line pages, which is how Dodgeball drifted: a fix or a
// safeguard landing in one didn't reach the other.
//
// New rows deliberately omit the optional columns (survivors_a / survivors_b):
// they're nullable and default to NULL, so leaving them out keeps the
// group-generation insert working whether or not the survivors migration has
// been applied.

const EPOCH = "1970-01-01";

/** Kept as whole class names so Tailwind can see them. */
const ACCENTS = {
  indigo: { tile: "bg-indigo-500/10", icon: "text-indigo-500" },
  orange: { tile: "bg-orange-500/10", icon: "text-orange-500" },
} as const;

export type TournamentId = "tug" | "dodgeball";

interface TournamentConfig {
  name: string;
  heading: string;
  subtitle: string;
  icon: LucideIcon;
  accent: keyof typeof ACCENTS;
  tables: TournamentTables;
  /** Prefix for audit entity types: `<prefix>_tournament` / `<prefix>_match`. */
  auditEntity: string;
  /**
   * Which board the groups are drawn from. Tug of War is seeded purely on the
   * solo points leaderboard — it is the first team event, so there is nothing
   * else to seed on and the solo results are what earned the seeding. Dodgeball
   * runs afterwards and seeds on the full team board, which by then includes the
   * Tug of War points.
   */
  seedFrom: "solo" | "team";
  assignGroups: (standings: SeedStanding[]) => GroupAssignment[];
  /** One-line seeding description, shown on the lock card and in the dialog. */
  seedingRule: string;
  /** Heading over the pre-lock standings list. */
  standingsHeading: string;
  /** Unit shown against each team's total on the lock card. */
  pointsLabel: string;
  /** Dodgeball scores a point per elimination; Tug of War has no equivalent. */
  eliminations: boolean;
}

const TOURNAMENTS: Record<TournamentId, TournamentConfig> = {
  tug: {
    name: "Tug of War",
    heading: "TUG OF WAR",
    subtitle:
      "Lock groups from the solo leaderboard, record round wins, then seed the playoff bracket",
    icon: Swords,
    accent: "indigo",
    tables: TUG_TABLES,
    auditEntity: "tug",
    seedFrom: "solo",
    assignGroups: assignGroupsInterleaved,
    seedingRule:
      "by solo rank — {1,4,7} → A, {2,5,8} → B, {3,6,9} → C.",
    standingsHeading: "SOLO POINTS LEADERBOARD",
    pointsLabel: "solo pts",
    eliminations: false,
  },
  dodgeball: {
    name: "Dodgeball",
    heading: "DODGEBALL",
    subtitle:
      "Lock groups from the standings, record round wins and eliminations, then seed the playoff bracket",
    icon: CircleDot,
    accent: "orange",
    tables: DODGEBALL_TABLES,
    auditEntity: "dodgeball",
    seedFrom: "team",
    assignGroups: assignGroupsSnake,
    seedingRule: "by rank (snake) — {1,6,7} → A, {2,5,8} → B, {3,4,9} → C.",
    standingsHeading: "TEAM STANDINGS",
    pointsLabel: "pts",
    eliminations: true,
  },
};

/** The columns a newly generated match row carries. */
type NewMatch = Omit<
  TournamentMatch,
  "id" | "created_at" | "updated_at" | "survivors_a" | "survivors_b"
>;

/** The round-robin matches for a locked set of group members. */
function groupMatchRows(
  members: { team_id: string; group_label: string; seed: number }[]
): NewMatch[] {
  const rows: NewMatch[] = [];
  for (const label of GROUP_LABELS) {
    const ids = members
      .filter((m) => m.group_label === label)
      .sort((a, b) => a.seed - b.seed)
      .map((m) => m.team_id);
    groupRoundRobin(ids).forEach(([team_a, team_b], slot) => {
      rows.push({
        stage: "group",
        group_label: label,
        slot,
        team_a,
        team_b,
        score_a: null,
        score_b: null,
        winner_id: null,
        is_tiebreaker: false,
      });
    });
  }
  return rows;
}

export function TournamentAdmin({ id }: { id: TournamentId }) {
  const config = TOURNAMENTS[id];
  const {
    name,
    tables,
    auditEntity,
    assignGroups,
    eliminations,
    accent,
    icon: Icon,
  } = config;

  const [roster, setRoster] = useState<RosterData | null>(null);
  // Both tournaments are loaded on either screen: their points are part of the
  // team standings Dodgeball is seeded from, so the numbers here have to be the
  // ones on the leaderboard. (Tug of War seeds off the solo board instead, which
  // no tournament result can move — see `seedFrom`.)
  const [tug, setTug] = useState<TournamentData | null>(null);
  const [dodge, setDodge] = useState<TournamentData | null>(null);
  const [solo, setSolo] = useState<SoloResult[]>([]);
  const [tiebreaks, setTiebreaks] = useState<Tiebreak[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmLock, setConfirmLock] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [r, t, d, s, tb] = await Promise.all([
      fetchRosterData(supabase),
      fetchTournamentData(supabase, TUG_TABLES),
      fetchTournamentData(supabase, DODGEBALL_TABLES),
      fetchSoloResults(supabase),
      fetchTiebreaks(supabase),
    ]);
    setRoster(r);
    setTug(t);
    setDodge(d);
    setSolo(s);
    setTiebreaks(tb);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const data = id === "tug" ? tug : dodge;

  const teams = useMemo(() => roster?.teams ?? [], [roster]);
  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  // Dodgeball counts eliminations by subtracting survivors from the team's size,
  // so the recorder needs it too — it's what decides how many survivor buttons a
  // team's row offers.
  const teamSizes = useMemo(
    () => activeTeamSizes(roster?.players ?? []),
    [roster]
  );

  /**
   * Reports a failed write instead of letting it vanish.
   *
   * Both halves matter. An `error` catches a rejected insert or a missing
   * column; an empty `rows` catches the quieter case — row-level security
   * silently matching nothing, which Postgrest reports as a perfectly
   * successful update of zero rows. That is exactly what a volunteer used to
   * hit: the tap appeared to work, the refetch wiped it, and nothing said why.
   */
  function failed(
    what: string,
    result: { error: PostgrestError | null; data: unknown[] | null }
  ): boolean {
    if (result.error) {
      setError(`Couldn't ${what} — ${result.error.message}`);
      return true;
    }
    if (!result.data || result.data.length === 0) {
      setError(
        `Couldn't ${what} — the database rejected the change. You may not have permission to record results here.`
      );
      return true;
    }
    setError(null);
    return false;
  }

  // Playoff priority follows the *settled* solo top 3: a team that loses a
  // tiebreak for 3rd drops out and gets no priority.
  const resolved = useMemo(
    () =>
      roster
        ? computeStandings(roster.teams, roster.scores, solo, tiebreaks, {
            tug: tug?.matches,
            dodgeball: dodge?.matches,
            teamSizes,
          })
        : EMPTY_STANDINGS,
    [roster, solo, tiebreaks, tug, dodge, teamSizes]
  );
  const priorityTeamIds = useMemo(
    () => soloPriorityTeamIds(resolved.solo),
    [resolved]
  );

  // The board the groups are drawn from. Tug of War takes the *settled* solo
  // leaderboard — tiebreaks applied — so the draw is the solo result and nothing
  // else; Dodgeball takes the team board, which by then carries the Tug of War
  // points. Both are already sorted best-first by `computeStandings`.
  const standings: SeedStanding[] =
    config.seedFrom === "solo" ? resolved.solo : resolved.teams;

  // Locking is irreversible, so a half-entered solo event would quietly seed the
  // wrong groups. Warn rather than block: a team that genuinely sat an event out
  // would otherwise leave the tournament unlockable.
  const soloGaps = useMemo(
    () => soloEventsIncomplete(solo, teams),
    [solo, teams]
  );

  const groupStandings = useMemo(
    () =>
      data
        ? computeGroupStandings(
            data.groupMembers,
            data.matches,
            teams,
            priorityTeamIds
          )
        : [],
    [data, teams, priorityTeamIds]
  );

  // The split the confirm dialog previews and `lockGroups` then writes.
  const groupPreview = useMemo(
    () => assignGroups(standings),
    [assignGroups, standings]
  );

  const groupsLocked = data?.state?.groups_locked ?? false;
  const bracketSeeded = data?.state?.bracket_seeded ?? false;
  const groupsDone = data ? groupStageComplete(data.matches) : false;

  // Groups locked but no matches to record against them. This is a broken
  // tournament, not a stage: it means the match insert failed while the state
  // flag went through, leaving a screen with standings and nothing to tap. It's
  // repairable without a reset, because the seeding is already stored.
  const matchesMissing =
    groupsLocked &&
    (data?.groupMembers.length ?? 0) > 0 &&
    !(data?.matches ?? []).some((m) => m.stage === "group");

  const qualifiers = useMemo(
    () => computeQualifiers(groupStandings, priorityTeamIds),
    [groupStandings, priorityTeamIds]
  );
  const wildcard = resolvedWildcard(qualifiers, data?.state ?? null);
  const four = resolvedQualifiers(qualifiers, data?.state ?? null);

  // ----------------------------------------------------------------------------
  // Actions
  // ----------------------------------------------------------------------------
  async function lockGroups() {
    if (!roster || standings.length < 2) return;
    setBusy(true);
    const supabase = createClient();
    const assignments = groupPreview;

    const membersRes = await supabase
      .from(tables.groupMembers)
      .insert(
        assignments.map((a) => ({
          team_id: a.team_id,
          group_label: a.group_label,
          seed: a.seed,
        }))
      )
      .select("team_id");
    if (failed("lock the groups", membersRes)) {
      setBusy(false);
      setConfirmLock(false);
      return;
    }

    // The matches have to exist before the state flag flips, or a failure here
    // leaves a locked tournament with nothing to record against.
    const matchesRes = await supabase
      .from(tables.matches)
      .insert(groupMatchRows(assignments))
      .select("id");
    if (failed("generate the group matches", matchesRes)) {
      setBusy(false);
      setConfirmLock(false);
      await load();
      return;
    }

    const stateRes = await supabase
      .from(tables.state)
      .upsert({ id: 1, groups_locked: true, updated_at: new Date().toISOString() })
      .select("id");
    if (failed("lock the groups", stateRes)) {
      setBusy(false);
      setConfirmLock(false);
      await load();
      return;
    }

    await logAudit(supabase, "create", `${auditEntity}_tournament`, "1", {
      action: "lock_groups",
      teams: assignments.length,
    });
    await load();
    setBusy(false);
    setConfirmLock(false);
  }

  /** Rebuild the round robin from the stored seeding, without re-drawing it. */
  async function repairGroupMatches() {
    if (!data || data.groupMembers.length === 0) return;
    setBusy(true);
    const supabase = createClient();
    const res = await supabase
      .from(tables.matches)
      .insert(groupMatchRows(data.groupMembers))
      .select("id");
    if (!failed("generate the group matches", res)) {
      await logAudit(supabase, "create", `${auditEntity}_tournament`, "1", {
        action: "repair_group_matches",
        matches: res.data?.length ?? 0,
      });
    }
    await load();
    setBusy(false);
  }

  async function resetTournament() {
    if (
      !confirm(
        `Reset the entire ${name.toLowerCase()} tournament? All groups, matches and bracket results will be deleted.`
      )
    )
      return;
    setBusy(true);
    const supabase = createClient();
    await supabase.from(tables.matches).delete().gte("created_at", EPOCH);
    await supabase.from(tables.groupMembers).delete().gte("created_at", EPOCH);
    const res = await supabase
      .from(tables.state)
      .upsert({
        id: 1,
        groups_locked: false,
        bracket_seeded: false,
        wildcard_team_id: null,
        updated_at: new Date().toISOString(),
      })
      .select("id");
    if (!failed("reset the tournament", res)) {
      await logAudit(supabase, "delete", `${auditEntity}_tournament`, "1", {
        action: "reset",
      });
    }
    await load();
    setBusy(false);
  }

  async function saveMatch(
    match: TournamentMatch,
    scoreA: number,
    scoreB: number
  ) {
    if (scoreA === scoreB) {
      setError(
        `A ${name.toLowerCase()} match can't end in a tie — record a winner.`
      );
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const winner_id = scoreA > scoreB ? match.team_a : match.team_b;
    const res = await supabase
      .from(tables.matches)
      .update({
        score_a: scoreA,
        score_b: scoreB,
        winner_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", match.id)
      .select("id");

    if (!failed("save that result", res)) {
      await logAudit(supabase, "update", `${auditEntity}_match`, match.id, {
        stage: match.stage,
        winner: teamById.get(winner_id ?? "")?.name,
        score: `${scoreA}-${scoreB}`,
      });
      // Bracket semis feed the final and 3rd-place match once both are decided.
      if (match.stage === "semi") await propagateBracket(supabase);
    }
    await load();
    setBusy(false);
  }

  /**
   * The per-round survivor counts for one match, from which eliminations are
   * derived. Kept separate from the result because it's entered separately — a
   * referee calls the winner straight away and counts who's left after — and
   * because either can be corrected without disturbing the other.
   */
  async function saveSurvivors(
    match: TournamentMatch,
    survivorsA: (number | null)[],
    survivorsB: (number | null)[]
  ) {
    setBusy(true);
    const supabase = createClient();
    const res = await supabase
      .from(tables.matches)
      .update({
        survivors_a: survivorsA,
        survivors_b: survivorsB,
        updated_at: new Date().toISOString(),
      })
      .eq("id", match.id)
      .select("id");

    if (!failed("save those survivor counts", res)) {
      const show = (v: (number | null)[]) =>
        v.map((n) => n ?? "—").join("/");
      await logAudit(supabase, "update", `${auditEntity}_match`, match.id, {
        stage: match.stage,
        survivors: `${teamById.get(match.team_a ?? "")?.name ?? "?"} ${show(
          survivorsA
        )} · ${teamById.get(match.team_b ?? "")?.name ?? "?"} ${show(
          survivorsB
        )}`,
      });
    }
    await load();
    setBusy(false);
  }

  /** Fill final/3rd-place participants from the two semifinal results. */
  async function propagateBracket(supabase: ReturnType<typeof createClient>) {
    const { matches } = await fetchTournamentData(supabase, tables);
    const { semis, final, third } = bracketMatches(matches);
    if (semis.length < 2) return;
    const [s1, s2] = semis;
    if (!s1.winner_id || !s2.winner_id) return;

    if (final) {
      await supabase
        .from(tables.matches)
        .update({ team_a: s1.winner_id, team_b: s2.winner_id })
        .eq("id", final.id);
    }
    if (third) {
      await supabase
        .from(tables.matches)
        .update({ team_a: loserOf(s1), team_b: loserOf(s2) })
        .eq("id", third.id);
    }
  }

  async function chooseWildcard(teamId: string) {
    setBusy(true);
    const supabase = createClient();
    const res = await supabase
      .from(tables.state)
      .upsert({
        id: 1,
        wildcard_team_id: teamId,
        updated_at: new Date().toISOString(),
      })
      .select("id");
    if (!failed("set the wildcard", res)) {
      await logAudit(supabase, "update", `${auditEntity}_tournament`, "1", {
        action: "set_wildcard",
        team: teamById.get(teamId)?.name,
      });
    }
    await load();
    setBusy(false);
  }

  async function seedBracket() {
    if (!four) return;
    setBusy(true);
    const supabase = createClient();
    const shuffled = [...four].sort(() => Math.random() - 0.5);
    const blank = {
      group_label: null,
      score_a: null,
      score_b: null,
      winner_id: null,
      is_tiebreaker: false,
    } as const;

    const rows: NewMatch[] = [
      {
        ...blank,
        stage: "semi",
        slot: 1,
        team_a: shuffled[0].team.id,
        team_b: shuffled[1].team.id,
      },
      {
        ...blank,
        stage: "semi",
        slot: 2,
        team_a: shuffled[2].team.id,
        team_b: shuffled[3].team.id,
      },
      { ...blank, stage: "final", slot: 0, team_a: null, team_b: null },
      { ...blank, stage: "third", slot: 0, team_a: null, team_b: null },
    ];

    const matchesRes = await supabase
      .from(tables.matches)
      .insert(rows)
      .select("id");
    if (failed("seed the bracket", matchesRes)) {
      setBusy(false);
      await load();
      return;
    }
    const stateRes = await supabase
      .from(tables.state)
      .upsert({
        id: 1,
        bracket_seeded: true,
        updated_at: new Date().toISOString(),
      })
      .select("id");
    if (!failed("seed the bracket", stateRes)) {
      await logAudit(supabase, "create", `${auditEntity}_tournament`, "1", {
        action: "seed_bracket",
      });
    }
    await load();
    setBusy(false);
  }

  const bracket = data ? bracketMatches(data.matches) : null;
  const colors = ACCENTS[accent];
  const survivorHandler = eliminations ? saveSurvivors : undefined;

  // ----------------------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------------------
  return (
    <PageTransition className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Admin
      </Link>

      <div className="flex items-center gap-3 mb-8">
        <div
          className={`w-12 h-12 rounded-xl ${colors.tile} flex items-center justify-center`}
        >
          <Icon className={`w-6 h-6 ${colors.icon}`} />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            {config.heading}
          </h1>
          <p className="text-sm text-muted">{config.subtitle}</p>
        </div>
        {groupsLocked && (
          <Button
            variant="danger"
            size="sm"
            className="ml-auto"
            onClick={resetTournament}
            disabled={busy}
          >
            <RotateCcw className="w-4 h-4" /> Reset
          </Button>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-3 rounded-2xl border border-danger/40 bg-danger/[0.07] p-4"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
          <p className="flex-1 text-sm text-foreground">{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            className="shrink-0 text-xs font-semibold text-muted transition-colors hover:text-foreground"
          >
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <SkeletonList rows={6} />
        </div>
      ) : !groupsLocked ? (
        <LockGroupsSection
          standings={standings}
          preview={groupPreview}
          heading={config.standingsHeading}
          rule={config.seedingRule}
          pointsLabel={config.pointsLabel}
          soloGaps={soloGaps}
          seedFrom={config.seedFrom}
          onLock={() => setConfirmLock(true)}
          busy={busy}
        />
      ) : (
        <div className="space-y-10">
          {matchesMissing && (
            <div className="flex flex-col items-start gap-3 rounded-2xl border border-warning/40 bg-warning/[0.07] p-5 sm:flex-row sm:items-center">
              <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">
                  The groups are locked but no matches were created
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  The seeding is stored, so this can be fixed without resetting:
                  the round robin will be rebuilt from the groups already drawn,
                  exactly as they stand.
                </p>
              </div>
              <Button onClick={repairGroupMatches} disabled={busy}>
                <Wrench className="w-4 h-4" /> Generate matches
              </Button>
            </div>
          )}

          {/* Group stage */}
          <section>
            <SectionTitle
              step={1}
              accent={accent}
              title="Group Stage"
              subtitle={
                eliminations
                  ? "Best of 3 — tap the score the winning team won by, then tally eliminations"
                  : "Best of 3 — tap the score the winning team won by"
              }
            />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {GROUP_LABELS.map((label) => {
                const gs = groupStandings.find((g) => g.label === label);
                const groupMatches = (data?.matches ?? []).filter(
                  (m) =>
                    m.stage === "group" &&
                    !m.is_tiebreaker &&
                    m.group_label === label
                );
                return (
                  <div
                    key={label}
                    className="bg-card rounded-2xl border border-border overflow-hidden"
                  >
                    <div className="px-5 py-3 border-b border-border">
                      <h3 className="font-display font-bold text-foreground">
                        GROUP {label}
                      </h3>
                    </div>
                    <div className="p-3 space-y-2">
                      {groupMatches.length > 0 ? (
                        groupMatches.map((m) => (
                          <MatchResultPicker
                            key={m.id}
                            match={m}
                            teamById={teamById}
                            busy={busy}
                            onSave={saveMatch}
                            onSaveSurvivors={survivorHandler}
                            teamSizes={teamSizes}
                          />
                        ))
                      ) : (
                        <p className="py-3 text-center text-sm text-muted">
                          No matches in this group.
                        </p>
                      )}
                    </div>
                    {gs && gs.teams.length > 0 && (
                      <div className="px-3 pb-3 pt-1 border-t border-border">
                        <p className="text-[10px] uppercase tracking-wide text-muted mb-1.5 mt-2">
                          Standings
                        </p>
                        {gs.teams.map((row) => (
                          <div
                            key={row.team.id}
                            className="flex items-center gap-2 text-sm py-0.5"
                          >
                            <span className="w-4 text-muted font-mono text-xs">
                              {row.rank}
                            </span>
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: row.team.color }}
                            />
                            <span className="flex-1 truncate">
                              {row.team.name}
                            </span>
                            <span className="font-mono font-bold">
                              {row.roundWins}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Qualifiers */}
          {groupsDone && (
            <section>
              <SectionTitle
                step={2}
                accent={accent}
                title="Qualifiers"
                subtitle="Three group winners plus the best 2nd-place team advance"
              />
              <QualifiersSection
                qualifiers={qualifiers}
                wildcard={wildcard}
                onChooseWildcard={chooseWildcard}
                priorityTeamIds={priorityTeamIds}
                busy={busy}
              />
            </section>
          )}

          {/* Bracket */}
          {groupsDone && (
            <section>
              <SectionTitle
                step={3}
                accent={accent}
                title="Playoff Bracket"
                subtitle={
                  eliminations
                    ? "Randomize the four qualifiers, then record results — round wins and placement only, no elimination tally"
                    : "Randomize the four qualifiers, then record results"
                }
              />
              {!bracketSeeded ? (
                <div className="bg-card rounded-2xl border border-border p-6 flex flex-col items-center gap-3">
                  <p className="text-sm text-muted text-center">
                    {four
                      ? "All four qualifiers are set."
                      : "Resolve the 2nd-place wildcard above to enable seeding."}
                  </p>
                  <Button onClick={seedBracket} disabled={busy || !four}>
                    <Shuffle className="w-4 h-4" /> Randomize seeding
                  </Button>
                </div>
              ) : (
                bracket && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {bracket.semis.map((m, i) => (
                      <BracketEditor
                        key={m.id}
                        heading={`Semifinal ${i + 1}`}
                        match={m}
                        teamById={teamById}
                        busy={busy}
                        onSave={saveMatch}
                        onSaveSurvivors={survivorHandler}
                            teamSizes={teamSizes}
                      />
                    ))}
                    {bracket.final && (
                      <BracketEditor
                        heading="Final"
                        match={bracket.final}
                        teamById={teamById}
                        busy={busy}
                        onSave={saveMatch}
                        onSaveSurvivors={survivorHandler}
                            teamSizes={teamSizes}
                      />
                    )}
                    {bracket.third && (
                      <BracketEditor
                        heading="3rd Place"
                        match={bracket.third}
                        teamById={teamById}
                        busy={busy}
                        onSave={saveMatch}
                        onSaveSurvivors={survivorHandler}
                            teamSizes={teamSizes}
                      />
                    )}
                  </div>
                )
              )}
            </section>
          )}
        </div>
      )}

      <LockGroupsDialog
        open={confirmLock}
        onClose={() => setConfirmLock(false)}
        onConfirm={lockGroups}
        busy={busy}
        tournament={name}
        accent={accent}
        rule={config.seedingRule}
        standings={standings}
        assignments={groupPreview}
        soloGaps={soloGaps}
      />
    </PageTransition>
  );
}

// ------------------------------------------------------------------------------
// Sub-components
// ------------------------------------------------------------------------------
function SectionTitle({
  step,
  title,
  subtitle,
  accent,
}: {
  step: number;
  title: string;
  subtitle: string;
  accent: keyof typeof ACCENTS;
}) {
  const colors = ACCENTS[accent];
  return (
    <div className="flex items-center gap-3 mb-4">
      <span
        className={`w-7 h-7 rounded-full ${colors.tile} ${colors.icon} font-bold text-sm flex items-center justify-center`}
      >
        {step}
      </span>
      <div>
        <h2 className="font-display text-lg font-bold text-foreground">
          {title}
        </h2>
        <p className="text-xs text-muted">{subtitle}</p>
      </div>
    </div>
  );
}

function LockGroupsSection({
  standings,
  preview,
  heading,
  rule,
  pointsLabel,
  soloGaps,
  seedFrom,
  onLock,
  busy,
}: {
  standings: SeedStanding[];
  /** The group each team would land in. */
  preview: GroupAssignment[];
  heading: string;
  rule: string;
  pointsLabel: string;
  /** Solo events still missing results — a warning, never a block. */
  soloGaps: SoloEventCoverage[];
  seedFrom: TournamentConfig["seedFrom"];
  onLock: () => void;
  busy: boolean;
}) {
  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-foreground">{heading}</h2>
          <p className="text-xs text-muted">Groups will be assigned {rule}</p>
        </div>
        <Button onClick={onLock} disabled={busy || standings.length < 2}>
          <Lock className="w-4 h-4" /> Lock &amp; generate groups
        </Button>
      </div>
      {soloGaps.length > 0 && (
        <div className="border-b border-border bg-warning/[0.07] px-5 py-4">
          <SoloGapWarning gaps={soloGaps} seedFrom={seedFrom} />
        </div>
      )}
      <div className="divide-y divide-border">
        {standings.map((s, i) => (
          <div key={s.team.id} className="flex items-center gap-3 px-5 py-2.5">
            <span className="w-6 text-center font-mono text-sm font-bold text-muted">
              {i + 1}
            </span>
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: s.team.color }}
            />
            <span className="flex-1 font-semibold text-sm">{s.team.name}</span>
            <span className="text-xs text-muted">
              → Group {preview[i]?.group_label}
            </span>
            <span className="font-mono text-sm font-bold w-20 text-right">
              {s.totalPoints} {pointsLabel}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Names the solo events that aren't fully scored yet, because the groups about
 * to be locked depend on those results and locking can only be undone by
 * resetting the whole tournament. How much they depend on them differs: a
 * solo-seeded draw *is* the solo order, while a team-seeded one only carries the
 * top-3 bonus and the wildcard priority marker.
 */
function SoloGapWarning({
  gaps,
  seedFrom,
}: {
  gaps: SoloEventCoverage[];
  seedFrom: TournamentConfig["seedFrom"];
}) {
  return (
    <div className="flex items-start gap-3">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">
          {gaps.length} solo{" "}
          {gaps.length === 1 ? "event isn't" : "events aren't"} fully scored yet
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          {seedFrom === "solo"
            ? "These groups are seeded straight off the solo results, so entering the missing scores first will change who lands where."
            : "The solo top-3 bonus and the wildcard priority marker both come out of these results, so entering the missing scores first can change the seeding."}{" "}
          You can still lock now if a team sat an event out.
        </p>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {gaps.map((g) => (
            <li key={g.slug} className="text-xs text-muted">
              <span className="font-medium text-foreground">{g.name}</span>{" "}
              <span className="font-mono">
                {g.recorded}/{g.expected}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function BracketEditor({
  heading,
  match,
  teamById,
  busy,
  onSave,
  onSaveSurvivors,
  teamSizes,
}: {
  heading: string;
  match: TournamentMatch;
  teamById: Map<string, RosterTeam>;
  busy: boolean;
  onSave: (m: TournamentMatch, a: number, b: number) => void;
  onSaveSurvivors?: (
    m: TournamentMatch,
    a: (number | null)[],
    b: (number | null)[]
  ) => void;
  teamSizes?: Map<string, number>;
}) {
  const ready = match.team_a != null && match.team_b != null;
  return (
    <div className="bg-card rounded-2xl border border-border p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-muted mb-2">
        {heading}
      </p>
      {ready ? (
        <MatchResultPicker
          match={match}
          teamById={teamById}
          busy={busy}
          onSave={onSave}
          onSaveSurvivors={onSaveSurvivors}
          teamSizes={teamSizes}
        />
      ) : (
        <p className="text-sm text-muted py-3 text-center">
          Waiting on semifinal results…
        </p>
      )}
    </div>
  );
}

function QualifiersSection({
  qualifiers,
  wildcard,
  onChooseWildcard,
  priorityTeamIds,
  busy,
}: {
  qualifiers: Qualifiers;
  wildcard: GroupTeamStanding | null;
  onChooseWildcard: (teamId: string) => void;
  priorityTeamIds: Set<string>;
  busy: boolean;
}) {
  const hasTie = qualifiers.wildcardTie.length > 0;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Group winners */}
      <div className="bg-card rounded-2xl border border-border p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-success mb-3">
          Group Winners
        </p>
        <div className="space-y-2">
          {qualifiers.groupWinners.map((w) => (
            <div key={w.team.id} className="flex items-center gap-2 text-sm">
              <Trophy className="w-4 h-4 text-success shrink-0" />
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: w.team.color }}
              />
              <span className="flex-1 font-semibold truncate">
                {w.team.name}
              </span>
              <span className="font-mono text-xs text-muted">
                {w.roundWins} RW
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Wildcard */}
      <div className="bg-card rounded-2xl border border-border p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-gold mb-3">
          Wildcard (best 2nd place)
        </p>
        {!hasTie && wildcard ? (
          <div>
            <div className="flex items-center gap-2 text-sm">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: wildcard.team.color }}
              />
              <span className="flex-1 font-semibold truncate">
                {wildcard.team.name}
              </span>
              {priorityTeamIds.has(wildcard.team.id) && (
                <Star className="w-3.5 h-3.5 text-gold fill-gold shrink-0" />
              )}
              <span className="font-mono text-xs text-muted">
                {wildcard.roundWins} RW
              </span>
            </div>
            {qualifiers.wildcardByPriority && (
              <p className="text-xs text-gold flex items-center gap-1.5 mt-2">
                <Star className="w-3.5 h-3.5 fill-gold" />
                Auto-advanced on the solo top-3 priority marker (broke a
                2nd-place tie).
              </p>
            )}
          </div>
        ) : (
          <div>
            <p className="text-xs text-warning flex items-center gap-1.5 mb-3">
              <AlertTriangle className="w-3.5 h-3.5" />
              Tie for the wildcard — play a tiebreaker, then pick the winner:
            </p>
            <div className="space-y-2">
              {qualifiers.wildcardTie.map((t) => {
                const chosen = wildcard?.team.id === t.team.id;
                return (
                  <button
                    key={t.team.id}
                    onClick={() => onChooseWildcard(t.team.id)}
                    disabled={busy}
                    className={`w-full flex items-center gap-2 text-sm px-3 py-2 rounded-lg border transition-colors ${
                      chosen
                        ? "border-success bg-success/10"
                        : "border-border hover:border-foreground/30"
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: t.team.color }}
                    />
                    <span className="flex-1 text-left font-semibold truncate">
                      {t.team.name}
                    </span>
                    {priorityTeamIds.has(t.team.id) && (
                      <Star className="w-3.5 h-3.5 text-gold fill-gold shrink-0" />
                    )}
                    {chosen && <Check className="w-4 h-4 text-success" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
