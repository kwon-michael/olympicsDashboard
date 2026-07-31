"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchRosterData, activeTeamSizes } from "@/lib/roster";
import { fetchSoloResults } from "@/lib/solo";
import { fetchTugData } from "@/lib/tug";
import { fetchDodgeballData } from "@/lib/dodgeball";
import { computeStandings } from "@/lib/standings";
import { fetchTiebreaks, unresolvedTieGroups, type TieGroup } from "@/lib/tiebreak";
import { useAppStore } from "@/lib/store";
import { ordinal } from "@/lib/utils";

/**
 * Notifies the admin that a tie needs settling by an external game. Rendered on
 * the admin dashboard and on every score-entry screen, and it re-checks on the
 * `scores-updated` event — so the prompt appears the moment the result that
 * created the tie is saved, without the admin going looking for it.
 *
 * Self-gating: settling ties is admin-only (/admin/tiebreaks is not a volunteer
 * path), so for anyone else this renders nothing and skips the queries. That
 * keeps it safe to drop on the shared recorder screens volunteers also use.
 */
export function TieAlert({ className }: { className?: string }) {
  const [groups, setGroups] = useState<TieGroup[]>([]);
  const user = useAppStore((s) => s.user);
  const viewAsVolunteer = useAppStore((s) => s.viewAsVolunteer);
  const enabled = user?.role === "admin" && !viewAsVolunteer;

  const check = useCallback(async () => {
    if (!enabled) {
      setGroups([]);
      return;
    }
    const supabase = createClient();
    const [roster, solo, tiebreaks, tug, dodge] = await Promise.all([
      fetchRosterData(supabase),
      fetchSoloResults(supabase),
      fetchTiebreaks(supabase),
      fetchTugData(supabase),
      fetchDodgeballData(supabase),
    ]);
    // Detection runs on the raw boards: once a resolution is applied the tied
    // rows no longer share a rank. Both tournaments are loaded because their
    // points are part of the team totals — a tie has to be spotted on the same
    // numbers the leaderboard shows, or the alert fires on the wrong teams.
    const { rawTeams, rawSolo } = computeStandings(
      roster.teams,
      roster.scores,
      solo,
      tiebreaks,
      {
        tug: tug.matches,
        dodgeball: dodge.matches,
        teamSizes: activeTeamSizes(roster.players),
      }
    );
    setGroups([
      ...unresolvedTieGroups(rawTeams, "teams", tiebreaks),
      ...unresolvedTieGroups(rawSolo, "solo", tiebreaks),
    ]);
  }, [enabled]);

  useEffect(() => {
    check();
    const handler = () => check();
    window.addEventListener("scores-updated", handler);
    return () => window.removeEventListener("scores-updated", handler);
  }, [check]);

  if (groups.length === 0) return null;

  return (
    <Link
      href="/admin/tiebreaks"
      className={`group flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning/[0.07] p-4 transition-colors hover:bg-warning/[0.12] ${className ?? ""}`}
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">
          {groups.length === 1
            ? "A tie needs a tiebreaker"
            : `${groups.length} ties need a tiebreaker`}
        </p>
        <ul className="mt-1 space-y-0.5">
          {groups.map((g) => (
            <li key={`${g.board}:${g.teamKey}`} className="text-xs text-muted">
              <span className="font-medium text-foreground">
                {g.teams.map((t) => t.name).join(", ")}
              </span>{" "}
              are level on {g.points} pts for {ordinal(g.rank)} in the{" "}
              {g.board === "teams" ? "team" : "solo"} standings
            </li>
          ))}
        </ul>
        <p className="mt-1.5 text-xs text-muted">
          Play the external tiebreaker, then record the finishing order — point
          totals stay as they are.
        </p>
      </div>
      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted transition-colors group-hover:text-foreground" />
    </Link>
  );
}
