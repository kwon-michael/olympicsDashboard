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
      "Participants must start their jump from behind the line (on the line counts as a fault)",
      "Distance is measured from the start line to the most proximal body part upon landing (hands included)",
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
      "Participants must stay in their designated line for the entire race",
      "A whistle will signal the start of the race — any movement past the start line before the whistle will count as a false start (false starts will be penalized by being put 5m behind after 2nd false start)",
      "Time is recorded when the participant's torso crosses the finish line",
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
      "Distance of jump is measured from take-off point to most proximal body part upon landing (hands included)",
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
      "Runners must stay in their designated line for the entire race",
      "A whistle will signal the start of the race — any movement past the start line before the whistle will count as a false start",
      "Time is recorded when the participant's torso crosses the finish line",
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
      "Bins are placed at 5m, 10m, and 15m — the further the bin, the more points",
      "Participants can choose where to aim each ball in whichever order they want",
      "Hands and feet cannot cross over the throw line",
      "All throws must be completed in X time",
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

/* ------------------------------------------------------------------ */
/*  Team Events                                                        */
/* ------------------------------------------------------------------ */

export const teamEvents: EventRule[] = [
  {
    slug: "7-legged-race",
    name: "7-Legged Race",
    category: "Coordination",
    type: "team",
    scoringInput: "time",
    description:
      "Teams are tied together at the ankles and must move as one connected unit to cross the finish line first. Move together with good communication and rhythm or else you won't move at all.",
    icon: Footprints,
    color: "#3B82F6",
    participants: "Full team (tied together)",
    equipment: [
      "Rope or straps for ankle ties",
      "Stopwatch (one per team)",
      "Whistle",
    ],
    rules: [
      "2–3 teams race simultaneously in parallel lines",
      "All team members stand in a line and are tied at the ankles with rope",
      "Teams are given 2 minutes to discuss strategy before the race begins",
      "A whistle blast signals the start of the race",
      "The team's time is recorded when the last tied member crosses the finish line",
    ],
    setup: [
      "Mark parallel lines with clear start and finish lines",
      "Assign one time-keeper per team, stationed at the finish line",
      "Ensure ropes/straps are secure but not painfully tight",
    ],
  },
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
      "When a player loses their tail (towel), the entire team will leave the play area for 5 seconds, and will then re-enter the game without the last player in line",
      "If the chain breaks (e.g., a hand comes off a teammate's shoulder), the team loses their backmost player and their tail",
      "The game ends when one team has no tails remaining — the other team wins",
    ],
    setup: [
      "Mark clear borders for the play area",
      "Clip towels securely so that they can be pulled off with a firm tug",
      "Assign a referee to watch for chain breaks and boundary violations",
    ],
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
      "Balloons",
      "Rubber bands",
    ],
    rules: [
      "Each leg of the race is 75m with a specific condition that must be followed",
      "Players will line up at opposite ends of the boundary lines — complete your leg and hand the baton to your teammate waiting at the other side",
      "The baton can only be handed off once the player passes the boundary line",
      "A whistle will signal the start of the race",
      "Failure to follow a leg's condition results in the team having to repeat that leg",
      "The team's time is recorded when the final runner crosses the finish line with the baton",
    ],
    setup: [
      "Mark each 75m leg with clear start/end lines",
      "Explain and demonstrate each condition before starting",
      "Assign one time-keeper/referee per team at the finish line",
    ],
    conditions: [
      "Leg 1 — Leap Frog: Two players work together — one crouches while the other leapfrogs over them, alternating all the way to the boundary line before the baton is handed off.",
      "Leg 2 — Balloon Between Legs: Players carry a balloon between their knees from one end to the other. If the balloon drops, the player has to count 5 seconds before they can continue again. If the balloon pops, they have to stop, replace it, and start again from the beginning of the leg.",
      "Leg 3 — Elephant Trunk Spins: The player must cross their arms, look down, and spin three times before they can take off and run their leg.",
      "Leg 4 — Balloon Keep-Ups",
      "Leg 5 — Rubber Band Shooting Gallery",
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Exports                                                            */
/* ------------------------------------------------------------------ */

export const allEvents: EventRule[] = [...soloEvents, ...teamEvents];

export function getEventBySlug(slug: string): EventRule | undefined {
  return allEvents.find((e) => e.slug === slug);
}
