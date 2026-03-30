"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Timer,
  Target,
  Droplets,
  Flag,
  Brain,
  Mountain,
  Egg,
  Swords,
  BookOpen,
  ArrowRight,
} from "lucide-react";
import {
  PageTransition,
  StaggerContainer,
  StaggerItem,
} from "@/components/ui/page-transition";

const games = [
  {
    slug: "relay-race",
    name: "Relay Race",
    category: "Track",
    difficulty: "medium",
    description: "Sprint your heart out and pass the baton to your teammate!",
    icon: Timer,
    color: "#E94560",
  },
  {
    slug: "tug-of-war",
    name: "Tug of War",
    category: "Strength",
    difficulty: "hard",
    description: "Dig in your heels and pull with all your might!",
    icon: Swords,
    color: "#3B82F6",
  },
  {
    slug: "water-balloon-toss",
    name: "Water Balloon Toss",
    category: "Accuracy",
    difficulty: "easy",
    description: "Toss and catch without getting soaked!",
    icon: Droplets,
    color: "#06B6D4",
  },
  {
    slug: "sack-race",
    name: "Sack Race",
    category: "Track",
    difficulty: "easy",
    description: "Hop your way to the finish line in a burlap sack!",
    icon: Timer,
    color: "#F5A623",
  },
  {
    slug: "capture-the-flag",
    name: "Capture the Flag",
    category: "Strategy",
    difficulty: "hard",
    description: "Outsmart the opposition and capture their flag!",
    icon: Flag,
    color: "#22C55E",
  },
  {
    slug: "trivia-bowl",
    name: "Trivia Bowl",
    category: "Knowledge",
    difficulty: "medium",
    description: "Test your brainpower against the neighborhood&apos;s best!",
    icon: Brain,
    color: "#A855F7",
  },
  {
    slug: "obstacle-course",
    name: "Obstacle Course",
    category: "Endurance",
    difficulty: "hard",
    description: "Navigate the ultimate challenge course against the clock!",
    icon: Mountain,
    color: "#F43F5E",
  },
  {
    slug: "egg-and-spoon-race",
    name: "Egg & Spoon Race",
    category: "Balance",
    difficulty: "easy",
    description: "Steady hands win the race!",
    icon: Egg,
    color: "#EC4899",
  },
];

const difficultyConfig = {
  easy: { bg: "bg-success/10", text: "text-success" },
  medium: { bg: "bg-warning/10", text: "text-warning" },
  hard: { bg: "bg-danger/10", text: "text-danger" },
};

export default function RulesPage() {
  return (
    <PageTransition>
      {/* Header */}
      <div className="bg-navy text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-2 mb-4">
              <BookOpen className="w-4 h-4 text-gold" />
              <span className="text-sm font-medium text-white/80">
                Official Rulebook
              </span>
            </div>
            <h1 className="font-display text-4xl sm:text-5xl font-bold">
              GAME RULES
            </h1>
            <p className="mt-3 text-white/60 max-w-lg mx-auto">
              Everything you need to know about each event. Study up before game
              day!
            </p>
          </div>
        </div>
      </div>

      {/* Games Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {games.map((game) => {
            const Icon = game.icon;
            const diff = difficultyConfig[game.difficulty as keyof typeof difficultyConfig];

            return (
              <StaggerItem key={game.slug}>
                <Link href={`/rules/${game.slug}`}>
                  <div className="group relative bg-card rounded-2xl border border-border p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 cursor-pointer h-full">
                    <div
                      className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
                      style={{ backgroundColor: game.color }}
                    />

                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                      style={{ backgroundColor: game.color + "15" }}
                    >
                      <Icon
                        className="w-6 h-6"
                        style={{ color: game.color }}
                      />
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                        {game.category}
                      </span>
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${diff.bg} ${diff.text}`}
                      >
                        {game.difficulty}
                      </span>
                    </div>

                    <h3 className="font-display text-lg font-bold text-foreground group-hover:text-coral transition-colors mb-2">
                      {game.name}
                    </h3>

                    <p className="text-sm text-muted line-clamp-2">
                      {game.description}
                    </p>

                    <div className="flex items-center gap-1 mt-4 text-sm text-coral opacity-0 group-hover:opacity-100 transition-opacity">
                      Read Rules
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </Link>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      </div>
    </PageTransition>
  );
}
