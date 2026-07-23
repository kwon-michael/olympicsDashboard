"use client";
import { SkeletonList } from "@/components/ui/skeleton";

import { useEffect, useState } from "react";
import { Swords } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageTransition } from "@/components/ui/page-transition";
import { fetchRosterData } from "@/lib/roster";
import { fetchTugData, type TugData } from "@/lib/tug";
import { TugGroups } from "@/components/tug/tug-groups";
import { TugBracket } from "@/components/tug/tug-bracket";
import type { RosterTeam } from "@/lib/types";

export default function TugOfWarPage() {
  const [teams, setTeams] = useState<RosterTeam[]>([]);
  const [tug, setTug] = useState<TugData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const [roster, t] = await Promise.all([
        fetchRosterData(supabase),
        fetchTugData(supabase),
      ]);
      setTeams(roster.teams);
      setTug(t);
      setLoading(false);
    };
    load();
  }, []);

  const locked = tug?.state?.groups_locked ?? false;

  return (
    <PageTransition className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center">
          <Swords className="w-6 h-6 text-indigo-500" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">
            TUG OF WAR
          </h1>
          <p className="text-muted mt-0.5">
            Group stage &amp; playoff bracket
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <SkeletonList rows={6} />
        </div>
      ) : !locked || !tug ? (
        <div className="text-center py-20">
          <Swords className="w-16 h-16 text-muted mx-auto mb-4" />
          <h3 className="font-display text-xl font-bold text-foreground mb-2">
            NOT STARTED YET
          </h3>
          <p className="text-muted">
            Groups are decided once the solo events wrap up. Check back soon!
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          <section>
            <h2 className="font-display text-lg font-bold text-foreground mb-4">
              GROUP STAGE
            </h2>
            <TugGroups teams={teams} tug={tug} />
          </section>
          <section>
            <h2 className="font-display text-lg font-bold text-foreground mb-4">
              PLAYOFF BRACKET
            </h2>
            <TugBracket teams={teams} tug={tug} />
          </section>
        </div>
      )}
    </PageTransition>
  );
}
