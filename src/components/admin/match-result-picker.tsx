"use client";

import { useState } from "react";
import { ChevronDown, Loader2, Trophy } from "lucide-react";
import type { RosterTeam } from "@/lib/types";
import type { TournamentMatch } from "@/lib/tournament";
import { DEFAULT_TEAM_SIZE, scoresEliminations } from "@/lib/tournamentPoints";

const FALLBACK_COLOR = "#94A3B8";

/**
 * Rounds the winner takes, and therefore the scorelines on offer. Group matches
 * are best-of-3 (2–0 or 2–1); everything else — the bracket, and the one-off
 * games played to break a tie — is single-round sudden death, so the only
 * possible result is 1–0.
 *
 * This matters beyond the buttons now that round wins are worth a point each
 * (see src/lib/tournamentPoints.ts): recording a sudden-death win as 2–0 would
 * quietly pay the winner double.
 */
function roundsToWin(match: TournamentMatch): number {
  return match.stage === "group" && !match.is_tiebreaker ? 2 : 1;
}

/** The rounds the *loser* can have taken, given the format. */
function loserOptions(match: TournamentMatch): number[] {
  return roundsToWin(match) === 2 ? [0, 1] : [0];
}

/** Most rounds this format can run to. */
function maxRounds(match: TournamentMatch): number {
  return roundsToWin(match) === 2 ? 3 : 1;
}

/**
 * How many round rows the survivor tally shows.
 *
 * Once the result is in, the scoreline says exactly how many rounds were played
 * (2–1 is three rounds), so a 2–0 stops offering a third. Before that, all the
 * format's rounds are offered. Either way it never shows fewer rows than have
 * counts entered — hiding a recorded round would leave points on the board with
 * nothing on screen explaining them.
 */
function tallyRounds(match: TournamentMatch): number {
  const decided = match.score_a != null && match.score_b != null;
  const played = decided ? match.score_a! + match.score_b! : maxRounds(match);
  const entered = Math.max(
    lastEnteredRound(match.survivors_a),
    lastEnteredRound(match.survivors_b)
  );
  return Math.max(1, played, entered);
}

function lastEnteredRound(survivors: (number | null)[] | null | undefined) {
  if (!survivors) return 0;
  let last = 0;
  survivors.forEach((v, i) => {
    if (v != null) last = i + 1;
  });
  return last;
}

/** Normalize a stored array to a fixed length, padding with "not counted". */
function toRounds(
  survivors: (number | null)[] | null | undefined,
  rounds: number
): (number | null)[] {
  return Array.from({ length: rounds }, (_, i) => survivors?.[i] ?? null);
}

interface MatchResultPickerProps {
  match: TournamentMatch;
  teamById: Map<string, RosterTeam>;
  busy: boolean;
  onSave: (
    match: TournamentMatch,
    scoreA: number,
    scoreB: number
  ) => void | Promise<void>;
  /**
   * Supplied for Dodgeball only. Its presence adds the survivor tally under the
   * result, since eliminations are worth a point each there and nothing at all
   * in Tug of War. Both arrays are sent whole, one entry per round.
   *
   * The tally still only appears on matches whose eliminations score — the group
   * stage (see `scoresEliminations`). In the bracket it's a point the referee
   * would be counting for nothing.
   */
  onSaveSurvivors?: (
    match: TournamentMatch,
    survivorsA: (number | null)[],
    survivorsB: (number | null)[]
  ) => void | Promise<void>;
  /** teamId → players fielded, so the tally offers the right range of buttons. */
  teamSizes?: Map<string, number>;
}

/**
 * Records a match result by tapping the score the winning team won by.
 *
 * Replaces the two number fields + Save button this used to be: those wanted a
 * keyboard and three interactions per match, which on a phone at the side of a
 * pitch is the wrong shape entirely. A match only has a couple of possible
 * results, so each is a button — one tap records it, tapping another corrects it.
 *
 * Each team owns a row, and the buttons on that row are that team's winning
 * scorelines, so there's no column order to decode.
 */
