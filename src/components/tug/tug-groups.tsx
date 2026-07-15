"use client";

import type { RosterTeam } from "@/lib/types";
import type { TugData } from "@/lib/tug";
import { TournamentGroups } from "@/components/tournament/tournament-groups";

/** Tug of War group pools — thin wrapper over the shared tournament view. */
export function TugGroups({ teams, tug }: { teams: RosterTeam[]; tug: TugData }) {
  return <TournamentGroups teams={teams} data={tug} />;
}
