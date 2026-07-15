"use client";

import { Swords } from "lucide-react";
import type { RosterTeam, TugMatch } from "@/lib/types";
import { bracketMatches, type TugData } from "@/lib/tug";

/**
 * Read-only 4-team playoff bracket: two semifinals feeding a final, plus a
 * 3rd-place match. Shared by /tug-of-war and /teams. Shows "TBD" slots until
 * participants are seeded and results recorded.
 */
export function TugBracket({
  teams,
  tug,
}: {
  teams: RosterTeam[];
  tug: TugData;
}) {
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const { semis, final, third } = bracketMatches(tug.matches);

  if (semis.length === 0) {
    return (
      <div className="bg-card rounded-2xl border border-border p-8 text-center">
        <Swords className="w-10 h-10 text-muted mx-auto mb-3" />
        <p className="text-muted text-sm">
          The bracket will appear once the group stage is complete.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
        {/* Semifinals */}
        <div className="space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wide text-muted">
            Semifinals
          </h4>
          {semis.map((m) => (
            <MatchCard key={m.id} match={m} teamById={teamById} />
          ))}
        </div>

        {/* Final */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wide text-gold text-center">
            Final
          </h4>
          <MatchCard match={final} teamById={teamById} highlight />
        </div>

        {/* 3rd place */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wide text-muted text-center">
            3rd Place
          </h4>
          <MatchCard match={third} teamById={teamById} />
        </div>
      </div>
    </div>
  );
}

function MatchCard({
  match,
  teamById,
  highlight,
}: {
  match: TugMatch | null;
  teamById: Map<string, RosterTeam>;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border overflow-hidden ${
        highlight ? "border-gold/50 shadow-sm" : "border-border"
      }`}
    >
      <MatchSide
        teamId={match?.team_a ?? null}
        score={match?.score_a ?? null}
        isWinner={!!match?.winner_id && match.winner_id === match.team_a}
        teamById={teamById}
      />
      <div className="h-px bg-border" />
      <MatchSide
        teamId={match?.team_b ?? null}
        score={match?.score_b ?? null}
        isWinner={!!match?.winner_id && match.winner_id === match.team_b}
        teamById={teamById}
      />
    </div>
  );
}

function MatchSide({
  teamId,
  score,
  isWinner,
  teamById,
}: {
  teamId: string | null;
  score: number | null;
  isWinner: boolean;
  teamById: Map<string, RosterTeam>;
}) {
  const team = teamId ? teamById.get(teamId) : null;
  return (
    <div
      className={`flex items-center gap-2.5 px-3 py-2.5 ${
        isWinner ? "bg-success/10" : "bg-card"
      }`}
    >
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: team?.color ?? "#94A3B8" }}
      />
      <span
        className={`flex-1 min-w-0 truncate text-sm ${
          isWinner ? "font-bold text-foreground" : "font-medium text-muted"
        }`}
      >
        {team?.name ?? "TBD"}
      </span>
      {score != null && (
        <span className="font-mono text-sm font-bold text-foreground shrink-0">
          {score}
        </span>
      )}
    </div>
  );
}
