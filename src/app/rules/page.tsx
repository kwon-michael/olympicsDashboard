"use client";

import Link from "next/link";
import {
  BookOpen,
  User,
  Users,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import {
  PageTransition,
  StaggerContainer,
  StaggerItem,
} from "@/components/ui/page-transition";
import { soloEvents, teamEvents, type EventRule } from "@/lib/events";

/* ------------------------------------------------------------------ */
/*  Event Card (links to detail page)                                  */
/* ------------------------------------------------------------------ */

function EventCard({ event }: { event: EventRule }) {
  const Icon = event.icon;

  return (
    <Link href={`/rules/${event.slug}`}>
      <div className="group relative bg-card rounded-2xl border border-border p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 cursor-pointer h-full">
        <div
          className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
          style={{ backgroundColor: event.color }}
        />

        <div className="flex items-start gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: event.color + "15" }}
          >
            <Icon className="w-6 h-6" style={{ color: event.color }} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                {event.category}
              </span>
            </div>
            <h3 className="font-display text-lg font-bold text-foreground group-hover:text-coral transition-colors">
              {event.name}
            </h3>
          </div>
        </div>

        <p className="text-sm text-muted mt-3 line-clamp-2">
          {event.description}
        </p>

        {/* Quick info pills */}
        <div className="flex flex-wrap gap-2 mt-4">
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted bg-background rounded-full px-2.5 py-1 border border-border">
            <User className="w-3 h-3" />
            {event.participants}
          </span>
          {event.attempts && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted bg-background rounded-full px-2.5 py-1 border border-border">
              <RotateCcw className="w-3 h-3" />
              {event.attempts}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 mt-4 text-sm text-coral opacity-0 group-hover:opacity-100 transition-opacity">
          Read Rules
          <ArrowRight className="w-4 h-4" />
        </div>
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

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
              EVENT RULES
            </h1>
            <p className="mt-3 text-white/60 max-w-lg mx-auto">
              Everything you need to know about each event. Study up before game
              day!
            </p>
            <div className="flex items-center justify-center gap-6 mt-6">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-coral" />
                <span className="text-sm text-white/70">
                  <span className="font-mono font-bold text-coral">
                    {soloEvents.length}
                  </span>{" "}
                  Solo Events
                </span>
              </div>
              <div className="w-px h-4 bg-white/20" />
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gold" />
                <span className="text-sm text-white/70">
                  <span className="font-mono font-bold text-gold">
                    {teamEvents.length}
                  </span>{" "}
                  Team Events
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
        {/* Solo Events Section */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-coral/10 flex items-center justify-center">
              <User className="w-5 h-5 text-coral" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold text-foreground">
                SOLO EVENTS
              </h2>
              <p className="text-sm text-muted">
                Individual competitions — your performance, your glory
              </p>
            </div>
          </div>
          <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {soloEvents.map((event) => (
              <StaggerItem key={event.slug}>
                <EventCard event={event} />
              </StaggerItem>
            ))}
          </StaggerContainer>
        </section>

        {/* Team Events Section */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-gold" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold text-foreground">
                TEAM EVENTS
              </h2>
              <p className="text-sm text-muted">
                Compete together — coordination and teamwork win the day
              </p>
            </div>
          </div>
          <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {teamEvents.map((event) => (
              <StaggerItem key={event.slug}>
                <EventCard event={event} />
              </StaggerItem>
            ))}
          </StaggerContainer>
        </section>
      </div>
    </PageTransition>
  );
}
