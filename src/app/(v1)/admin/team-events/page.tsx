"use client";

import Link from "next/link";
import { ArrowLeft, ChevronRight, Swords } from "lucide-react";
import { PageTransition, StaggerContainer, StaggerItem } from "@/components/ui/page-transition";
import { getEventBySlug } from "@/lib/events";
import { byTeamEventDayOrder } from "@/lib/teamEvents";

// The four team games and where each one is recorded. Tail Grab and the
// Conditional Relay use the built-in results recorder; Tug of War and Dodgeball
// have their own tournament tools.
//
// Listed in event-day running order (see TEAM_EVENT_DAY_ORDER) so an admin
// working the event finds the next game to record at the top, rather than having
// to hunt for it.
const games: { slug: string; href: string; description: string; time: string }[] =
  byTeamEventDayOrder([
    {
      slug: "tug-of-war",
      href: "/admin/tug-of-war",
      description: "Lock groups from standings, record matches, seed the bracket",
      time: "13:00",
    },
    {
      slug: "dodgeball",
      href: "/admin/dodgeball",
      description: "Snake-seed groups from standings, record matches, seed the bracket",
      time: "14:00",
    },
    {
      slug: "tail-grab",
      href: "/admin/team-events/tail-grab",
      description:
        "Record placement and tails grabbed per round; points computed automatically",
      time: "15:00",
    },
    {
      slug: "conditioned-relay",
      href: "/admin/team-events/conditioned-relay",
      description:
        "Enter each team's final time; auto-ranks teams and awards placement points",
      time: "15:30",
    },
  ]);

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
            Choose a game to record its results — listed in the order they&apos;re
            played
          </p>
        </div>
      </div>

      <StaggerContainer className="grid gap-4 sm:grid-cols-2">
        {games.map((game, i) => {
          const event = getEventBySlug(game.slug);
          const Icon = event?.icon ?? Swords;
          const color = event?.color ?? "#E94560";
          return (
            <StaggerItem key={game.slug}>
              <Link href={game.href}>
                <div className="group h-full rounded-xl border border-border bg-card p-5 transition-colors hover:border-foreground/20">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-lg"
                        style={{ backgroundColor: color + "15" }}
                      >
                        <Icon className="h-5 w-5" style={{ color }} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] font-semibold tabular-nums text-muted">
                            {i + 1}
                          </span>
                          <h3 className="text-sm font-semibold text-foreground">
                            {event?.name ?? game.slug}
                          </h3>
                          <span className="font-mono text-[11px] tabular-nums text-muted">
                            {game.time}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted">
                          {game.description}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted transition-colors group-hover:text-foreground" />
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
