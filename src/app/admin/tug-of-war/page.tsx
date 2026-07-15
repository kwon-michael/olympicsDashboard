"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Swords,
  Lock,
  RotateCcw,
  Shuffle,
  Trophy,
  Check,
  AlertTriangle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageTransition } from "@/components/ui/page-transition";
import { Button } from "@/components/ui/button";
import { logAudit } from "@/lib/audit";
import {
  fetchRosterData,
  computeTeamStandings,
  type RosterData,
} from "@/lib/roster";
import {
  fetchTugData,
  assignGroups,
  groupRoundRobin,
  computeGroupStandings,
  computeQualifiers,
  groupStageComplete,
  resolvedWildcard,
  resolvedQualifiers,
  bracketMatches,
  loserOf,
  GROUP_LABELS,
  type TugData,
} from "@/lib/tug";
import type { RosterTeam, TugMatch } from "@/lib/types";

const EPOCH = "1970-01-01";

export default function AdminTugPage() {
  const [roster, setRoster] = useState<RosterData | null>(null);
  const [tug, setTug] = useState<TugData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [r, t] = await Promise.all([
      fetchRosterData(supabase),
      fetchTugData(supabase),
    ]);
    setRoster(r);
    setTug(t);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const teams = useMemo(() => roster?.teams ?? [], [roster]);
  const teamById = useMemo(
    () => new Map(teams.map((t) => [t.id, t])),
    [teams]
  );

  const standings = useMemo(
    () => (roster ? computeTeamStandings(roster.teams, roster.scores) : []),
    [roster]
  );

  const groupStandings = useMemo(
    () =>
      tug ? computeGroupStandings(tug.groupMembers, tug.matches, teams) : [],
    [tug, teams]
  );

  const groupsLocked = tug?.state?.groups_locked ?? false;
  const bracketSeeded = tug?.state?.bracket_seeded ?? false;
  const groupsDone = tug ? groupStageComplete(tug.matches) : false;

  const qualifiers = useMemo(
    () => computeQualifiers(groupStandings),
    [groupStandings]
  );
  const wildcard = resolvedWildcard(qualifiers, tug?.state ?? null);
  const four = resolvedQualifiers(qualifiers, tug?.state ?? null);

  // ----------------------------------------------------------------------------
  // Actions
  // ----------------------------------------------------------------------------
  async function lockGroups() {
    if (!roster || standings.length < 2) return;
    if (
      !confirm(
        "Snapshot the current standings and generate tug-of-war groups? Teams will be split by rank {1,4,7}/{2,5,8}/{3,6,9}."
      )
    )
      return;
    setBusy(true);
    const supabase = createClient();

    const assignments = assignGroups(standings);
    await supabase
      .from("tug_group_members")
      .insert(
        assignments.map((a) => ({
          team_id: a.team_id,
          group_label: a.group_label,
          seed: a.seed,
        }))
      );

    const matchRows: Omit<TugMatch, "id" | "created_at" | "updated_at">[] = [];
    for (const label of GROUP_LABELS) {
      const ids = assignments
        .filter((a) => a.group_label === label)
        .sort((a, b) => a.seed - b.seed)
        .map((a) => a.team_id);
      groupRoundRobin(ids).forEach(([team_a, team_b], idx) => {
        matchRows.push({
          stage: "group",
          group_label: label,
          slot: idx,
          team_a,
          team_b,
          score_a: null,
          score_b: null,
          winner_id: null,
          is_tiebreaker: false,
        });
      });
    }
    await supabase.from("tug_matches").insert(matchRows);

    await supabase
      .from("tug_state")
      .upsert({ id: 1, groups_locked: true, updated_at: new Date().toISOString() });

    await logAudit(supabase, "create", "tug_tournament", "1", {
      action: "lock_groups",
      teams: assignments.length,
    });
    await load();
    setBusy(false);
  }

  async function resetTournament() {
    if (
      !confirm(
        "Reset the entire tug-of-war tournament? All groups, matches and bracket results will be deleted."
      )
    )
      return;
    setBusy(true);
    const supabase = createClient();
    await supabase.from("tug_matches").delete().gte("created_at", EPOCH);
    await supabase.from("tug_group_members").delete().gte("created_at", EPOCH);
    await supabase.from("tug_state").upsert({
      id: 1,
      groups_locked: false,
      bracket_seeded: false,
      wildcard_team_id: null,
      updated_at: new Date().toISOString(),
    });
    await logAudit(supabase, "delete", "tug_tournament", "1", {
      action: "reset",
    });
    await load();
    setBusy(false);
  }

  async function saveMatch(match: TugMatch, scoreA: number, scoreB: number) {
    if (scoreA === scoreB) {
      alert("A tug-of-war match can't end in a tie — enter different round wins.");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const winner_id = scoreA > scoreB ? match.team_a : match.team_b;
    await supabase
      .from("tug_matches")
      .update({
        score_a: scoreA,
        score_b: scoreB,
        winner_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", match.id);

    await logAudit(supabase, "update", "tug_match", match.id, {
      stage: match.stage,
      winner: teamById.get(winner_id ?? "")?.name,
      score: `${scoreA}-${scoreB}`,
    });

    // Bracket semis feed the final and 3rd-place match once both are decided.
    if (match.stage === "semi") {
      await propagateBracket(supabase);
    }
    await load();
    setBusy(false);
  }

  /** Fill final/3rd-place participants from the two semifinal results. */
  async function propagateBracket(supabase: ReturnType<typeof createClient>) {
    const { matches } = await fetchTugData(supabase);
    const { semis, final, third } = bracketMatches(matches);
    if (semis.length < 2) return;
    const [s1, s2] = semis;
    if (!s1.winner_id || !s2.winner_id) return;

    if (final) {
      await supabase
        .from("tug_matches")
        .update({ team_a: s1.winner_id, team_b: s2.winner_id })
        .eq("id", final.id);
    }
    if (third) {
      await supabase
        .from("tug_matches")
        .update({ team_a: loserOf(s1), team_b: loserOf(s2) })
        .eq("id", third.id);
    }
  }

  async function chooseWildcard(teamId: string) {
    setBusy(true);
    const supabase = createClient();
    await supabase
      .from("tug_state")
      .upsert({ id: 1, wildcard_team_id: teamId, updated_at: new Date().toISOString() });
    await logAudit(supabase, "update", "tug_tournament", "1", {
      action: "set_wildcard",
      team: teamById.get(teamId)?.name,
    });
    await load();
    setBusy(false);
  }

  async function seedBracket() {
    if (!four) return;
    setBusy(true);
    const supabase = createClient();
    const shuffled = [...four].sort(() => Math.random() - 0.5);

    const rows: Omit<TugMatch, "id" | "created_at" | "updated_at">[] = [
      {
        stage: "semi",
        group_label: null,
        slot: 1,
        team_a: shuffled[0].team.id,
        team_b: shuffled[1].team.id,
        score_a: null,
        score_b: null,
        winner_id: null,
        is_tiebreaker: false,
      },
      {
        stage: "semi",
        group_label: null,
        slot: 2,
        team_a: shuffled[2].team.id,
        team_b: shuffled[3].team.id,
        score_a: null,
        score_b: null,
        winner_id: null,
        is_tiebreaker: false,
      },
      {
        stage: "final",
        group_label: null,
        slot: 0,
        team_a: null,
        team_b: null,
        score_a: null,
        score_b: null,
        winner_id: null,
        is_tiebreaker: false,
      },
      {
        stage: "third",
        group_label: null,
        slot: 0,
        team_a: null,
        team_b: null,
        score_a: null,
        score_b: null,
        winner_id: null,
        is_tiebreaker: false,
      },
    ];
    await supabase.from("tug_matches").insert(rows);
    await supabase
      .from("tug_state")
      .upsert({ id: 1, bracket_seeded: true, updated_at: new Date().toISOString() });
    await logAudit(supabase, "create", "tug_tournament", "1", {
      action: "seed_bracket",
    });
    await load();
    setBusy(false);
  }

  const bracket = tug ? bracketMatches(tug.matches) : null;

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
        <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center">
          <Swords className="w-6 h-6 text-indigo-500" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            TUG OF WAR
          </h1>
          <p className="text-sm text-muted">
            Lock groups from the solo standings, record round wins, then seed the
            playoff bracket
          </p>
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

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-coral border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !groupsLocked ? (
        <LockGroupsSection
          standings={standings}
          onLock={lockGroups}
          busy={busy}
        />
      ) : (
        <div className="space-y-10">
          {/* Group stage */}
          <section>
            <SectionTitle
              step={1}
              title="Group Stage"
              subtitle="Record round wins for each match (best of 3)"
            />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {GROUP_LABELS.map((label) => {
                const gs = groupStandings.find((g) => g.label === label);
                const groupMatches = (tug?.matches ?? []).filter(
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
                      {groupMatches.map((m) => (
                        <MatchEditor
                          key={m.id}
                          match={m}
                          teamById={teamById}
                          busy={busy}
                          onSave={saveMatch}
                        />
                      ))}
                    </div>
                    {gs && (
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
                title="Qualifiers"
                subtitle="Three group winners plus the best 2nd-place team advance"
              />
              <QualifiersSection
                qualifiers={qualifiers}
                wildcard={wildcard}
                onChooseWildcard={chooseWildcard}
                busy={busy}
              />
            </section>
          )}

          {/* Bracket */}
          {groupsDone && (
            <section>
              <SectionTitle
                step={3}
                title="Playoff Bracket"
                subtitle="Randomize the four qualifiers, then record results"
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
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {bracket.semis.map((m, i) => (
                        <BracketEditor
                          key={m.id}
                          heading={`Semifinal ${i + 1}`}
                          match={m}
                          teamById={teamById}
                          busy={busy}
                          onSave={saveMatch}
                        />
                      ))}
                      {bracket.final && (
                        <BracketEditor
                          heading="Final"
                          match={bracket.final}
                          teamById={teamById}
                          busy={busy}
                          onSave={saveMatch}
                        />
                      )}
                      {bracket.third && (
                        <BracketEditor
                          heading="3rd Place"
                          match={bracket.third}
                          teamById={teamById}
                          busy={busy}
                          onSave={saveMatch}
                        />
                      )}
                    </div>
                  </div>
                )
              )}
            </section>
          )}
        </div>
      )}
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
}: {
  step: number;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="w-7 h-7 rounded-full bg-indigo-500/10 text-indigo-500 font-bold text-sm flex items-center justify-center">
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
  onLock,
  busy,
}: {
  standings: ReturnType<typeof computeTeamStandings>;
  onLock: () => void;
  busy: boolean;
}) {
  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-foreground">
            SOLO STANDINGS
          </h2>
          <p className="text-xs text-muted">
            Groups will be assigned by rank: {"{1,4,7}"} → A, {"{2,5,8}"} → B,{" "}
            {"{3,6,9}"} → C.
          </p>
        </div>
        <Button onClick={onLock} disabled={busy || standings.length < 2}>
          <Lock className="w-4 h-4" /> Lock &amp; generate groups
        </Button>
      </div>
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
              → Group {GROUP_LABELS[i % 3]}
            </span>
            <span className="font-mono text-sm font-bold w-14 text-right">
              {s.totalPoints} pts
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MatchEditor({
  match,
  teamById,
  busy,
  onSave,
}: {
  match: TugMatch;
  teamById: Map<string, RosterTeam>;
  busy: boolean;
  onSave: (m: TugMatch, a: number, b: number) => void;
}) {
  const [a, setA] = useState(match.score_a?.toString() ?? "");
  const [b, setB] = useState(match.score_b?.toString() ?? "");
  const teamA = match.team_a ? teamById.get(match.team_a) : null;
  const teamB = match.team_b ? teamById.get(match.team_b) : null;
  const decided = match.winner_id != null;

  return (
    <div className="bg-background rounded-xl p-2.5">
      <MatchTeamInput
        team={teamA}
        value={a}
        onChange={setA}
        winner={decided && match.winner_id === match.team_a}
      />
      <div className="flex items-center gap-2 my-1 px-1">
        <span className="text-[10px] text-muted">vs</span>
        <div className="flex-1 h-px bg-border" />
        <button
          onClick={() => onSave(match, Number(a || 0), Number(b || 0))}
          disabled={busy || a === "" || b === ""}
          className="text-xs font-semibold text-success hover:text-green-600 disabled:opacity-40 flex items-center gap-1"
        >
          <Check className="w-3.5 h-3.5" /> Save
        </button>
      </div>
      <MatchTeamInput
        team={teamB}
        value={b}
        onChange={setB}
        winner={decided && match.winner_id === match.team_b}
      />
    </div>
  );
}

function MatchTeamInput({
  team,
  value,
  onChange,
  winner,
}: {
  team: RosterTeam | null | undefined;
  value: string;
  onChange: (v: string) => void;
  winner: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: team?.color ?? "#94A3B8" }}
      />
      <span
        className={`flex-1 min-w-0 truncate text-sm ${
          winner ? "font-bold text-foreground" : "font-medium"
        }`}
      >
        {team?.name ?? "TBD"}
        {winner && <Trophy className="w-3 h-3 text-success inline ml-1" />}
      </span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-12 px-2 py-1 rounded-md border border-border bg-card text-sm text-center focus:outline-none focus:ring-2 focus:ring-coral/30"
      />
    </div>
  );
}

function BracketEditor({
  heading,
  match,
  teamById,
  busy,
  onSave,
}: {
  heading: string;
  match: TugMatch;
  teamById: Map<string, RosterTeam>;
  busy: boolean;
  onSave: (m: TugMatch, a: number, b: number) => void;
}) {
  const ready = match.team_a != null && match.team_b != null;
  return (
    <div className="bg-card rounded-2xl border border-border p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-muted mb-2">
        {heading}
      </p>
      {ready ? (
        <MatchEditor
          match={match}
          teamById={teamById}
          busy={busy}
          onSave={onSave}
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
  busy,
}: {
  qualifiers: ReturnType<typeof computeQualifiers>;
  wildcard: ReturnType<typeof resolvedWildcard>;
  onChooseWildcard: (teamId: string) => void;
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
          <div className="flex items-center gap-2 text-sm">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: wildcard.team.color }}
            />
            <span className="flex-1 font-semibold truncate">
              {wildcard.team.name}
            </span>
            <span className="font-mono text-xs text-muted">
              {wildcard.roundWins} RW
            </span>
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
