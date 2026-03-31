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

export interface EventRule {
  slug: string;
  name: string;
  category: string;
  type: "solo" | "team";
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
}

export const soloEvents: EventRule[] = [
  {
    slug: "standing-long-jump",
    name: "Standing Long Jump",
    category: "Field",
    type: "solo",
    description:
      "Launch yourself as far as possible from a standing position. Explosive power and technique determine how far you go.",
    icon: Ruler,
    color: "#3B82F6",
    participants: "Individual",
    attempts: "2 attempts per participant",
    equipment: ["Measuring tape", "Rake", "Start line marker"],
    rules: [
      "Jumper must start behind the line — stepping on the line counts as a fault",
      "Distance is measured from the start line to the body part closest to it upon landing",
      "Both attempts are recorded; the best distance counts",
      "No running start permitted — both feet must remain stationary before the jump",
    ],
    setup: [
      "Clearly indicate the start line",
      "Demonstrate the event before participants begin",
      "Assign supporters for measuring distances and raking the landing area",
    ],
    tips: [
      "Swing your arms back before launching forward for extra momentum",
      "Land with both feet and try to fall forward, not backward",
    ],
  },
  {
    slug: "100m",
    name: "100m Sprint",
    category: "Track",
    type: "solo",
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
      "Runners must stay in their designated lane for the entire race",
      "A whistle blast signals the start — any movement before the whistle is a false start",
      "Time is recorded when the runner's torso crosses the finish line",
    ],
    setup: [
      "Clearly indicate start and finish lines",
      "Assign one time-keeper per runner, stationed at the finish line with a timer",
    ],
    scoring: "Fastest time wins. Times recorded to the nearest tenth of a second.",
  },
  {
    slug: "triple-jump",
    name: "Triple Jump",
    category: "Field",
    type: "solo",
    description:
      "A hop, skip, and jump sequence covering maximum distance. Rhythm and coordination are key.",
    icon: Footprints,
    color: "#A855F7",
    participants: "Individual",
    attempts: "2 attempts per participant",
    equipment: ["Measuring tape", "Rake", "Start line marker"],
    rules: [
      "The sequence must follow hop → step → jump (takeoff foot, same foot, opposite foot)",
      "The initial hop must begin behind the line — on the line counts as a fault",
      "Distance is measured from the start line to the most proximal body part upon landing (hands included)",
      "Both attempts are recorded; the best distance counts",
    ],
    setup: [
      "Demonstrate the full hop-step-jump sequence before participants begin",
      "Assign supporters for measuring distances and raking the landing area",
    ],
    tips: [
      "Maintain forward momentum through all three phases",
      "Keep your eyes forward and drive your arms upward on the final jump",
    ],
  },
  {
    slug: "200m",
    name: "200m Sprint",
    category: "Track",
    type: "solo",
    description:
      "A longer sprint that tests both speed and stamina. Runners navigate a curve before the home straight.",
    icon: Timer,
    color: "#F5A623",
    participants: "Individual",
    equipment: [
      "Stopwatch (one per runner)",
      "Whistle",
      "Start & finish line markers",
    ],
    rules: [
      "Runners must stay in their designated lane for the entire race",
      "A whistle blast signals the start — any movement before the whistle is a false start",
      "Time is recorded when the runner's torso crosses the finish line",
    ],
    setup: [
      "Clearly indicate start and finish lines",
      "Assign one time-keeper per runner, stationed at the finish line with a timer",
    ],
    scoring: "Fastest time wins. Times recorded to the nearest tenth of a second.",
  },
  {
    slug: "shotput",
    name: "Shotput",
    category: "Field",
    type: "solo",
    description:
      "Put the shot as far as possible using an open-palm pushing motion. Strength and form combine for distance.",
    icon: Weight,
    color: "#22C55E",
    participants: "Individual",
    equipment: [
      "Shot put ball",
      "Tape measure",
      "Pre-measured 5m interval markers",
      "Throw line marker",
    ],
    rules: [
      "The throw must be made with an open palm — no gripping or throwing overhand",
      "The participant must release the shot from behind the throw line",
      "Distance is measured from the throw line to where the shot first lands and rolls to a stop",
      "Stepping over the throw line before the shot lands is a foul",
    ],
    setup: [
      "Mark pre-measured intervals of 5m on the field for quick distance estimation",
      "Demonstrate the correct open-palm putting technique",
      "Assign a supporter with a tape measure for precise distance recording",
    ],
    tips: [
      "Tuck the shot against your neck and push it outward and upward at roughly 45 degrees",
      "Use your legs and core to generate power, not just your arm",
    ],
  },
  {
    slug: "garbage-basketball",
    name: "Garbage Basketball",
    category: "Accuracy",
    type: "solo",
    description:
      "Toss balls of varying sizes into bins at different distances to rack up points. Accuracy under pressure is everything.",
    icon: Trash2,
    color: "#EC4899",
    participants: "Individual",
    equipment: [
      "3 bins (trash cans or buckets)",
      "5 balls: ping-pong, tennis, baseball, volleyball, basketball",
      "Border markers",
      "Throw line marker",
      "Stopwatch",
    ],
    rules: [
      "Hands cannot cross over the throw line and feet cannot cross the border",
      "Each participant receives 5 balls of different sizes and weights",
      "All throws must be completed within 20 seconds (one attempt per ball)",
      "Participants may throw at any bin in any order they choose",
      "Missed throws score zero — no penalty, just no points",
    ],
    setup: [
      "Place three bins at 5m, 10m, and 15m from the throw line",
      "Clearly indicate the border and throw line",
      "Demonstrate the event and explain scoring before starting",
    ],
    scoring:
      "5m bin = 1 point per ball made, 10m bin = 2 points, 15m bin = 3 points. Maximum possible score is 15 points.",
    tips: [
      "Start with the ball you're most confident with to build momentum",
      "Heavier balls (basketball, volleyball) are easier to control at shorter distances",
      "Lighter balls (ping-pong) may be worth saving for close-range bins",
    ],
  },
];

