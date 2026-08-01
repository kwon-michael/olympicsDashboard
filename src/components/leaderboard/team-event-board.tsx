"use client";

import { RankBadge } from "@/components/ui/rank-badge";
import { TableCard, Th, TeamCell } from "@/components/leaderboard/table-card";
import { cn } from "@/lib/utils";
import type { EventRule } from "@/lib/events";
import type { TeamEventComponentCell, TeamEventRow } from "@/lib/teamEvents";

/**
 * The per-event board for a recorder-managed team game (Tail Grab, Conditional
 * Relay). Unlike Tug of War and Dodgeball there's no bracket to draw — the
 * result is a single recorded row per team — so the interesting thing to show is
 * *how* each total was arrived at. Columns are derived from the event's own
 * scoring config, so the board follows whatever the rulebook says without
 * needing a per-event layout.
 */
export function TeamEventBoard({
  event,
  rows,
}: {
  event: EventRule;
  rows: TeamEventRow[];
}) {
  const isTimed = event.teamScoring?.method === "rank-by-time";
  // Columns come from the first row: every row is built from the same component
  // list, so they all carry the same cells in the same order.
  const columns = rows[0]?.components ?? [];
  const groups = groupColumns(columns);
  // Grouped components (Tail Grab's two rounds) get a second header row, so the
  // Place/Team/Pts columns have to span both.
  const hasGroups = !isTimed && groups.some((g) => g.name);
  const headerRowSpan = hasGroups ? 2 : undefined;

  return (
    <TableCard>
      <thead>
        {/* With a second header row the rule goes on the group cells, not the
            row — a row border would be drawn straight through the Place/Team/Pts
            cells spanning both rows. */}
        <tr className={hasGroups ? undefined : "border-b border-border"}>
          <Th className="w-16" rowSpan={headerRowSpan}>
            Place
          </Th>
          <Th rowSpan={headerRowSpan}>Team</Th>
          {isTimed ? (
            <Th align="right">Time</Th>
          ) : hasGroups ? (
            groups.map((group, gi) => (
              <Th
                key={group.name ?? gi}
                align="center"
                colSpan={group.items.length}
                scope="colgroup"
                className={cn(
                  "border-b border-border/60 pb-1.5",
                  gi > 0 && "border-l"
                )}
              >
                {group.name ?? "Result"}
              </Th>
            ))
          ) : (
            columns.map((c) => (
              <Th key={c.key} align="right">
                {c.label}
              </Th>
            ))
          )}
          <Th align="right" className="w-16" rowSpan={headerRowSpan}>
            Pts
          </Th>
        </tr>
        {hasGroups && (
          <tr className="border-b border-border">
            {groups.map((group, gi) =>
              group.items.map((c, i) => (
                <Th
                  key={c.key}
                  align="right"
                  className={cn(
                    "pt-1.5",
                    i === 0 && gi > 0 && "border-l border-border/60"
                  )}
                >
                  {c.label}
                </Th>
              ))
            )}
          </tr>
        )}
      </thead>
      <tbody className="divide-y divide-border">
        {rows.map((row) => (
          <tr
            key={row.team.id}
            className="transition-colors hover:bg-foreground/[0.02]"
          >
            <td className="px-4 py-3">
              <RankBadge rank={row.rank} />
            </td>
            <td className="px-4 py-3">
              <TeamCell name={row.team.name} color={row.team.color} />
            </td>
            {isTimed ? (
              <td className="px-4 py-3 text-right font-mono tabular-nums">
                {row.time ?? "—"}
              </td>
            ) : (
              row.components.map((cell, i) => (
                <td
                  key={cell.key}
                  className={cn(
                    "px-4 py-3 text-right font-mono tabular-nums",
                    startsGroup(row.components, i) && "border-l border-border/60"
                  )}
                >
                  {cell.display}
                  {cell.points > 0 && (
                    <span className="ml-1.5 text-[11px] text-muted">
                      +{cell.points}
                    </span>
                  )}
                </td>
              ))
            )}
            <td className="px-4 py-3 text-right font-mono text-[15px] font-semibold tabular-nums">
              {row.points}
            </td>
          </tr>
        ))}
      </tbody>
    </TableCard>
  );
}

/** Group the columns by their optional `group` (e.g. "Round 1"), keeping order. */
function groupColumns(
  columns: TeamEventComponentCell[]
): { name?: string; items: TeamEventComponentCell[] }[] {
  const groups: { name?: string; items: TeamEventComponentCell[] }[] = [];
  for (const c of columns) {
    let g = groups.find((x) => x.name === c.group);
    if (!g) {
      g = { name: c.group, items: [] };
      groups.push(g);
    }
    g.items.push(c);
  }
  return groups;
}

/** True when this cell opens a new group and isn't the first column overall. */
function startsGroup(cells: TeamEventComponentCell[], i: number): boolean {
  return i > 0 && cells[i].group !== cells[i - 1].group;
}
