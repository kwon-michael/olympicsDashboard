"use client";

import type { RosterTeam } from "@/lib/types";
import type { TugData } from "@/lib/tug";
import { TournamentBracket } from "@/components/tournament/tournament-bracket";

/** Tug of War playoff bracket — thin wrapper over the shared tournament view. */
export function TugBracket({ teams, tug }: { teams: RosterTeam[]; tug: TugData }) {
  return <TournamentBracket teams={teams} data={tug} />;
}