export function MatchResultPicker({
  match,
  teamById,
  busy,
  onSave,
  onSaveSurvivors,
  teamSizes,
}: MatchResultPickerProps) {
  // Held only while the write is in flight so the tapped button reads as chosen
  // immediately; once the parent reloads, the match row itself is the source.
  const [pending, setPending] = useState<[number, number] | null>(null);

  const scoreA = pending ? pending[0] : match.score_a;
  const scoreB = pending ? pending[1] : match.score_b;
  const decided = scoreA != null && scoreB != null;
  const teamA = match.team_a ? teamById.get(match.team_a) : null;
  const teamB = match.team_b ? teamById.get(match.team_b) : null;
  const wins = roundsToWin(match);
  const losses = loserOptions(match);

  async function pick(a: number, b: number) {
    setPending([a, b]);
    try {
      await onSave(match, a, b);
    } finally {
      setPending(null);
    }
  }

  // A result from outside the presets (older data, or a match that ran long) has
  // no button to sit under, so state it in words instead of dropping it.
  const offPreset =
    decided &&
    !losses.some(
      (l) => (scoreA === wins && scoreB === l) || (scoreB === wins && scoreA === l)
    );

  const teamsKnown = match.team_a != null && match.team_b != null;

  return (
    <div className="rounded-xl bg-background p-2.5">
      <TeamRow
        team={teamA}
        won={decided && scoreA! > scoreB!}
        saving={pending != null && busy}
        winnerRounds={wins}
        loserOptions={losses}
        selectedLoserRounds={scoreA === wins ? scoreB : null}
        onPick={(loser) => pick(wins, loser)}
        disabled={busy || !teamsKnown}
      />
      <div className="my-1.5 flex items-center gap-2 px-1">
        <span className="text-[10px] uppercase tracking-wider text-muted">
          vs
        </span>
        <div className="h-px flex-1 bg-border" />
        {offPreset && (
          <span className="font-mono text-[10px] text-muted">
            recorded {scoreA}–{scoreB}
          </span>
        )}
      </div>
      <TeamRow
        team={teamB}
        won={decided && scoreB! > scoreA!}
        saving={pending != null && busy}
        winnerRounds={wins}
        loserOptions={losses}
        selectedLoserRounds={scoreB === wins ? scoreA : null}
        onPick={(loser) => pick(loser, wins)}
        disabled={busy || !teamsKnown}
      />

      {onSaveSurvivors && teamsKnown && scoresEliminations(match) && (
        <SurvivorTally
          match={match}
          teamA={teamA}
          teamB={teamB}
          busy={busy}
          teamSizes={teamSizes}
          onSave={onSaveSurvivors}
        />
      )}
    </div>
  );
}

