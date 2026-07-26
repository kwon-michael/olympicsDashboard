"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Captioned, looping explainer for the Tail Grab game.
 * Players are numbered by chain position: 1 = front (the leader, who grabs
 * tails) through 6 = back. Team A's leader snatches Team B's back player's
 * tail; that player is then vacated to the OUT strip and cannot return. The
 * dashed play border shrinks as the sequence progresses.
 */

const PHASES = ["approach", "grab", "eliminate", "aftermath"] as const;
type Phase = (typeof PHASES)[number];

const CAPTIONS: Record<Phase, string> = {
  approach: "1 · Team A's front player (leader) closes in on Team B's back",
  grab: "2 · Snatch! The leader pulls the tail clean off",
  eliminate: "3 · No tail = out — that player must leave the play area",
  aftermath: "4 · They can't return; Team B plays on a player down",
};

const COL_A = "#E94560";
const COL_A_TAIL = "#F8A5B4";
const COL_B = "#3B82F6";
const COL_B_TAIL = "#93C5FD";
const COL_OUT = "#64748B";
const COL_FLAG = "#F5A623";

// Six players per team, arranged in a single horizontal line each.
const CHAIN = 6;
const LEADER = CHAIN - 1; // front / leader is the last (rightmost) index
const SP = 26; // spacing between chained players
const AY = 100;
const BY = 100;

// Base X of each chain's back player (index 0). Team A sits on the left with its
// leader (index 5) facing centre; Team B sits on the right with its back player
// (index 0) nearest Team A — that's the tail Team A's leader can reach.
const A_BACK_X = 40;
const B_BACK_X = 190;

// Per-phase inward shift (both teams squeeze toward centre as the border shrinks).
const A_SHIFT: Record<Phase, number> = {
  approach: 0,
  grab: 8,
  eliminate: 14,
  aftermath: 20,
};
const B_SHIFT: Record<Phase, number> = {
  approach: 0,
  grab: 8,
  eliminate: 14,
  aftermath: 20,
};

const ax = (i: number, p: Phase) => A_BACK_X + i * SP + A_SHIFT[p];
const bx = (i: number, p: Phase) => B_BACK_X + i * SP - B_SHIFT[p];

// number by chain position: front (leader) = 1 … back = 6
const numberFor = (index: number) => CHAIN - index;

const OUT_POS = { x: 336, y: 226 };

const spring = { type: "spring", stiffness: 90, damping: 16 } as const;

