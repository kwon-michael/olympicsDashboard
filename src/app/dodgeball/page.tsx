"use client";

import { useEffect, useState } from "react";
import { CircleDot } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageTransition } from "@/components/ui/page-transition";
import { fetchRosterData } from "@/lib/roster";
import { fetchDodgeballData, type DodgeballData } from "@/lib/dodgeball";
import { TournamentGroups } from "@/components/tournament/tournament-groups";
import { TournamentBracket } from "@/components/tournament/tournament-bracket";
import type { RosterTeam } from "@/lib/types";

export default function DodgeballPage() {
  const [teams, setTeams] = useState<RosterTeam[]>([]);
  const [dodge, setDodge] = useState<DodgeballData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const [roster, d] = await Promise.all([
        fetchRosterData(supabase),
        fetchDodgeballData(supabase),
      ]);
      setTeams(roster.teams);
      setDodge(d);
      setLoading(false);
    };
    load();
  }, []);

  const locked = dodge?.state?.groups_locked ?? false;

  return (
    <PageTransition className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center">
          <CircleDot className="w-6 h-6 text-orange-500" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">
            DODGEBALL
          </h1>
          <p className="text-muted mt-0.5">
            Group stage &amp; playoff bracket
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-coral border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !locked || !dodge ? (
        <div className="text-center py-20">
          <CircleDot className="w-16 h-16 text-muted mx-auto mb-4" />
          <h3 className="font-display text-xl font-bold text-foreground mb-2">
            NOT STARTED YET
          </h3>
          <p className="text-muted">
            Groups are decided once Tug of War wraps up. Check back soon!
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          <section>
            <h2 className="font-display text-lg font-bold text-foreground mb-4">
              GROUP STAGE
            </h2>
            <TournamentGroups teams={teams} data={dodge} />
          </section>
          <section>
            <h2 className="font-display text-lg font-bold text-foreground mb-4">
              PLAYOFF BRACKET
            </h2>
            <TournamentBracket teams={teams} data={dodge} />
          </section>
        </div>
      )}
    </PageTransition>
  );
}
