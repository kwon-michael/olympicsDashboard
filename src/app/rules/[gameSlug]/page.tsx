"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Timer,
  Target,
  Droplets,
  Flag,
  Brain,
  Mountain,
  Egg,
  Swords,
  Trophy,
  Users,
  Clock,
  HelpCircle,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";
import { PageTransition } from "@/components/ui/page-transition";

const gamesData: Record<
  string,
  {
    name: string;
    category: string;
    difficulty: string;
    tagline: string;
    color: string;
    icon: React.ElementType;
    overview: string;
    howToPlay: string[];
    scoring: string;
    faq: { q: string; a: string }[];
    visualizerType: string;
  }
> = {
  "relay-race": {
    name: "Relay Race",
    category: "Track",
    difficulty: "medium",
    tagline: "Speed meets teamwork in this classic sprint relay!",
    color: "#E94560",
    icon: Timer,
    overview:
      "The Relay Race is a classic track event where teams of four compete head-to-head. Each team member runs one leg of the course, passing a baton to the next runner at the transition zone. The team with the fastest combined time wins. It's a test of raw speed and seamless coordination.",
    howToPlay: [
      "Each team fields 4 runners, one per leg of the course",
      "Runners line up at their designated starting positions",
      "The first runner starts on the whistle and sprints to the transition zone",
      "The baton must be passed within the 10-meter transition zone",
      "Dropping the baton adds a 5-second penalty",
      "The final runner crosses the finish line to stop the clock",
    ],
    scoring:
      "Teams are ranked by total time (lowest wins). Each placement earns points: 1st = 100pts, 2nd = 80pts, 3rd = 60pts, 4th = 40pts, etc. Time penalties are added for dropped batons (5s each) and false starts (3s each).",
    faq: [
      {
        q: "What if someone drops the baton?",
        a: "The baton must be picked up by the runner who dropped it. A 5-second penalty is added to your total time.",
      },
      {
        q: "Can we choose our running order?",
        a: "Yes! Teams can arrange their runners in any order. Many teams put their fastest runner last (anchor position).",
      },
      {
        q: "How long is each leg?",
        a: "Each leg is approximately 100 meters, making it a 400-meter total relay.",
      },
    ],
    visualizerType: "relay",
  },
  "tug-of-war": {
    name: "Tug of War",
    category: "Strength",
    difficulty: "hard",
    tagline: "Dig deep, hold the line, and pull your way to victory!",
    color: "#3B82F6",
    icon: Swords,
    overview:
      "Tug of War is a battle of raw strength and team coordination. Two teams grip opposite ends of a thick rope and attempt to pull the center marker past their winning line. It's best-of-three rounds, so endurance and strategy matter just as much as brute force.",
    howToPlay: [
      "Each team positions an equal number of players along their side of the rope",
      "Players must grip the rope with both hands — no wrapping around arms or body",
      "On the whistle, both teams pull simultaneously",
      "The round is won when the center marker crosses the winning line on either side",
      "Best of 3 rounds determines the match winner",
      "30-second rest between rounds",
    ],
    scoring:
      "Match winner earns 100 points. Match loser earns 40 points. If a team wins 2-0 (sweep), they earn a 20-point bonus (120 total).",
    faq: [
      {
        q: "Can we anchor the rope around something?",
        a: "No! The rope must only be held in players' hands. No anchoring to objects, clothing, or body parts.",
      },
      {
        q: "What if a team member falls?",
        a: "Play continues. Fallen players may get back up and resume pulling immediately.",
      },
      {
        q: "How are teams matched?",
        a: "Matchups are determined by a random bracket. Teams are seeded based on their overall registration order.",
      },
    ],
    visualizerType: "tug",
  },
  "water-balloon-toss": {
    name: "Water Balloon Toss",
    category: "Accuracy",
    difficulty: "easy",
    tagline: "Keep it intact, keep your cool, keep tossing!",
    color: "#06B6D4",
    icon: Droplets,
    overview:
      "The Water Balloon Toss is a partner event testing gentle hands and accuracy. Pairs from each team face each other, tossing a water balloon back and forth. After each successful catch, both partners step one pace backward. The pair that achieves the greatest distance without popping their balloon wins.",
    howToPlay: [
      "Each team selects pairs of players to compete",
      "Partners face each other at a starting distance of 2 meters",
      "On each round, one partner gently tosses the balloon to the other",
      "If the balloon is caught successfully, both players step back one pace (~1 meter)",
      "If the balloon pops, that pair is eliminated from the round",
      "Last pair standing (or greatest distance achieved) wins",
    ],
    scoring:
      "Points awarded based on distance achieved: each successful catch = 10 points per meter of distance. Bonus 50 points for the last pair standing.",
    faq: [
      {
        q: "Can we use two hands to catch?",
        a: "Yes! Use any catching technique you like, as long as the balloon doesn't pop.",
      },
      {
        q: "What counts as a 'pop'?",
        a: "Any visible leak or burst. Even small sprays count as a pop.",
      },
      {
        q: "How many pairs per team?",
        a: "Each team may field up to 3 pairs. The team's score is the combined distance of all pairs.",
      },
    ],
    visualizerType: "balloon",
  },
  "sack-race": {
    name: "Sack Race",
    category: "Track",
    difficulty: "easy",
    tagline: "Hop, hop, hop to the finish line!",
    color: "#F5A623",
    icon: Timer,
    overview:
      "The Sack Race is a beloved classic. Competitors stand inside a burlap sack, holding it up at waist height, and hop their way down the course to the finish line. It's hilarious to watch and harder than it looks!",
    howToPlay: [
      "Each competitor steps into their burlap sack and holds it at waist height",
      "Feet must remain inside the sack at all times during the race",
      "On the whistle, competitors hop toward the finish line (50 meters)",
      "If a competitor falls, they must get back up and continue from where they fell",
      "Feet leaving the sack results in a restart from the last checkpoint",
      "First to cross the finish line wins their heat",
    ],
    scoring:
      "Heat winners earn 100 points, followed by 80, 60, 40, etc. by finishing order. Individual scores are added to the team total.",
    faq: [
      {
        q: "What if my sack rips?",
        a: "Replacement sacks are available. You'll restart from your current position with a new sack.",
      },
      {
        q: "Can I run instead of hop?",
        a: "No — the spirit of the event is hopping! A shuffling motion inside the sack is acceptable, but the sack must stay up.",
      },
    ],
    visualizerType: "race",
  },
  "capture-the-flag": {
    name: "Capture the Flag",
    category: "Strategy",
    difficulty: "hard",
    tagline: "Stealth, speed, and strategy — capture the flag to win!",
    color: "#22C55E",
    icon: Flag,
    overview:
      "Capture the Flag is a strategic team battle. Two teams each defend a flag in their territory while trying to capture the opponent's flag. Players tagged in enemy territory go to 'jail' and must be freed by a teammate. The first team to capture the opposing flag and return it to their base wins the round.",
    howToPlay: [
      "The playing field is divided into two equal territories with a clear center line",
      "Each team places their flag at the back of their territory",
      "Teams may deploy players on offense (flag capture) or defense (flag protection)",
      "Players tagged in enemy territory go to a designated 'jail' area",
      "A jailed player is freed when a teammate safely reaches and tags them",
      "To score, a player must grab the opponent's flag and return it to their own base without being tagged",
    ],
    scoring:
      "Flag capture = 100 points. Each successful jail break = 10 points. The team that captures the flag first earns a 50-point speed bonus. Best of 3 rounds.",
    faq: [
      {
        q: "Can we guard our flag directly?",
        a: "Yes, but no closer than 3 meters from the flag. This 'safe zone' applies to defenders only.",
      },
      {
        q: "How long are the rounds?",
        a: "Each round has a 10-minute time limit. If no flag is captured, the round is a draw and each team earns 20 points.",
      },
      {
        q: "What counts as a tag?",
        a: "A two-handed touch on the torso. No pushing, grabbing, or tackling.",
      },
    ],
    visualizerType: "field",
  },
  "trivia-bowl": {
    name: "Trivia Bowl",
    category: "Knowledge",
    difficulty: "medium",
    tagline: "Put your brainpower on display!",
    color: "#A855F7",
    icon: Brain,
    overview:
      "The Trivia Bowl is a rapid-fire knowledge competition. Teams compete in rounds of general knowledge, pop culture, science, history, and neighborhood-specific trivia. It's a buzzer race — first to ring in gets to answer. Correct answers earn points, wrong answers deduct points.",
    howToPlay: [
      "Each team fields 3-4 players as their trivia squad",
      "The host reads a question, and teams buzz in to answer",
      "The first team to buzz in has 10 seconds to provide an answer",
      "Correct answer: earn points. Wrong answer: lose half the question's point value",
      "If no team buzzes in within 15 seconds, the question is skipped",
      "Bonus round: a rapid-fire round with 20 quick questions worth 5 points each",
    ],
    scoring:
      "Regular questions: 10 points each. Hard questions: 20 points. Bonus round: 5 points per correct answer. Deductions for wrong buzzed-in answers are half the question value.",
    faq: [
      {
        q: "What categories are covered?",
        a: "General knowledge, pop culture, science, history, geography, and neighborhood-specific trivia (local landmarks, history, etc.).",
      },
      {
        q: "Can team members discuss before answering?",
        a: "No — the player who buzzed in must answer individually within 10 seconds.",
      },
      {
        q: "Is there a final round?",
        a: "Yes! A 'Championship Question' worth 50 points where teams can wager up to 50 of their existing points.",
      },
    ],
    visualizerType: "quiz",
  },
  "obstacle-course": {
    name: "Obstacle Course",
    category: "Endurance",
    difficulty: "hard",
    tagline: "The ultimate test of speed, strength, and grit!",
    color: "#F43F5E",
    icon: Mountain,
    overview:
      "The Obstacle Course is a multi-stage challenge course that tests all-around athletic ability. Competitors navigate through walls, crawl under nets, balance on beams, carry heavy objects, and sprint between checkpoints. Time is everything — and penalties for skipped obstacles add up.",
    howToPlay: [
      "Competitor starts at the starting line on the whistle",
      "Navigate through 8 obstacles in sequence: wall climb, net crawl, balance beam, tire run, rope swing, carry challenge, hurdles, and final sprint",
      "Each obstacle must be completed — skipping an obstacle adds a 30-second penalty",
      "Falling off an obstacle means restarting that obstacle from the beginning",
      "Clock stops when the competitor crosses the final finish line",
      "Best individual time for each team counts toward team score",
    ],
    scoring:
      "Points based on finish time. Fastest time = 100 points, then decreasing by 10 for each subsequent place. Penalties: +30s per skipped obstacle, +10s per failed attempt (max 3 attempts per obstacle).",
    faq: [
      {
        q: "Are there age-modified obstacles?",
        a: "Yes! Junior competitors (under 14) have modified versions of the wall climb and carry challenge.",
      },
      {
        q: "What happens if I can't complete an obstacle?",
        a: "After 3 attempts, you may bypass an obstacle with a 30-second penalty. Safety comes first!",
      },
      {
        q: "Is protective gear required?",
        a: "Closed-toe shoes are mandatory. Gloves are optional but recommended for the rope swing.",
      },
    ],
    visualizerType: "course",
  },
  "egg-and-spoon-race": {
    name: "Egg & Spoon Race",
    category: "Balance",
    difficulty: "easy",
    tagline: "Slow and steady doesn't always win — but steady hands do!",
    color: "#EC4899",
    icon: Egg,
    overview:
      "The Egg & Spoon Race is a delightful balance challenge. Each competitor holds a spoon with an egg balanced on it and races to the finish line. Drop the egg? Pick it up and keep going — but each drop adds a penalty. It's a race where patience and coordination beat raw speed.",
    howToPlay: [
      "Each competitor receives a spoon and a hard-boiled egg",
      "The spoon must be held in one hand with the arm extended",
      "No cupping, cradling, or using the other hand to steady the egg",
      "On the whistle, race 50 meters to the finish line",
      "If the egg drops, stop, pick it up, place it back on the spoon, and continue from that spot",
      "Each drop adds a 5-second penalty to your time",
    ],
    scoring:
      "Scoring is by finish time + penalties. 1st place = 100pts, 2nd = 80pts, 3rd = 60pts, decreasing by 10 thereafter. Each drop = +5 second penalty.",
    faq: [
      {
        q: "Are the eggs raw or hard-boiled?",
        a: "Hard-boiled! We're competitive, not cruel. (Though advanced competitors can opt for raw eggs for bonus entertainment.)",
      },
      {
        q: "Can I use a big spoon?",
        a: "No — standard tablespoons are provided for fairness. No spoon modifications allowed.",
      },
      {
        q: "What if my egg cracks?",
        a: "As long as the egg stays in one piece on the spoon, a cracked egg is fine. If it breaks apart, you get a replacement with a 10-second penalty.",
      },
    ],
    visualizerType: "balance",
  },
};

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full py-4 text-left"
      >
        <span className="font-semibold text-sm">{q}</span>
        <ChevronDown
          className={`w-4 h-4 text-muted transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="pb-4 text-sm text-muted"
        >
          {a}
        </motion.div>
      )}
    </div>
  );
}

// Simple visualizer components
function RelayVisualizer({ color }: { color: string }) {
  return (
    <div className="bg-background rounded-xl p-6 border border-border">
      <h4 className="font-display text-sm font-bold mb-4 uppercase text-muted">
        Course Diagram
      </h4>
      <div className="relative h-24">
        <div className="absolute inset-y-0 left-0 right-0 flex items-center">
          <div className="w-full h-2 bg-border rounded-full relative overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ backgroundColor: color }}
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            />
          </div>
        </div>
        {[0, 25, 50, 75, 100].map((pos) => (
          <div
            key={pos}
            className="absolute top-0 bottom-0 flex flex-col items-center justify-between"
            style={{ left: `${pos}%`, transform: "translateX(-50%)" }}
          >
            <span className="text-[10px] text-muted">{pos}m</span>
            <div
              className="w-3 h-3 rounded-full border-2"
              style={{ borderColor: color, backgroundColor: pos === 0 || pos === 100 ? color : "transparent" }}
            />
            <span className="text-[10px] text-muted">
              {pos === 0 ? "Start" : pos === 100 ? "Finish" : `Leg ${pos / 25}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GenericVisualizer({ color, type }: { color: string; type: string }) {
  return (
    <div className="bg-background rounded-xl p-6 border border-border">
      <h4 className="font-display text-sm font-bold mb-4 uppercase text-muted">
        Event Visualizer
      </h4>
      <div className="grid grid-cols-4 gap-2 h-32">
        {Array.from({ length: 8 }).map((_, i) => (
          <motion.div
            key={i}
            className="rounded-lg"
            style={{ backgroundColor: color + "20" }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
          >
            <div
              className="h-full rounded-lg"
              style={{
                backgroundColor: color,
                opacity: 0.1 + (i / 8) * 0.4,
              }}
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export default function RuleDetailPage() {
  const params = useParams();
  const slug = params.gameSlug as string;
  const game = gamesData[slug];

  if (!game) {
    return (
      <PageTransition className="max-w-3xl mx-auto px-4 py-12 text-center">
        <h1 className="font-display text-2xl font-bold">Game Not Found</h1>
        <p className="text-muted mt-2">
          The game you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link href="/rules" className="text-coral hover:text-coral-light mt-4 inline-block">
          &larr; Back to Rules
        </Link>
      </PageTransition>
    );
  }

  const Icon = game.icon;
  const diffColors = {
    easy: { bg: "bg-success/10", text: "text-success" },
    medium: { bg: "bg-warning/10", text: "text-warning" },
    hard: { bg: "bg-danger/10", text: "text-danger" },
  };
  const diff = diffColors[game.difficulty as keyof typeof diffColors];

  return (
    <PageTransition>
      {/* Hero */}
      <div className="relative overflow-hidden" style={{ backgroundColor: game.color + "10" }}>
        <div
          className="absolute top-0 left-0 right-0 h-1"
          style={{ backgroundColor: game.color }}
        />
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-10" style={{ backgroundColor: game.color }} />

        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Link
            href="/rules"
            className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            All Rules
          </Link>

          <div className="flex items-start gap-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: game.color + "20" }}
            >
              <Icon className="w-8 h-8" style={{ color: game.color }} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                  {game.category}
                </span>
                <span
                  className={`text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${diff.bg} ${diff.text}`}
                >
                  {game.difficulty}
                </span>
              </div>
              <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground">
                {game.name}
              </h1>
              <p className="text-muted mt-2 text-lg">{game.tagline}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Overview */}
        <section>
          <h2 className="font-display text-xl font-bold text-foreground mb-3">
            OVERVIEW
          </h2>
          <p className="text-muted leading-relaxed">{game.overview}</p>
        </section>

        {/* Visualizer */}
        {game.visualizerType === "relay" ? (
          <RelayVisualizer color={game.color} />
        ) : (
          <GenericVisualizer color={game.color} type={game.visualizerType} />
        )}

        {/* How to Play */}
        <section>
          <h2 className="font-display text-xl font-bold text-foreground mb-3 flex items-center gap-2">
            <Users className="w-5 h-5" style={{ color: game.color }} />
            HOW TO PLAY
          </h2>
          <ol className="space-y-3">
            {game.howToPlay.map((step, index) => (
              <motion.li
                key={index}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="flex gap-3"
              >
                <span
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5"
                  style={{ backgroundColor: game.color }}
                >
                  {index + 1}
                </span>
                <p className="text-sm text-muted leading-relaxed">{step}</p>
              </motion.li>
            ))}
          </ol>
        </section>

        {/* Scoring */}
        <section>
          <h2 className="font-display text-xl font-bold text-foreground mb-3 flex items-center gap-2">
            <Trophy className="w-5 h-5" style={{ color: game.color }} />
            SCORING
          </h2>
          <div
            className="p-4 rounded-xl border"
            style={{
              backgroundColor: game.color + "08",
              borderColor: game.color + "20",
            }}
          >
            <p className="text-sm text-muted leading-relaxed">
              {game.scoring}
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section>
          <h2 className="font-display text-xl font-bold text-foreground mb-3 flex items-center gap-2">
            <HelpCircle className="w-5 h-5" style={{ color: game.color }} />
            FAQ
          </h2>
          <div className="bg-card rounded-xl border border-border p-4">
            {game.faq.map((item, index) => (
              <FAQItem key={index} q={item.q} a={item.a} />
            ))}
          </div>
        </section>
      </div>
    </PageTransition>
  );
}
