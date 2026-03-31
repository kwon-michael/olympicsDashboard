"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  Users,
  RotateCcw,
  AlertTriangle,
  MapPin,
  Trophy,
  Info,
  Zap,
} from "lucide-react";
import { PageTransition } from "@/components/ui/page-transition";
import { getEventBySlug } from "@/lib/events";

export default function RuleDetailPage() {
  const params = useParams();
  const slug = params.gameSlug as string;
  const event = getEventBySlug(slug);

  if (!event) {
    return (
      <PageTransition className="max-w-3xl mx-auto px-4 py-12 text-center">
        <h1 className="font-display text-2xl font-bold">Event Not Found</h1>
        <p className="text-muted mt-2">
          The event you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link
          href="/rules"
          className="text-coral hover:text-coral-light mt-4 inline-block"
        >
          &larr; Back to Rules
        </Link>
      </PageTransition>
    );
  }

  const Icon = event.icon;
  const isTeam = event.type === "team";

  return (
    <PageTransition>
      {/* Hero */}
      <div
        className="relative overflow-hidden"
        style={{ backgroundColor: event.color + "10" }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-1"
          style={{ backgroundColor: event.color }}
        />
        <div
          className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-10"
          style={{ backgroundColor: event.color }}
        />

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
              style={{ backgroundColor: event.color + "20" }}
            >
              <Icon className="w-8 h-8" style={{ color: event.color }} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                  {event.category}
                </span>
                <span
                  className={`text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    isTeam
                      ? "bg-gold/10 text-gold"
                      : "bg-coral/10 text-coral"
                  }`}
                >
                  {isTeam ? "Team" : "Solo"}
                </span>
              </div>
              <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground">
                {event.name}
              </h1>
              <p className="text-muted mt-2 text-lg">{event.description}</p>
            </div>
          </div>

          {/* Quick info pills */}
          <div className="flex flex-wrap gap-2 mt-6">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted bg-white/80 rounded-full px-3 py-1.5 border border-border">
              {isTeam ? (
                <Users className="w-3.5 h-3.5" />
              ) : (
                <User className="w-3.5 h-3.5" />
              )}
              {event.participants}
            </span>
            {event.attempts && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted bg-white/80 rounded-full px-3 py-1.5 border border-border">
                <RotateCcw className="w-3.5 h-3.5" />
                {event.attempts}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Rules */}
        <section>
          <h2 className="font-display text-xl font-bold text-foreground mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-coral" />
            RULES
          </h2>
          <div className="bg-card rounded-xl border border-border p-5">
            <ol className="space-y-3">
              {event.rules.map((rule, i) => (
                <li key={i} className="flex gap-3">
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5"
                    style={{ backgroundColor: event.color }}
                  >
                    {i + 1}
                  </span>
                  <p className="text-sm text-muted leading-relaxed">{rule}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Setup */}
        <section>
          <h2 className="font-display text-xl font-bold text-foreground mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-info" />
            SETUP
          </h2>
          <div className="bg-card rounded-xl border border-border p-5">
            <ul className="space-y-2.5">
              {event.setup.map((item, i) => (
                <li
                  key={i}
                  className="text-sm text-muted flex items-start gap-2.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-info shrink-0 mt-1.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Scoring */}
        {event.scoring && (
          <section>
            <h2 className="font-display text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-gold" />
              SCORING
            </h2>
            <div
              className="rounded-xl border p-5"
              style={{
                backgroundColor: event.color + "08",
                borderColor: event.color + "20",
              }}
            >
              <p className="text-sm text-muted leading-relaxed">
                {event.scoring}
              </p>
            </div>
          </section>
        )}

        {/* Equipment */}
        <section>
          <h2 className="font-display text-xl font-bold text-foreground mb-4 flex items-center gap-2">
            <Info className="w-5 h-5 text-muted" />
            EQUIPMENT NEEDED
          </h2>
          <div className="flex flex-wrap gap-2">
            {event.equipment.map((item, i) => (
              <span
                key={i}
                className="text-sm font-medium text-muted bg-card rounded-full px-3.5 py-1.5 border border-border"
              >
                {item}
              </span>
            ))}
          </div>
        </section>

        {/* Tips */}
        {event.tips && event.tips.length > 0 && (
          <section>
            <h2 className="font-display text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-gold" />
              TIPS
            </h2>
            <div className="bg-card rounded-xl border border-border p-5">
              <ul className="space-y-2.5">
                {event.tips.map((tip, i) => (
                  <li
                    key={i}
                    className="text-sm text-muted flex items-start gap-2.5"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-gold shrink-0 mt-1.5" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}
      </div>
    </PageTransition>
  );
}
