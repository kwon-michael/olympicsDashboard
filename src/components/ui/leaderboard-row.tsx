"use client";

import { motion } from "framer-motion";
import { cn, getMedalEmoji, formatPoints } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface LeaderboardRowProps {
  rank: number;
  teamName: string;
  teamColor: string;
  teamAvatarUrl?: string | null;
  totalPoints: number;
  eventCount: number;
  previousRank?: number;
  className?: string;
}

export function LeaderboardRow({
  rank,
  teamName,
  teamColor,
  teamAvatarUrl,
  totalPoints,
  eventCount,
  previousRank,
  className,
}: LeaderboardRowProps) {
  const medal = getMedalEmoji(rank);
  const rankChange = previousRank ? previousRank - rank : 0;
  const isTop3 = rank <= 3;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 25 }}
      className={cn(
        "relative flex items-center gap-4 p-4 rounded-xl border transition-all",
        isTop3
          ? "bg-card border-2 shadow-md"
          : "bg-card/50 border-border hover:bg-card",
        rankChange !== 0 && "glow-pulse",
        className
      )}
      style={{
        borderColor: isTop3 ? teamColor : undefined,
      }}
    >
      {/* Rank */}
      <div className="flex items-center justify-center w-12">
        {medal ? (
          <span className={cn("text-2xl", isTop3 && "medal-shimmer")}>
            {medal}
          </span>
        ) : (
          <span className="font-mono text-lg font-bold text-muted">
            {rank}
          </span>
        )}
      </div>

      {/* Team Avatar */}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
        style={{ backgroundColor: teamColor }}
      >
        {teamAvatarUrl ? (
          <img
            src={teamAvatarUrl}
            alt={teamName}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          teamName.charAt(0).toUpperCase()
        )}
      </div>

      {/* Team Info */}
      <div className="flex-1 min-w-0">
        <p className="font-display text-sm font-bold uppercase tracking-wide truncate">
          {teamName}
        </p>
        <p className="text-xs text-muted">
          {eventCount} event{eventCount !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Position Change Indicator */}
      {rankChange !== 0 && (
        <div
          className={cn(
            "flex items-center gap-1 text-xs font-semibold",
            rankChange > 0 ? "text-success" : "text-danger"
          )}
        >
          {rankChange > 0 ? (
            <>
              <TrendingUp className="w-3 h-3" />
              +{rankChange}
            </>
          ) : (
            <>
              <TrendingDown className="w-3 h-3" />
              {rankChange}
            </>
          )}
        </div>
      )}
      {rankChange === 0 && previousRank && (
        <Minus className="w-3 h-3 text-muted" />
      )}

      {/* Points */}
      <div className="text-right">
        <p
          className="font-mono text-xl font-bold"
          style={{ color: teamColor }}
        >
          {formatPoints(totalPoints)}
        </p>
        <p className="text-[10px] text-muted uppercase tracking-wider">
          points
        </p>
      </div>
    </motion.div>
  );
}
