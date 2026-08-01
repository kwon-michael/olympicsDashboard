import { cn } from "@/lib/utils";

/**
 * The shared surface for the leaderboard's tabular views (per-event solo
 * results, the team-game breakdowns): one card, hairline-divided rows, and the
 * table itself free to scroll sideways when a board carries more columns than
 * fit — the page body never does.
 */
export function TableCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">{children}</table>
      </div>
    </div>
  );
}

export function Th({
  children,
  align = "left",
  className,
  colSpan,
  rowSpan,
  scope = "col",
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  colSpan?: number;
  rowSpan?: number;
  scope?: "col" | "colgroup";
}) {
  return (
    <th
      scope={scope}
      colSpan={colSpan}
      rowSpan={rowSpan}
      className={cn(
        "px-4 py-3 text-[11px] font-semibold tracking-wider text-muted uppercase",
        align === "right"
          ? "text-right"
          : align === "center"
            ? "text-center"
            : "text-left",
        className
      )}
    >
      {children}
    </th>
  );
}

/** Team name preceded by its colour — the colour is the team's identity here. */
export function TeamCell({ name, color }: { name: string; color: string }) {
  return (
    <span className="flex items-center gap-2">
      <span
        aria-hidden
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="truncate font-medium">{name}</span>
    </span>
  );
}
