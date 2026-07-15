"use client";

import { Trophy } from "lucide-react";
import type { RosterTeam } from "@/lib/types";
import {
  computeGroupStandings,
  type TournamentData,
  type GroupTeamStanding,
} from "@/lib/tournament";

/**
 * Read-only view of the three tournament pools with round-win standings. Rank 1
 * (group winner) and rank 2 (wildcard contender) are highlighted so viewers can
 * see who is advancing. Shared by the Tug of War and Dodgeball views.
 */
export function TournamentGroups({
  teams,
  data,
}: {
  teams: RosterTeam[];
  data: TournamentData;
}) {
  const standings = computeGroupStandings(data.groupMembers, data.matches, teams);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {standings.map((group) => (
        <div
          key={group.label}
          className="bg-card rounded-2xl border border-border overflow-hidden"
        >
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <h3 className="font-display font-bold text-foreground">
              GROUP {group.label}
            </h3>
            <span className="text-xs text-muted">round wins</span>
          </div>
          <div className="p-3 space-y-1.5">
            {group.teams.map((row) => (
              <GroupRow key={row.team.id} row={row} />
            ))}
            {group.teams.length === 0 && (
              <p className="text-xs text-muted text-center py-4">No teams.</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function GroupRow({ row }: { row: GroupTeamStanding }) {
  const advancing = row.rank === 1;
  const contender = row.rank === 2;
  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
        advancing
          ? "bg-success/10"
          : contender
            ? "bg-gold/10"
            : "bg-background"
      }`}
    >
      <span
        className="w-6 text-center text-xs font-mono font-bold shrink-0"
        style={{ color: advancing ? "#22C55E" : "var(--muted, #94A3B8)" }}
      >
        {row.rank}
      </span>
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: row.team.color }}
      />
      <span className="flex-1 min-w-0 truncate text-sm font-semibold text-foreground">
        {row.team.name}
      </span>
      {advancing && <Trophy className="w-3.5 h-3.5 text-success shrink-0" />}
      <span className="font-mono text-sm font-bold text-foreground shrink-0">
        {row.roundWins}
      </span>
    </div>
  );
}
