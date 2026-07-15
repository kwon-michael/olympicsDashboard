import {
  Ruler,
  Timer,
  Footprints,
  Weight,
  Trash2,
  ShieldAlert,
  Crosshair,
  Swords,
  RotateCcw,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ScoringInput = "time" | "distance" | "points";

/**
 * A single scored input the admin enters for a team-event result.
 *  - "placement": a finishing position (1st, 2nd, …) mapped to points via `placementPoints`
 *  - "tally":     a counted quantity (round wins, eliminations, tails …) worth `pointsEach`
 */
export interface TeamScoreComponent {
  key: string;
  label: string;
  kind: "placement" | "tally";
  /** kind === "placement" — points for each place, index 0 = 1st */
  placementPoints?: number[];
  /** kind === "tally" — points awarded per counted unit */
  pointsEach?: number;
}

/**
 * How a team event's points are derived on the dashboard.
 *  - "rank-by-time":  admin records a time per team; the dashboard ranks teams
 *                     (fastest first) and awards points from `placementScale`.
 *  - "components":    admin enters each component per team; value = sum of components.
 */
export interface TeamScoringConfig {
  method: "rank-by-time" | "components";
  /** method === "rank-by-time" — points by finishing rank, index 0 = 1st */
  placementScale?: number[];
  /** method === "components" */
  components?: TeamScoreComponent[];
}

export interface EventRule {
  slug: string;
  name: string;
  category: string;
  type: "solo" | "team";
  scoringInput: ScoringInput;
  description: string;
  icon: LucideIcon;
  color: string;
  participants: string;
  attempts?: string;
  equipment: string[];
  rules: string[];
  scoring?: string;
  setup: string[];
  tips?: string[];
  conditions?: string[];
  teamScoring?: TeamScoringConfig;
}

/* ------------------------------------------------------------------ */
/*  Helpers – shared across scores page, leaderboard, etc.             */
/* ------------------------------------------------------------------ */

/**
 * Values are stored as integers in the DB:
 *   time     → centiseconds  (12.34s stored as 1234)
 *   distance → centimeters   (3.45m  stored as 345)
 *   points   → raw integer
 */

/** Convert a raw admin input string → integer for DB storage. Returns null on invalid input. */
export function parseInputToDbValue(raw: string, mode: ScoringInput): number | null {
  if (mode === "time") {
    const parts = raw.trim().split(":");
    let totalSeconds: number;
    if (parts.length === 2) {
      const mins = parseInt(parts[0], 10);
      const secs = parseFloat(parts[1]);
      if (isNaN(mins) || isNaN(secs)) return null;
      totalSeconds = mins * 60 + secs;
    } else if (parts.length === 1) {
      totalSeconds = parseFloat(parts[0]);
      if (isNaN(totalSeconds)) return null;
    } else {
      return null;
    }
    if (totalSeconds <= 0) return null;
    return Math.round(totalSeconds * 100); // centiseconds
  }

  if (mode === "distance") {
    const meters = parseFloat(raw);
    if (isNaN(meters) || meters <= 0) return null;
    return Math.round(meters * 100); // centimeters
  }

  // points
  const pts = parseFloat(raw);
  if (isNaN(pts) || pts < 0) return null;
  return Math.round(pts);
}

/** Format an integer DB value → human-readable string */
export function formatDbValue(dbValue: number, mode: ScoringInput): string {
  if (mode === "time") {
    const totalSeconds = dbValue / 100;
    if (totalSeconds >= 60) {
      const mins = Math.floor(totalSeconds / 60);
      const secs = (totalSeconds % 60).toFixed(2);
      return `${mins}:${secs.padStart(5, "0")}`;
    }
    return `${totalSeconds.toFixed(2)}s`;
  }
  if (mode === "distance") {
    const meters = dbValue / 100;
    return `${meters.toFixed(2)}m`;
  }
  return String(dbValue);
}

/** Column header label for leaderboard tables */
export function getUnitLabel(mode: ScoringInput): string {
  if (mode === "time") return "Time";
  if (mode === "distance") return "Distance";
  return "Points";
}

/**
 * Placement points awarded for a finishing rank in a synchronous solo event.
 *   1st = 7, 2nd = 5, 3rd = 3, 4th = 2, 5th = 1, below = 0.
 * (9 participants per solo event.)
 */
export function getSoloPlacementPoints(rank: number): number {
  switch (rank) {
    case 1:
      return 7;
    case 2:
      return 5;
    case 3:
      return 3;
    case 4:
      return 2;
    case 5:
      return 1;
    default:
      return 0;
  }
}

/**
 * Placement points for the timed team relay, awarded by finishing rank.
 *   1st = 15, 2nd = 12, 3rd = 10, 4th = 8, 5th = 6,
 *   6th = 5, 7th = 3, 8th = 2, 9th = 1, 10th+ = 0.
 */
const RELAY_PLACEMENT_POINTS = [15, 12, 10, 8, 6, 5, 3, 2, 1];

export function getRelayPlacementPoints(rank: number): number {
  return RELAY_PLACEMENT_POINTS[rank - 1] ?? 0;
}

/**
 * Compute a team-event result value from component inputs (placements + tallies).
 * `inputs` is keyed by component `key`; blank/invalid entries contribute 0.
 */
export function computeTeamComponentValue(
  components: TeamScoreComponent[],
  inputs: Record<string, string>
): number {
  let total = 0;
  for (const c of components) {
    const raw = (inputs[c.key] ?? "").trim();
    if (raw === "") continue;
    const n = parseInt(raw, 10);
    if (isNaN(n)) continue;
    if (c.kind === "placement") {
      if (n >= 1 && c.placementPoints) {
        total += c.placementPoints[n - 1] ?? 0;
      }
    } else if (n > 0) {
      total += n * (c.pointsEach ?? 0);
    }
  }
  return total;
}

/** Look up the scoring input mode for a given event slug */
export function getScoringInputBySlug(slug: string): ScoringInput {
  const ev = allEvents.find((e) => e.slug === slug);
  return ev?.scoringInput ?? "points";
}

/* ------------------------------------------------------------------ */
/*  Solo Events                                                        */
/* ------------------------------------------------------------------ */

export const soloEvents: EventRule[] = [
  {
    slug: "standing-long-jump",
    name: "Standing Long Jump",
    category: "Field",
    type: "solo",
    scoringInput: "distance",
    description:
      "Launch yourself as far as possible from a standing position and see who can jump the farthest.",
    icon: Ruler,
    color: "#3B82F6",
    participants: "Individual",
    attempts: "2 attempts per participant",
    equipment: ["Measuring tape", "Rake", "Start line marker"],
    rules: [
      "Participants must start their jump from behind the line (starting on the line counts as a fault, and this counts as an attempt)",
      "Take-off must be from both feet at once — no step or hop into the jump",
      "Distance is measured perpendicular from the start line to the most proximal body part upon landing (hands included)",
      "If the participant falls or steps backward after landing, distance is measured to the nearest mark left by any body part",
      "Both attempts are recorded; the best distance counts",
      "No running start permitted — both feet must remain stationary before the jump",
    ],
    setup: [
      "Clearly indicate the start line",
      "Demonstrate the event before participants begin",
      "Assign supporters for measuring distances and raking the landing area before each attempt",
    ],
  },
  {
    slug: "100m",
    name: "100m Sprint",
    category: "Track",
    type: "solo",
    scoringInput: "time",
    description:
      "A straight-line dash testing pure speed. The fastest time from start to finish wins.",
    icon: Timer,
    color: "#E94560",
    participants: "Individual",
    equipment: [
      "Stopwatch (one per runner)",
      "Whistle",
      "Start & finish line markers",
    ],
    rules: [
      "Runners race one at a time and are timed individually",
      "The timekeeper starts the watch on the starter's visual arm-drop signal (not the whistle sound) so every runner is timed the same way",
      "Participants must stay in their designated lane for the entire race",
      "A whistle will signal the start of the race — any movement past the start line before the whistle will count as a false start (false starts will be penalized by being put 5m behind after 2nd false start)",
      "Time is recorded when the participant's torso (chest/shoulders, not the head, arms, or legs) crosses the finish line",
    ],
    setup: [
      "Clearly indicate start and finish lines",
      "Assign one timekeeper per participant, stationed at the finish line with a timer",
    ],
  },
  {
    slug: "triple-jump",
    name: "Triple Jump",
    category: "Field",
    type: "solo",
    scoringInput: "distance",
    description:
      "A hop, skip, and jump sequence covering maximum distance. Rhythm and coordination are key.",
    icon: Footprints,
    color: "#A855F7",
    participants: "Individual",
    attempts: "2 attempts per participant",
    equipment: ["Measuring tape", "Rake", "Start line marker"],
    rules: [
      "2 attempts per participant",
      "Initial hop must be behind the start line (on the line counts as a fault)",
      "The sequence must be hop, step, jump — the hop lands on the same foot used to take off, the step lands on the opposite foot, and the jump lands on both feet; an incorrect foot sequence is a fault",
      "Distance is measured perpendicular from the start line to the most proximal body part upon landing (hands included)",
      "If the participant falls or steps backward after landing, distance is measured to the nearest mark left by any body part",
      "Assign supporters for measuring distances and raking the landing area before each attempt",
    ],
    setup: [
      "Demonstrate event",
    ],
  },
  {
    slug: "200m",
    name: "200m Sprint",
    category: "Track",
    type: "solo",
    scoringInput: "time",
    description:
      "A longer sprint that tests both speed and stamina. The fastest time from start to finish wins.",
    icon: Timer,
    color: "#F5A623",
    participants: "Individual",
    equipment: [
      "Stopwatch (one per runner)",
      "Whistle",
      "Start & finish line markers",
    ],
    rules: [
      "Runners race one at a time and are timed individually",
      "The timekeeper starts the watch on the starter's visual arm-drop signal (not the whistle sound) so every runner is timed the same way",
      "Runners must stay in their designated lane for the entire race",
      "A whistle will signal the start of the race — any movement past the start line before the whistle will count as a false start (false starts will be penalized by being put 5m behind after 2nd false start)",
      "Time is recorded when the participant's torso (chest/shoulders, not the head, arms, or legs) crosses the finish line",
    ],
    setup: [
      "Clearly indicate start and finish lines",
      "Assign one timekeeper per participant, stationed at the finish line with a timer",
    ],
  },
  {
    slug: "shotput",
    name: "Shotput",
    category: "Field",
    type: "solo",
    scoringInput: "distance",
    description:
      "Put the ball as far as possible using an open-palm motion. Strength and form combined will send it the distance.",
    icon: Weight,
    color: "#22C55E",
    participants: "Individual",
    equipment: [
      "Shot put ball",
      "Tape measure",
      "Throw line marker",
    ],
    rules: [
      "The shot must be put with one hand only — no two-handed throws",
      "The throw must be made with an open palm — no gripping or throwing overhand",
      "The participant must release the shot from behind the throw line",
      "Distance of the throw is measured from the start line to where the shot first lands and rolls to a stop",
      "No running start permitted — both feet must remain stationary before the throw",
    ],
    setup: [],
  },
  {
    slug: "garbage-basketball",
    name: "Garbage Basketball",
    category: "Accuracy",
    type: "solo",
    scoringInput: "points",
    description:
      "Toss balls of varying sizes into bins at different distances and try to score as many points as you can before time runs out.",
    icon: Trash2,
    color: "#EC4899",
    participants: "Individual",
    equipment: [
      "3 bins (trash cans or buckets)",
      "5 balls of different sizes and weights",
      "Throw line marker",
      "Stopwatch",
    ],
    rules: [
      "Each participant receives 5 balls of different sizes and weights",
      "Bins are placed at 5m, 10m, and 15m and score 1, 3, and 5 points respectively — the further the bin, the more points",
      "A ball only counts if it comes to rest inside a bin; if it bounces out it does not count",
      "Participants can choose where to aim each ball in whichever order they want",
      "Each of the 5 balls may be thrown once — retrieved or missed balls may not be re-thrown",
      "Hands and feet cannot cross over the throw line (a throw made while touching or crossing the line scores zero)",
      "All throws must be completed within 60 seconds",
      "Missed throws score zero",
    ],
    setup: [
      "Clearly indicate the throw line",
      "Place three bins at ~5m, ~10m, and ~15m from the throw line",
      "Demonstrate the event and explain scoring before starting",
      "Assign someone to collect missed balls and return them to the throw line",
    ],
  },
];

/**
 * Rules that apply to every solo event. Rendered as a shared "General Solo
 * Rules" section on each solo event page so they don't have to be repeated in
 * each event's own rule list.
 */
export const soloGeneralRules: string[] = [
  "Each team enters exactly one participant per solo event, and no participant may compete in more than one solo event — so every team member takes part",
  "Tie-breaker: if two or more participants record an identical result, they share the higher placement and its points, and the placement(s) directly below are skipped (e.g., two tied for 1st each earn 1st-place points and the next competitor places 3rd)",
  "The assigned event judge's decision is final; all measurements and times are confirmed by two officials before being recorded",
  "Results are recorded to a fixed precision — distances to the nearest centimeter and times to the nearest hundredth of a second",
];

/* ------------------------------------------------------------------ */
/*  Team Events                                                        */
/* ------------------------------------------------------------------ */

export const teamEvents: EventRule[] = [
  {
    slug: "tail-grab",
    name: "Tail Grab",
    category: "Strategy",
    type: "team",
    scoringInput: "points",
    description:
      "Teams arrange themselves in a line formation and try to snatch towels from opponents while protecting their own. This game requires integrity and honesty from all players.",
    icon: ShieldAlert,
    color: "#F43F5E",
    participants: "Full team (4+ players per team)",
    equipment: [
      "Towels (one per player, except the leader)",
      "Clips or clothespins",
      "Border markers",
    ],
    rules: [
      "All players will line up single file with hands on the shoulders of the teammate in front",
      "The 2nd, 3rd, and 4th player in line each have a towel clipped onto the back of their shirt so it visibly sticks out",
      "The 1st player (line leader) has their hands free — their job is to grab the opposing team's towels",
      "The play area is enclosed by a border that shrinks at set intervals as the game goes on, squeezing the teams closer together and forcing the action",
      "The moment a player's tail (towel) is pulled off, that player is out — they must leave the play area immediately and cannot rejoin for the rest of the game",
      "Any player who steps or is pushed outside the shrinking border is out and must leave the play area",
      "If the chain breaks (e.g., a hand comes off a teammate's shoulder), the backmost player is out and must leave the play area",
      "The game ends when one team has no tails remaining — the other team wins",
    ],
    setup: [
      "Mark clear borders for the play area using movable markers (e.g., cones) so the border can be drawn inward as the game goes on",
      "Decide the shrink interval ahead of time (e.g., move the border in every 60 seconds) and assign someone to move the markers",
      "Clip towels securely so that they can be pulled off with a firm tug",
      "Assign a referee to watch for chain breaks and boundary violations",
    ],
    scoring:
      "Two rounds of competition with independent placements (scored each round). Each tail grabbed = 1 point (2 points per tail in round 2). Placement each round: 1st = 5, 2nd = 3, 3rd = 2, 4th = 1.",
    teamScoring: {
      method: "components",
      components: [
        {
          key: "r1Placement",
          label: "Round 1 Placement",
          kind: "placement",
          placementPoints: [5, 3, 2, 1],
        },
        { key: "r1Tails", label: "Round 1 Tails", kind: "tally", pointsEach: 1 },
        {
          key: "r2Placement",
          label: "Round 2 Placement",
          kind: "placement",
          placementPoints: [5, 3, 2, 1],
        },
        { key: "r2Tails", label: "Round 2 Tails (×2)", kind: "tally", pointsEach: 2 },
      ],
    },
  },
  {
    slug: "dodgeball",
    name: "Dodgeball",
    category: "Agility",
    type: "team",
    scoringInput: "points",
    description:
      "Two teams face off — throw, dodge, and catch your way to victory. Hit opponents to eliminate them, or catch a throw to bring a teammate back.",
    icon: Crosshair,
    color: "#F5A623",
    participants: "Full team",
    equipment: [
      "Soft dodgeballs (6–8)",
      "Centerline marker",
      "Boundary markers",
    ],
    rules: [
      "Start on opposite sides of the centerline",
      "Wait for a whistle to start the game; only then can players run towards the balls in the middle of the court",
      "A player is eliminated if hit by a thrown ball before it bounces",
      "Headshots do not count; hits must be from the neck downwards",
      "Catching a thrown ball eliminates the thrower and allows one eliminated teammate to return on your side",
      "The team with more players remaining wins the round",
    ],
    setup: [
      "Mark the centerline and side boundaries clearly",
      "Place balls along the centerline for a rush at the start",
      "Assign referees to monitor eliminations and boundary violations",
    ],
    scoring:
      "Recalculated pools of 3 (based on Tug of War), each match is 3 rounds; after pool play, matches are 1-round sudden death. Opponent elimination = 1 point. Round win = 1 point. Final placement: 1st = 5, 2nd = 3, 3rd = 2, 4th = 1.",
    teamScoring: {
      method: "components",
      components: [
        {
          key: "placement",
          label: "Final Placement",
          kind: "placement",
          placementPoints: [5, 3, 2, 1],
        },
        { key: "roundWins", label: "Round Wins", kind: "tally", pointsEach: 1 },
        { key: "eliminations", label: "Eliminations", kind: "tally", pointsEach: 1 },
      ],
    },
  },
  {
    slug: "tug-of-war",
    name: "Tug of War",
    category: "Strength",
    type: "team",
    scoringInput: "points",
    description:
      "Two teams grab a single rope and pull with all their might. The team that drags the center marker past their line proves their strength.",
    icon: Swords,
    color: "#6366F1",
    participants: "Full team",
    equipment: [
      "Heavy-duty tug-of-war rope",
      "Center marker (ribbon or tape)",
      "Line markers",
    ],
    rules: [
      "Teams line up on opposite ends of the rope with an equal number of pullers",
      "The rope's center marker starts above the halfway line",
      "On the whistle, both teams pull — the team that drags the center marker past their side's line wins",
      "Players may not wrap the rope around any body part",
      "Sitting down or lying down to anchor is not permitted",
      "If the rope is dropped by an entire team, the other team wins automatically",
    ],
    setup: [
      "Mark the center line and each team's target line (approximately 2–3m from the center)",
      "Tie a visible marker at the rope's midpoint",
      "Ensure the ground is even and safe for footing on both sides",
    ],
    scoring:
      "Three pools of 3 teams, each match is 3 rounds; after pool play, matches are 1-round sudden death. Round win = 1 point. Final placement: 1st = 5, 2nd = 3, 3rd = 2, 4th = 1.",
    teamScoring: {
      method: "components",
      components: [
        {
          key: "placement",
          label: "Final Placement",
          kind: "placement",
          placementPoints: [5, 3, 2, 1],
        },
        { key: "roundWins", label: "Round Wins", kind: "tally", pointsEach: 1 },
      ],
    },
  },
  {
    slug: "conditioned-relay",
    name: "Conditional Relay",
    category: "Track",
    type: "team",
    scoringInput: "time",
    description:
      "A relay race where each leg comes with a unique condition. This is where real teamwork is put to the test.",
    icon: RotateCcw,
    color: "#22C55E",
    participants: "Full team (one runner per leg)",
    equipment: [
      "Baton or handoff object",
      "Whistle",
      "Stopwatch",
      "Leg markers",
      "Rope (for ankle ties)",
      "Blindfold",
      "Fruit roll-up snacks",
      "Cardboard pieces",
      "Ball and target",
      "Camping chair",
    ],
    rules: [
      "Each leg of the race is 35m with a specific condition that must be followed",
      "Players will line up at opposite ends of the boundary lines — complete your leg and hand the baton to your teammate waiting at the other side",
      "The baton can only be handed off once the player passes the boundary line",
      "A whistle will signal the start of the race",
      "Failure to follow a leg's condition results in the team having to repeat that leg",
      "The team's time is recorded when the final runner crosses the finish line with the baton",
    ],
    setup: [
      "Mark each 35m leg with clear start/end lines and 3 lanes",
      "Explain and demonstrate each condition before starting",
      "Assign one time-keeper/referee per team at the finish line",
    ],
    conditions: [
      "Leg 1 — Three-Legged Race: Two players work together — tie your ankles together with a rope and walk to the boundary line.",
      "Leg 2 — Blindfold Feed: The runner heads to the other side towards their blindfolded partner, who must feed them a fruit roll-up snack as fast as possible; then run to the next station alongside the eater.",
      "Leg 3 — Cardboard Walking: Two people try to reach the other end using only the cardboard pieces given. No other body part may touch the grass.",
      "Leg 4 — Target Toss: One person has a target and the other has a ball; the person with the ball must hit the target. The target holder chooses how far they stand. If the ball hits the target, they advance to the target holder; if it misses, the thrower retrieves the ball and the target holder may reposition at any time.",
      "Leg 5 — Camping Chair Carry: Carry the camping chair to complete the final leg.",
    ],
    scoring:
      "Timed event — the dashboard ranks teams from fastest to slowest and awards points by placement: 1st = 15, 2nd = 12, 3rd = 10, 4th = 8, 5th = 6, 6th = 5, 7th = 3, 8th = 2, 9th = 1.",
    teamScoring: {
      method: "rank-by-time",
      placementScale: [15, 12, 10, 8, 6, 5, 3, 2, 1],
    },
  },
];

/* ------------------------------------------------------------------ */
/*  Exports                                                            */
/* ------------------------------------------------------------------ */

export const allEvents: EventRule[] = [...soloEvents, ...teamEvents];

export function getEventBySlug(slug: string): EventRule | undefined {
  return allEvents.find((e) => e.slug === slug);
}
