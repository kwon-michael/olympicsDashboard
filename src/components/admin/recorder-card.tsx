import { RankBadge } from "@/components/ui/rank-badge";
import { readableTextColor } from "@/lib/colors";

/**
 * The per-team shell used by the score recorders: colour rail, team identity,
 * and the live rank/points the entered values currently produce. Both the solo
 * and team-event recorders render one of these per team, so the header stays in
 * one place and matches the leaderboard's visual language.
 */
export function RecorderCard({
  teamName,
  teamColor,
  rank,
  points,
  unsaved,
  children,
}: {
  teamName: string;
  teamColor: string;
  rank?: number;
  points?: number;
  unsaved?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 pl-5">
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ backgroundColor: teamColor }}
      />

      <div className="mb-3 flex items-center gap-2.5">
        <span
          aria-hidden
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[13px] font-bold"
          style={{
            backgroundColor: teamColor,
            color: readableTextColor(teamColor),
          }}
        >
          {teamName.charAt(0).toUpperCase()}
        </span>
        <span className="font-display min-w-0 flex-1 truncate text-[15px] font-semibold uppercase">
          {teamName}
        </span>

        {unsaved && (
          <span className="shrink-0 text-[11px] font-medium text-warning">
            Unsaved
          </span>
        )}
        {rank !== undefined && <RankBadge rank={rank} />}
        {points !== undefined && (
          <span className="shrink-0 rounded-full border border-border px-2.5 py-1 font-mono text-xs font-semibold tabular-nums">
            {points} pt{points !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {children}
    </div>
  );
}