export const teamEvents: EventRule[] = [
  {
    slug: "7-legged-race",
    name: "7-Legged Race",
    category: "Coordination",
    type: "team",
    description:
      "Teams are tied together at the ankles and must move as one unit to cross the finish line first. Communication and rhythm are everything.",
    icon: Footprints,
    color: "#3B82F6",
    participants: "Full team (tied together)",
    equipment: [
      "Rope or straps for ankle ties",
      "Stopwatch (one per team)",
      "Whistle",
    ],
    rules: [
      "2–3 teams race simultaneously in parallel lanes",
      "All team members stand in a line and are tied at the ankles with rope",
      "Teams are given 2 minutes to discuss strategy before the race begins",
      "A whistle blast signals the start of the race",
      "The team's time is recorded when the last tied member crosses the finish line",
    ],
    setup: [
      "Mark parallel lanes with clear start and finish lines",
      "Assign one time-keeper per team, stationed at the finish line",
      "Ensure ropes/straps are secure but not painfully tight",
    ],
    scoring: "Fastest team time wins.",
    tips: [
      "Establish a rhythm — count or chant together to stay synchronized",
      "Start slow and build speed rather than sprinting from the start",
      "The tallest or strongest members can anchor from the center",
    ],
  },
  {
    slug: "tail-grab",
    name: "Tail Grab",
    category: "Strategy",
    type: "team",
    description:
      "Teams form human chains and try to snatch towels from opponents while protecting their own. This game requires integrity and honesty from all players.",
    icon: ShieldAlert,
    color: "#F43F5E",
    participants: "Full team (4+ players per team)",
    equipment: [
      "Towels (one per player, except the leader)",
      "Clips or clothespins",
      "Border markers",
    ],
    rules: [
      "All players line up single file with hands on the shoulders of the teammate in front",
      "The 2nd, 3rd, and 4th players in line each have a towel clipped to the back of their shirt so it visibly sticks out",
      "The 1st player (leader) has their hands free — their job is to grab the opposing team's towels",
      "When a player loses their tail (towel), the entire team exits the play area for 5 seconds, then re-enters without the last player in line",
      "If the chain breaks (a hand comes off a teammate's shoulders), the team loses the backmost player and their tail",
      "The game ends when one team has no tails remaining — the other team wins",
    ],
    setup: [
      "Mark clear borders for the play area",
      "Clip towels securely but so they can be pulled off with a firm tug",
      "Assign a referee to watch for chain breaks and boundary violations",
    ],
    tips: [
      "The leader should be agile and quick — they do all the grabbing",
      "The chain should move as a coordinated unit to protect their tails",
      "Communicate constantly — the leader can't see behind them",
    ],
  },
  {
    slug: "dodgeball",
    name: "Dodgeball",
    category: "Agility",
    type: "team",
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
      "Teams start on opposite sides of the centerline",
      "Players may not cross the centerline at any time",
      "A player is eliminated if hit by a thrown ball before it bounces",
      "Catching a thrown ball eliminates the thrower and allows one eliminated teammate to return",
      "Headshots do not count — the thrower is eliminated instead",
      "The last team with players remaining wins the round",
    ],
    setup: [
      "Mark the centerline and side boundaries clearly",
      "Place balls along the centerline for a rush at the start",
      "Assign referees to monitor eliminations and boundary violations",
    ],
    scoring: "Best of 3 rounds. The team that wins 2 rounds takes the match.",
    tips: [
      "Spread out to make yourselves harder targets",
      "Coordinate throws to overwhelm a single opponent",
      "Keep at least one good catcher near the front",
    ],
  },
  {
    slug: "tug-of-war",
    name: "Tug of War",
    category: "Strength",
    type: "team",
    description:
      "Two teams grip a single rope and pull with everything they've got. The team that drags the center marker past their line wins.",
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
      "Sitting or lying down to anchor is not permitted",
      "If the rope is dropped by an entire team, the other team wins automatically",
    ],
    setup: [
      "Mark the center line and each team's target line (usually 2–3m from center)",
      "Tie a visible marker at the rope's midpoint",
      "Ensure the ground is even and safe for footing on both sides",
    ],
    scoring: "Best of 3 pulls. The team that wins 2 pulls takes the match.",
    tips: [
      "Place your strongest members at the back as anchors",
      "Lean back and dig your heels in — use body weight, not just arms",
      "Pull in coordinated bursts on a count rather than continuous strain",
    ],
  },
  {
    slug: "conditioned-relay",
    name: "Conditioned 75m Relay",
    category: "Track",
    type: "team",
    description:
      "A relay race where each 75m leg comes with a unique condition — run backwards, hop on one foot, or carry a teammate. Versatility wins.",
    icon: RotateCcw,
    color: "#22C55E",
    participants: "Full team (one runner per leg)",
    equipment: [
      "Baton or handoff object",
      "Whistle",
      "Stopwatch",
      "Leg markers",
      "Condition signs",
    ],
    rules: [
      "Each leg of the relay is 75m with a specific condition that must be followed",
      "The baton must be handed off within the designated exchange zone",
      "Failing to follow a leg's condition results in the team repeating that leg",
      "A whistle blast signals the start of the race",
      "The team's time is recorded when the final runner crosses the finish line with the baton",
    ],
    setup: [
      "Mark each 75m leg with clear start/end lines and exchange zones",
      "Post the condition for each leg visibly at the start of that segment",
      "Assign one time-keeper per team at the finish line",
    ],
    scoring:
      "Fastest total team time wins. Penalties (repeat legs) add to total time.",
    tips: [
      "Assign legs based on each runner's strengths and the condition requirements",
      "Practice baton handoffs to avoid fumbles in the exchange zone",
    ],
  },
];

export const allEvents: EventRule[] = [...soloEvents, ...teamEvents];

export function getEventBySlug(slug: string): EventRule | undefined {
  return allEvents.find((e) => e.slug === slug);
}
