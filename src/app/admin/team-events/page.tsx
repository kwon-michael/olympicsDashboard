"use client";

import Link from "next/link";
import { ArrowLeft, ChevronRight, Swords } from "lucide-react";
import { PageTransition, StaggerContainer, StaggerItem } from "@/components/ui/page-transition";
import { getEventBySlug } from "@/lib/events";

// The four team games and where each one is recorded. Tail Grab and the
// Conditional Relay use the built-in results recorder; Tug of War and Dodgeball
// have their own tournament tools.
const games: { slug: string; href: string; description: string }[] = [
  {
    slug: "tail-grab",
    href: "/admin/team-events/tail-grab",
    description: "Record placement and tails grabbed per round; points computed automatically",
  },
  {
    slug: "conditioned-relay",
    href: "/admin/team-events/conditioned-relay",
    description: "Enter each team's final time; auto-ranks teams and awards placement points",
  },
  {
    slug: "tug-of-war",
    href: "/admin/tug-of-war",
    description: "Lock groups from standings, record matches, seed the bracket",
  },
  {
    slug: "dodgeball",
    href: "/admin/dodgeball",
    description: "Snake-seed groups from standings, record matches, seed the bracket",
  },
];

export default function TeamEventsHubPage() {
  return (
    <PageTransition className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Admin
      </Link>

      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-xl bg-coral/10 flex items-center justify-center">
          <Swords className="w-6 h-6 text-coral" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            TEAM EVENTS
          </h1>
          <p className="text-sm text-muted">
            Choose a game to record its results
          </p>
        </div>
      </div>

      <StaggerContainer className="grid sm:grid-cols-2 gap-4">
        {games.map((game) => {
          const event = getEventBySlug(game.slug);
          const Icon = event?.icon ?? Swords;
          const color = event?.color ?? "#E94560";
          return (
            <StaggerItem key={game.slug}>
              <Link href={game.href}>
                <div className="bg-card rounded-xl border border-border p-5 hover:border-foreground/20 transition-colors group h-full">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: color + "15" }}
                      >
                        <Icon className="w-5 h-5" style={{ color }} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground text-sm">
                          {event?.name ?? game.slug}
                        </h3>
                        <p className="text-xs text-muted mt-0.5">
                          {game.description}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted group-hover:text-foreground transition-colors" />
                  </div>
                </div>
              </Link>
            </StaggerItem>
          );
        })}
      </StaggerContainer>
    </PageTransition>
  );
}
