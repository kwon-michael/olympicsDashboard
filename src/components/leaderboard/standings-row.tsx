"use client";

import { motion, useReducedMotion } from "framer-motion";
import { RankBadge } from "@/components/ui/rank-badge";
import { readableTextColor } from "@/lib/colors";
import { cn, formatPoints, ordinal } from "@/lib/utils";
import type { TiebreakMark } from "@/lib/tiebreak";

/**
 * One row of a standings list. Teams here are identified *by colour*, so the
 * colour carries real meaning and gets two dedicated slots — the left rail and
 * the initial swatch — rather than being sprayed over borders and numerals.
 * `share` (0–1) draws the hairline gap-to-leader bar along the bottom edge.
 */
export function StandingsRow({
  rank,
  name,
  color,
  avatarUrl,
  points,
  pointsLabel,
  meta,
  note,
  share,
  tiebreak,
  levelOnPoints,
  orderedBy,
}: {
  /** The number shown. On the team board this is the solo-aware position. */
  rank: number;
  name: string;
  color: string;
  avatarUrl?: string | null;
  points: number;
  pointsLabel: string;
  meta: string;
  note?: string;
  share: number;
  /** Present when this row's rank came out of an external tiebreaker game. */
  tiebreak?: TiebreakMark;
  /** This team's point total is shared with at least one other team. */
  levelOnPoints?: boolean;
  /** Why this row sits where it does among teams level on points. */
  orderedBy?: string;
}) {
  const reduceMotion = useReducedMotion();
  const onPodium = rank <= 3;

  return (
    <motion.li
      layout
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : { type: "spring", stiffness: 320, damping: 30 }
      }
      className={cn(
        "@container relative flex items-center gap-3 py-3 pr-4 pl-5 transition-colors sm:gap-4 sm:pr-5",
        onPodium
          ? "bg-linear-to-r from-foreground/[0.035] to-transparent"
          : "hover:bg-foreground/[0.02]"
      )}
    >
      {/* Team colour rail */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ backgroundColor: color }}
      />

      <div className="flex w-7 shrink-0 justify-center">
        <RankBadge rank={rank} />
      </div>

      <div
        className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl text-[13px] font-bold"
        style={{ backgroundColor: color, color: readableTextColor(color) }}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          name.charAt(0).toUpperCase()
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-display truncate text-[15px] font-semibold uppercase">
            {name}
          </p>
          {tiebreak && (
            <span
              title={
                tiebreak.note
                  ? `Tied on points — ${ordinal(tiebreak.position)} of ${tiebreak.of} in the tiebreaker: ${tiebreak.note}`
                  : `Tied on points — placed ${ordinal(tiebreak.position)} of ${tiebreak.of} in an external tiebreaker game`
              }
              className="shrink-0 rounded-full border border-info/40 bg-info/10 px-1.5 py-px text-[10px] font-semibold tracking-wide text-info uppercase"
            >
              TB {tiebreak.position}/{tiebreak.of}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted">
          {meta}
          {note && (
            <>
              <span aria-hidden className="mx-1.5 text-border">
                ·
              </span>
              <span className="text-gold">{note}</span>
            </>
          )}
          {orderedBy && (
            <>
              <span aria-hidden className="mx-1.5 text-border">
                ·
              </span>
              <span>{orderedBy}</span>
            </>
          )}
          {tiebreak && (
            <>
              <span aria-hidden className="mx-1.5 text-border">
                ·
              </span>
              <span className="text-info">
                Tiebreak {ordinal(tiebreak.position)}
                {tiebreak.note ? ` · ${tiebreak.note}` : ""}
              </span>
            </>
          )}
        </p>
      </div>

      <div className="flex shrink-0 items-baseline gap-1.5">
        {levelOnPoints && (
          <span
            title="Level on points with at least one other team"
            className="font-mono text-base leading-none font-medium text-muted/70"
          >
            <span aria-hidden>=</span>
            <span className="sr-only">Level on points —</span>
          </span>
        )}
        <span className="font-mono text-xl font-semibold tabular-nums">
          {formatPoints(points)}
        </span>
        <span className="text-[10px] tracking-wider text-muted uppercase @max-[22rem]:hidden">
          {pointsLabel}
        </span>
      </div>

      {/* Gap-to-leader bar */}
      <span
        aria-hidden
        className="absolute bottom-0 left-0 h-[2px] motion-safe:transition-[width] motion-safe:duration-500"
        style={{
          width: `${Math.max(share, 0) * 100}%`,
          backgroundColor: color,
          opacity: 0.4,
        }}
      />
    </motion.li>
  );
}
