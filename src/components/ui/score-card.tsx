"use client";

import { motion } from "framer-motion";
import { cn, getMedalEmoji, formatPoints } from "@/lib/utils";

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
  const medal = rank ? getMedalEmoji(rank) : "";
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

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {rank && (
            <div className="flex items-center gap-1">
              {medal && <span className="text-xl">{medal}</span>}
              <span className="font-mono text-xs text-muted font-semibold">
                #{rank}
              </span>
            </div>
          )}
          <div>
            <p className="font-display text-sm font-bold uppercase tracking-wide">
              {teamName}
            </p>
            {playerName && (
              <p className="text-xs text-muted">{playerName}</p>
            )}
            {eventName && (
              <p className="text-xs text-muted">{eventName}</p>
            )}
          </div>
        </div>

        <div
          className="font-mono text-2xl font-bold"
          style={{ color: teamColor }}
        >
          {formatPoints(points)}
        </div>
      </div>
    </Wrapper>
  );
}