function TeamRow({
  team,
  won,
  saving,
  winnerRounds,
  loserOptions,
  selectedLoserRounds,
  onPick,
  disabled,
}: {
  team: RosterTeam | null | undefined;
  won: boolean;
  saving: boolean;
  /** Rounds the winner of this format takes. */
  winnerRounds: number;
  /** Rounds the loser can have taken. */
  loserOptions: number[];
  /** Rounds the *other* team took, when this team is the recorded winner. */
  selectedLoserRounds: number | null;
  onPick: (loserRounds: number) => void;
  disabled: boolean;
}) {
  const color = team?.color ?? FALLBACK_COLOR;
  const name = team?.name ?? "TBD";

  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span
        className={`min-w-0 flex-1 truncate text-sm ${
          won ? "font-bold text-foreground" : "font-medium"
        }`}
      >
        {name}
        {/* Decorative: the pressed button below already carries the result for
            assistive tech. */}
        {won && !saving && (
          <Trophy aria-hidden className="ml-1 inline h-3 w-3 text-success" />
        )}
      </span>
      <div className="flex shrink-0 gap-1" role="group" aria-label={`${name} wins`}>
        {loserOptions.map((loser) => {
          const selected = selectedLoserRounds === loser;
          return (
            <button
              key={loser}
              type="button"
              aria-pressed={selected}
              aria-label={`${name} wins ${winnerRounds} round${
                winnerRounds === 1 ? "" : "s"
              } to ${loser}`}
              disabled={disabled}
              onClick={() => onPick(loser)}
              className={`h-9 w-12 rounded-lg border font-mono text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral disabled:opacity-40 sm:h-8 ${
                selected
                  ? "text-foreground"
                  : "border-border bg-card text-muted hover:border-foreground/30 hover:text-foreground"
              }`}
              // The selected state is tinted with the team's own colour, which
              // only exists at runtime — `color-mix` keeps it readable in one
              // line whatever format the colour is stored in.
              style={
                selected
                  ? {
                      backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`,
                      borderColor: `color-mix(in srgb, ${color} 60%, transparent)`,
                    }
                  : undefined
              }
            >
              {saving && selected ? (
                <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" />
              ) : (
                `${winnerRounds}–${loser}`
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The survivor tally: how many players each side still had alive when a round
 * ended. The opponent's eliminations fall out of that (team size − survivors),
 * so nobody has to total hits in their head mid-game — the referee records the
 * one number they can see by looking at the court.
 *
 * Buttons rather than a field, for the same reason the result is buttons: the
 * answer is one of seven possibilities, and a keyboard at the side of a pitch is
 * the wrong tool. Each tap saves immediately; tapping the selected number again
 * clears it, which is the way back from a mis-tap.
 *
 * Folded away behind its summary by default. Three rounds of two teams is a lot
 * of buttons to leave sitting under every match in a group of three.
 */
function SurvivorTally({
  match,
  teamA,
  teamB,
  busy,
  teamSizes,
  onSave,
}: {
  match: TournamentMatch;
  teamA: RosterTeam | null | undefined;
  teamB: RosterTeam | null | undefined;
  busy: boolean;
  teamSizes?: Map<string, number>;
  onSave: (
    match: TournamentMatch,
    survivorsA: (number | null)[],
    survivorsB: (number | null)[]
  ) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  const rounds = tallyRounds(match);
  const a = toRounds(match.survivors_a, rounds);
  const b = toRounds(match.survivors_b, rounds);
  const sizeA = teamSizes?.get(teamA?.id ?? "") ?? DEFAULT_TEAM_SIZE;
  const sizeB = teamSizes?.get(teamB?.id ?? "") ?? DEFAULT_TEAM_SIZE;

  // Shown live so the referee can sanity-check the tally against the game they
  // just watched, rather than trusting it to reappear on the leaderboard.
  const elimsA = eliminationsFrom(b, sizeB);
  const elimsB = eliminationsFrom(a, sizeA);
  const counted = [...a, ...b].some((v) => v != null);

  /** Set one team's survivors for one round, or clear it by re-tapping. */
  function pick(side: "a" | "b", round: number, alive: number) {
    const nextA = [...a];
    const nextB = [...b];
    const target = side === "a" ? nextA : nextB;
    target[round] = target[round] === alive ? null : alive;
    onSave(match, nextA, nextB);
  }

  return (
    <div className="mt-2.5 border-t border-border pt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left transition-colors hover:bg-foreground/[0.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral"
      >
        <span className="text-[10px] tracking-wider text-muted uppercase">
          Survivors
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted">
          {counted ? (
            <>
              <span style={{ color: teamA?.color }}>●</span> {elimsA}
              <span className="mx-1.5 text-border">·</span>
              <span style={{ color: teamB?.color }}>●</span> {elimsB}
              <span className="ml-1.5">elims</span>
            </>
          ) : (
            "not counted"
          )}
        </span>
        <ChevronDown
          aria-hidden
          className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="mt-1.5 space-y-2.5">
          {Array.from({ length: rounds }, (_, r) => (
            <div key={r}>
              <p className="mb-1 px-1 text-[10px] tracking-wider text-muted uppercase">
                Round {r + 1}
                <span className="ml-1.5 normal-case tracking-normal opacity-70">
                  · players left alive
                </span>
              </p>
              <SurvivorRow
                team={teamA}
                teamSize={sizeA}
                value={a[r]}
                disabled={busy}
                onPick={(alive) => pick("a", r, alive)}
                round={r + 1}
              />
              <SurvivorRow
                team={teamB}
                teamSize={sizeB}
                value={b[r]}
                disabled={busy}
                onPick={(alive) => pick("b", r, alive)}
                round={r + 1}
              />
            </div>
          ))}
          <p className="px-1 text-[10px] leading-relaxed text-muted">
            Counted when the round ends, so a player brought back by a catch is
            alive again. Leave a round blank if it wasn&rsquo;t played.
          </p>
        </div>
      )}
    </div>
  );
}

function SurvivorRow({
  team,
  teamSize,
  value,
  disabled,
  onPick,
  round,
}: {
  team: RosterTeam | null | undefined;
  teamSize: number;
  value: number | null;
  disabled: boolean;
  onPick: (alive: number) => void;
  round: number;
}) {
  const color = team?.color ?? FALLBACK_COLOR;
  const name = team?.name ?? "Team";

  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="flex min-w-0 items-center gap-1.5">
        <span
          aria-hidden
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="truncate text-xs text-muted">{name}</span>
      </span>
      <div
        className="flex flex-1 flex-wrap gap-1"
        role="group"
        aria-label={`${name} players alive at the end of round ${round}`}
      >
        {Array.from({ length: teamSize + 1 }, (_, alive) => {
          const selected = value === alive;
          return (
            <button
              key={alive}
              type="button"
              aria-pressed={selected}
              aria-label={`${alive} of ${name} left alive`}
              disabled={disabled}
              onClick={() => onPick(alive)}
              className={`h-8 w-8 rounded-lg border font-mono text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral disabled:opacity-40 ${
                selected
                  ? "text-foreground"
                  : "border-border bg-card text-muted hover:border-foreground/30 hover:text-foreground"
              }`}
              style={
                selected
                  ? {
                      backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`,
                      borderColor: `color-mix(in srgb, ${color} 60%, transparent)`,
                    }
                  : undefined
              }
            >
              {alive}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Opponents put out, from the survivor counts of the side being eliminated. */
function eliminationsFrom(
  survivors: (number | null)[],
  teamSize: number
): number {
  return survivors.reduce<number>(
    (total, alive) => total + (alive == null ? 0 : Math.max(0, teamSize - alive)),
    0
  );
}
