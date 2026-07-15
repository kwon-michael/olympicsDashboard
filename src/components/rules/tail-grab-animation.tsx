"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Captioned, looping explainer for the Tail Grab game.
 * Players are numbered by chain position: 1 = front (the leader, who grabs
 * tails) through 4 = back. Team A's leader snatches a Team B player's tail;
 * that player is then vacated to the OUT strip and cannot return. The dashed
 * play border shrinks as the sequence progresses.
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

const AY = 100;
const BY = 100;

// number by chain position: front (leader) = 1 … back = 4
const numberFor = (index: number) => 4 - index;

// Team A: chain of 4, leader (front) is the rightmost. Moves toward centre.
const A_X: Record<Phase, number[]> = {
  approach: [96, 126, 156, 186],
  grab: [110, 140, 170, 200],
  eliminate: [108, 138, 168, 198],
  aftermath: [106, 136, 166, 196],
};

// Team B: leader (front) rightmost; tail-bearers to the left with tails facing
// Team A. Index 0 is the back player (#4) whose tail gets grabbed.
const B_X: Record<Phase, number[]> = {
  approach: [216, 246, 276, 306],
  grab: [206, 236, 266, 296],
  eliminate: [204, 234, 264, 294],
  aftermath: [200, 230, 260, 290],
};

// Shrinking border per phase: [x, y, width, height]
const BORDER: Record<Phase, [number, number, number, number]> = {
  approach: [12, 12, 336, 196],
  grab: [26, 20, 308, 180],
  eliminate: [42, 28, 276, 162],
  aftermath: [58, 38, 244, 144],
};

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
  const [bx, by, bw, bh] = BORDER[phase];
  const bChainLeft = isOut ? B_X[phase][1] : B_X[phase][0];

  return (
    <div>
      {/* Numbering key */}
      <p className="text-xs text-muted mb-2">
        Players are numbered by chain position —{" "}
        <span className="font-semibold text-foreground">1</span> is the front
        (the leader, who grabs tails, marked{" "}
        <span style={{ color: COL_FLAG }}>▲</span>) through{" "}
        <span className="font-semibold text-foreground">4</span> at the back.
        Only players 2–4 wear tails.
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
            animate={{ x: bx, y: by, width: bw, height: bh }}
            transition={spring}
          />

          {/* ---- Team A ---- */}
          <motion.line
            stroke={COL_A}
            strokeWidth={6}
            strokeOpacity={0.35}
            strokeLinecap="round"
            animate={{ x1: A_X[phase][0], y1: AY, x2: A_X[phase][3], y2: AY }}
            transition={spring}
          />
          {[0, 1, 2].map((i) => (
            <motion.rect
              key={`a-tail-${i}`}
              width={15}
              height={10}
              rx={3}
              fill={COL_A_TAIL}
              animate={{ x: A_X[phase][i] - 20, y: AY - 5 }}
              transition={spring}
            />
          ))}
          {[0, 1, 2, 3].map((i) => (
            <Player
              key={`a-${i}`}
              cx={A_X[phase][i]}
              cy={AY}
              fill={COL_A}
              label={numberFor(i)}
            />
          ))}
          <LeaderFlag cx={A_X[phase][3]} cy={AY} />

          {/* ---- Team B (leader + tail-bearers #2 and #3 stay) ---- */}
          <motion.line
            stroke={COL_B}
            strokeWidth={6}
            strokeOpacity={0.35}
            strokeLinecap="round"
            animate={{ x1: bChainLeft, y1: BY, x2: B_X[phase][3], y2: BY }}
            transition={spring}
          />
          {[1, 2].map((i) => (
            <motion.rect
              key={`b-tail-${i}`}
              width={15}
              height={10}
              rx={3}
              fill={COL_B_TAIL}
              animate={{ x: B_X[phase][i] - 20, y: BY - 5 }}
              transition={spring}
            />
          ))}
          {[1, 2, 3].map((i) => (
            <Player
              key={`b-${i}`}
              cx={B_X[phase][i]}
              cy={BY}
              fill={COL_B}
              label={numberFor(i)}
            />
          ))}
          <LeaderFlag cx={B_X[phase][3]} cy={BY} />

          {/* Grabbed tail — present until the snatch, then gone */}
          <motion.rect
            width={15}
            height={10}
            rx={3}
            fill={COL_B_TAIL}
            animate={{
              x: B_X[phase][0] - 20,
              y: BY - 5,
              opacity: phase === "approach" ? 1 : 0,
            }}
            transition={spring}
          />

          {/* Snatch spark */}
          <motion.g
            animate={{ opacity: phase === "grab" ? 1 : 0 }}
            transition={{ duration: 0.25 }}
          >
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
              <line
                key={deg}
                x1={203}
                y1={100}
                x2={203 + 13 * Math.cos((deg * Math.PI) / 180)}
                y2={100 + 13 * Math.sin((deg * Math.PI) / 180)}
                stroke={COL_FLAG}
                strokeWidth={2.5}
                strokeLinecap="round"
              />
            ))}
          </motion.g>

          {/* The eliminated Team B player (#4) — travels to OUT and greys out */}
          <Player
            cx={isOut ? OUT_POS.x : B_X[phase][0]}
            cy={isOut ? OUT_POS.y : BY}
            fill={isOut ? COL_OUT : COL_B}
            label={4}
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
        r={9}
        stroke="#fff"
        strokeWidth={2}
        animate={{ cx, cy, fill, opacity }}
        transition={spring}
      />
      <motion.text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={10}
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
