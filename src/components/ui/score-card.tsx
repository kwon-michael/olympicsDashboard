"use client";

import { motion } from "framer-motion";
import { RankBadge } from "@/components/ui/rank-badge";
import { cn, formatPoints } from "@/lib/utils";

interface ScoreCardProps {
  teamName: string;
  teamColor: string;
  points: number;
  rank?: number;
  eventName?: string;
  playerName?: string;
  className?: string;
  animate?: boolean;
}

export function ScoreCard({
  teamName,
  teamColor,
  points,
  rank,
  eventName,
  playerName,
  className,
  animate = true,
}: ScoreCardProps) {
  const Wrapper = animate ? motion.div : "div";
  const wrapperProps = animate
    ? {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: { type: "spring" as const, stiffness: 200, damping: 20 },
      }
    : {};

  return (
    <Wrapper
      {...wrapperProps}
      className={cn(
        "relative overflow-hidden bg-card rounded-xl border border-border shadow-sm p-4",
        className
      )}
    >
      {/* Team color accent bar */}
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ backgroundColor: teamColor }}
      />

      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {rank !== undefined && (
            <div className="flex w-7 shrink-0 justify-center">
              <RankBadge rank={rank} />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-display truncate text-sm font-semibold uppercase">
              {teamName}
            </p>
            {playerName && <p className="text-xs text-muted">{playerName}</p>}
            {eventName && <p className="text-xs text-muted">{eventName}</p>}
          </div>
        </div>

        <div className="font-mono text-2xl font-semibold tabular-nums">
          {formatPoints(points)}
        </div>
      </div>
    </Wrapper>
  );
}