export function TailGrabAnimation() {
  const [phaseIndex, setPhaseIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setPhaseIndex((i) => (i + 1) % PHASES.length),
      2300
    );
    return () => clearInterval(id);
  }, []);

  const phase = PHASES[phaseIndex];
  const isOut = phase === "eliminate" || phase === "aftermath";
  // When the back player is out, the chain now starts at the next player (#5).
  const bChainLeft = isOut ? bx(1, phase) : bx(0, phase);

  // Shrinking play border, derived from the chain extents plus a shrinking band.
  const pad = 16;
  const bLeft = ax(0, phase) - pad;
  const bRight = bx(LEADER, phase) + pad;
  const bTop = 42 + phaseIndex * 3;
  const bBottom = 200 - phaseIndex * 4;

  // Tail-bearers (everyone except the leader).
  const aTails = Array.from({ length: LEADER }, (_, i) => i); // 0..4
  const aPlayers = Array.from({ length: CHAIN }, (_, i) => i); // 0..5
  // Team B: index 0 is drawn separately (it's the grabbed/eliminated player).
  const bStaticTails = Array.from({ length: LEADER - 1 }, (_, i) => i + 1); // 1..4
  const bStaticPlayers = Array.from({ length: CHAIN - 1 }, (_, i) => i + 1); // 1..5

  return (
    <div>
      {/* Numbering key */}
      <p className="text-xs text-muted mb-2">
        Players are numbered by chain position —{" "}
        <span className="font-semibold text-foreground">1</span> is the front
        (the leader, who grabs tails, marked{" "}
        <span style={{ color: COL_FLAG }}>▲</span>) through{" "}
        <span className="font-semibold text-foreground">6</span> at the back.
        Only players 2–6 wear tails.
      </p>

      <div className="rounded-xl border border-border overflow-hidden">
        <svg
          viewBox="0 0 360 248"
          className="w-full block"
          style={{ background: "#132a43" }}
        >
          {/* field lines */}
          {[50, 100, 150].map((y) => (
            <line key={y} x1={0} y1={y} x2={360} y2={y} stroke="#fff" strokeOpacity={0.04} />
          ))}

          {/* OUT strip along the bottom, clearly below the play area */}
          <rect
            x={228}
            y={214}
            width={128}
            height={28}
            rx={6}
            fill="#ffffff"
            fillOpacity={0.04}
            stroke={COL_OUT}
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
          <text x={244} y={231} fontSize={9} fontWeight={700} fill={COL_OUT}>
            OUT — can&apos;t return
          </text>

          {/* Shrinking play border */}
          <motion.rect
            fill="none"
            stroke={COL_FLAG}
            strokeWidth={2.5}
            strokeDasharray="9 8"
            rx={12}
            animate={{ x: bLeft, y: bTop, width: bRight - bLeft, height: bBottom - bTop }}
            transition={spring}
          />

          {/* ---- Team A ---- */}
          <motion.line
            stroke={COL_A}
            strokeWidth={6}
            strokeOpacity={0.35}
            strokeLinecap="round"
            animate={{ x1: ax(0, phase), y1: AY, x2: ax(LEADER, phase), y2: AY }}
            transition={spring}
          />
          {aTails.map((i) => (
            <motion.rect
              key={`a-tail-${i}`}
              width={15}
              height={10}
              rx={3}
              fill={COL_A_TAIL}
              animate={{ x: ax(i, phase) - 20, y: AY - 5 }}
              transition={spring}
            />
          ))}
          {aPlayers.map((i) => (
            <Player
              key={`a-${i}`}
              cx={ax(i, phase)}
              cy={AY}
              fill={COL_A}
              label={numberFor(i)}
            />
          ))}
          <LeaderFlag cx={ax(LEADER, phase)} cy={AY} />

          {/* ---- Team B (leader + tail-bearers #2–#5 stay) ---- */}
          <motion.line
            stroke={COL_B}
            strokeWidth={6}
            strokeOpacity={0.35}
            strokeLinecap="round"
            animate={{ x1: bChainLeft, y1: BY, x2: bx(LEADER, phase), y2: BY }}
            transition={spring}
          />
          {bStaticTails.map((i) => (
            <motion.rect
              key={`b-tail-${i}`}
              width={15}
              height={10}
              rx={3}
              fill={COL_B_TAIL}
              animate={{ x: bx(i, phase) - 20, y: BY - 5 }}
              transition={spring}
            />
          ))}
          {bStaticPlayers.map((i) => (
            <Player
              key={`b-${i}`}
              cx={bx(i, phase)}
              cy={BY}
              fill={COL_B}
              label={numberFor(i)}
            />
          ))}
          <LeaderFlag cx={bx(LEADER, phase)} cy={BY} />

          {/* Grabbed tail — present until the snatch, then gone */}
          <motion.rect
            width={15}
            height={10}
            rx={3}
            fill={COL_B_TAIL}
            animate={{
              x: bx(0, phase) - 20,
              y: BY - 5,
              opacity: phase === "approach" ? 1 : 0,
            }}
            transition={spring}
          />

          {/* Snatch spark at the contact point */}
          <motion.g
            animate={{ opacity: phase === "grab" ? 1 : 0 }}
            transition={{ duration: 0.25 }}
          >
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
              <line
                key={deg}
                x1={180}
                y1={100}
                x2={180 + 13 * Math.cos((deg * Math.PI) / 180)}
                y2={100 + 13 * Math.sin((deg * Math.PI) / 180)}
                stroke={COL_FLAG}
                strokeWidth={2.5}
                strokeLinecap="round"
              />
            ))}
          </motion.g>

          {/* The eliminated Team B player (#6) — travels to OUT and greys out */}
          <Player
            cx={isOut ? OUT_POS.x : bx(0, phase)}
            cy={isOut ? OUT_POS.y : BY}
            fill={isOut ? COL_OUT : COL_B}
            label={numberFor(0)}
            opacity={isOut ? 0.9 : 1}
          />
        </svg>
      </div>

      {/* Phase caption */}
      <div className="mt-3 min-h-[2.5rem] flex items-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={phase}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="text-sm font-medium text-foreground"
          >
            {CAPTIONS[phase]}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Colour legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full" style={{ background: COL_A }} />
          Team A
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full" style={{ background: COL_B }} />
          Team B
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-4 h-2.5 rounded-sm" style={{ background: COL_A_TAIL }} />
          Tail
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full" style={{ background: COL_OUT }} />
          Eliminated
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="w-4 h-2.5 rounded-sm border-2 border-dashed"
            style={{ borderColor: COL_FLAG }}
          />
          Shrinking border
        </span>
      </div>
    </div>
  );
}

/** A numbered player token (circle + centered number), animated to its spot. */
function Player({
  cx,
  cy,
  fill,
  label,
  opacity = 1,
}: {
  cx: number;
  cy: number;
  fill: string;
  label: number;
  opacity?: number;
}) {
  return (
    <>
      <motion.circle
        r={8}
        stroke="#fff"
        strokeWidth={2}
        animate={{ cx, cy, fill, opacity }}
        transition={spring}
      />
      <motion.text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={9}
        fontWeight={700}
        fill="#fff"
        style={{ pointerEvents: "none" }}
        animate={{ x: cx, y: cy, opacity }}
        transition={spring}
      >
        {label}
      </motion.text>
    </>
  );
}

/** Gold pennant marking the front (leader) of a chain. */
function LeaderFlag({ cx, cy }: { cx: number; cy: number }) {
  return (
    <motion.g animate={{ x: cx }} transition={spring}>
      <line x1={0} y1={cy - 11} x2={0} y2={cy - 24} stroke={COL_FLAG} strokeWidth={2} />
      <polygon
        points={`0,${cy - 24} 11,${cy - 20.5} 0,${cy - 17}`}
        fill={COL_FLAG}
      />
    </motion.g>
  );
}
