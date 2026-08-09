"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Coins, Swords } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { readableTextColor } from "@/lib/colors";
import { fetchTugData } from "@/lib/tug";
import { fetchDodgeballData } from "@/lib/dodgeball";
import { stageLabel } from "@/lib/wagers";
import { PageTransition } from "@/components/ui/page-transition";
import { SkeletonList } from "@/components/ui/skeleton";
import type { RosterTeam, Wager } from "@/lib/types";

// Admin-only ledger of every captain playoff wager and its point outcome. This
// is the audit trail the owner asked for — richer than a raw activity-log line,
// since a wager's whole lifecycle lives on the row (see supabase/wagers.sql).
export default function AdminWagersPage() {
  const [wagers, setWagers] = useState<Wager[]>([]);
  const [teamsById, setTeamsById] = useState<Map<string, RosterTeam>>(new Map());
  const [stageByMatch, setStageByMatch] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [wagersRes, teamsRes, tug, dodge] = await Promise.all([
        supabase.from("wagers").select("*").order("created_at", { ascending: false }),
        supabase.from("roster_teams").select("*").order("sort_order"),
        fetchTugData(supabase),
        fetchDodgeballData(supabase),
      ]);

      setWagers((wagersRes.data as Wager[]) ?? []);
      setTeamsById(new Map(((teamsRes.data as RosterTeam[]) ?? []).map((t) => [t.id, t])));

      const stages = new Map<string, string>();
      for (const m of tug.matches) stages.set(`tug:${m.id}`, m.stage);
      for (const m of dodge.matches) stages.set(`dodgeball:${m.id}`, m.stage);
      setStageByMatch(stages);
      setLoading(false);
    }
    load();
  }, []);

  const totals = useMemo(() => {
    let won = 0;
    let lost = 0;
    let pending = 0;
    for (const w of wagers) {
      if (w.status === "won") won += 1;
      else if (w.status === "lost") lost += 1;
      else if (w.status === "pending") pending += 1;
    }
    return { won, lost, pending, net: won - lost };
  }, [wagers]);

  const teamName = (id: string) => teamsById.get(id)?.name ?? "—";
  const teamColor = (id: string) => teamsById.get(id)?.color ?? "#94A3B8";

  return (
    <PageTransition>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Admin
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center">
            <Coins className="w-6 h-6 text-gold" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              WAGER HISTORY
            </h1>
            <p className="text-sm text-muted">
              Captain playoff bets and the team points won or lost
            </p>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <SummaryCard label="Total bets" value={wagers.length} />
          <SummaryCard label="Won" value={totals.won} tone="success" />
          <SummaryCard label="Lost" value={totals.lost} tone="danger" />
          <SummaryCard label="Pending" value={totals.pending} tone="warning" />
        </div>

        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {loading ? (
            <SkeletonList rows={6} className="p-4" />
          ) : wagers.length === 0 ? (
            <div className="p-8 text-center text-muted text-sm">
              No wagers have been placed yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted border-b border-border">
                    <th className="px-4 py-3 font-semibold">Team</th>
                    <th className="px-4 py-3 font-semibold">Captain</th>
                    <th className="px-4 py-3 font-semibold">Match</th>
                    <th className="px-4 py-3 font-semibold">Pick</th>
                    <th className="px-4 py-3 font-semibold text-right">Result</th>
                    <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {wagers.map((w) => {
                    const stage = stageByMatch.get(`${w.tournament}:${w.match_id}`);
                    const tournamentLabel = w.tournament === "tug" ? "Tug of War" : "Dodgeball";
                    return (
                      <tr key={w.id} className="hover:bg-background/50">
                        <td className="px-4 py-3">
                          <span
                            className="inline-block text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{
                              backgroundColor: teamColor(w.team_id),
                              color: readableTextColor(teamColor(w.team_id)),
                            }}
                          >
                            {teamName(w.team_id)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted truncate max-w-[10rem]">
                          {w.captain_name ?? "—"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 text-foreground">
                            <Swords className="w-3.5 h-3.5 text-indigo-500" />
                            {tournamentLabel}
                            <span className="text-muted">· {stage ? stageLabel(stage) : "—"}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3">{teamName(w.picked_team_id)}</td>
                        <td className="px-4 py-3 text-right">
                          <ResultCell status={w.status} net={w.net_points} />
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-muted whitespace-nowrap">
                          {new Date(w.settled_at ?? w.created_at).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "danger" | "warning";
}) {
  const color =
    tone === "success"
      ? "text-success"
      : tone === "danger"
      ? "text-danger"
      : tone === "warning"
      ? "text-warning"
      : "text-foreground";
  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <p className={`font-display text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

function ResultCell({ status, net }: { status: string; net: number }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "Pending", cls: "bg-warning/10 text-warning" },
    won: { label: `Won +${net}`, cls: "bg-success/10 text-success" },
    lost: { label: `Lost ${net}`, cls: "bg-danger/10 text-danger" },
    void: { label: "Void", cls: "bg-muted/10 text-muted" },
  };
  const s = map[status] ?? map.pending;
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${s.cls}`}>
      {s.label}
    </span>
  );
}
