"use client";

import Link from "next/link";
import {
  Info,
  Trophy,
  User,
  Users,
  Star,
  Medal,
  Clock,
  BookOpen,
  ArrowRight,
} from "lucide-react";
import { StaggerContainer, StaggerItem } from "@/components/ui/page-transition";
import {
  soloEvents,
  teamEvents,
  getSoloPlacementPoints,
  getRelayPlacementPoints,
} from "@/lib/events";
import { SOLO_BONUS_POINTS } from "@/lib/solo";

const NUM_TEAMS = 9;
const PLAYERS_PER_TEAM = 6;

const ordinals = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];
// Derived from the scoring helpers so this guide can never drift from the engine.
const soloScale = [1, 2, 3, 4, 5].map(getSoloPlacementPoints); // 7 / 5 / 3 / 2 / 1
const relayScale = Array.from({ length: NUM_TEAMS }, (_, i) =>
  getRelayPlacementPoints(i + 1)
); // 15 / 12 / 10 / 8 / 6 / 5 / 3 / 2 / 1

function PlacementChips({ scale, color }: { scale: number[]; color: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {scale.map((pts, i) =>
        pts > 0 ? (
          <span
            key={i}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs"
          >
            <span className="font-semibold text-muted">{ordinals[i]}</span>
            <span className="font-mono font-bold" style={{ color }}>
              +{pts}
            </span>
          </span>
        ) : null
      )}
    </div>
  );
}

const faqs: { q: string; a: React.ReactNode }[] = [
  {
    q: "How does my team win?",
    a: (
      <>
        Your team&apos;s score is the sum of the points it earns across the four
        team events, plus a bonus for a strong showing in the solo events. The
        team with the highest total at the end wins. Standings update live on the{" "}
        <Link href="/leaderboard" className="text-coral hover:underline">
          Leaderboard
        </Link>
        .
      </>
    ),
  },
  {
    q: "Do my solo results count toward my team's total?",
    a: (
      <>
        Not directly. Solo events have their own <strong>Solo leaderboard</strong>.
        But the <strong>top 3 solo teams</strong> each earn{" "}
        <strong>+{SOLO_BONUS_POINTS} point</strong> on the main team board and{" "}
        <strong>playoff priority</strong> — a tiebreak edge in the Tug of War and
        Dodgeball brackets. So solo events still matter for the overall title.
      </>
    ),
  },
  {
    q: "Do I get to compete?",
    a: (
      <>
        Yes — everyone plays. Each team enters exactly one player in each solo
        event and no one doubles up, so all {PLAYERS_PER_TEAM} teammates take
        part. The whole team competes together in every team event.
      </>
    ),
  },
  {
    q: "Why is the Conditional Relay worth so many points?",
    a: (
      <>
        It&apos;s the ultimate team test, so it pays out the biggest placement
        points — up to <strong>+{relayScale[0]}</strong> for first. A strong (or
        weak) relay can swing the whole standings.
      </>
    ),
  },
  {
    q: "What happens on a tie?",
    a: (
      <>
        Solo and timed events use standard competition ranking: tied teams share
        the higher placement and its points, and the placement directly below is
        skipped. In the Tug of War and Dodgeball brackets, ties break toward the
        team with solo priority first, then a judge&apos;s call.
      </>
    ),
  },
  {
    q: 'When am I "out" in Tail Grab or Dodgeball?',
    a: (
      <>
        <strong>Tail Grab:</strong> you&apos;re out when your tail (towel) is
        pulled, your chain breaks, or you step outside the shrinking border.{" "}
        <strong>Dodgeball:</strong> you&apos;re out if a thrown ball hits you
        below the neck before it bounces, or if an opponent catches your throw
        (which also brings one of their teammates back). Tail Grab runs on the
        honor system — call yourself out.
      </>
    ),
  },
  {
    q: "Where do I find scores, schedule, and full rules?",
    a: (
      <>
        The{" "}
        <Link href="/leaderboard" className="text-coral hover:underline">
          Leaderboard
        </Link>{" "}
        has live standings, the{" "}
        <Link href="/schedule" className="text-coral hover:underline">
          Schedule
        </Link>{" "}
        has event-day timing, and the{" "}
        <Link href="/rules" className="text-coral hover:underline">
          Rules
        </Link>{" "}
        page has the full rulebook for every event.
      </>
    ),
  },
  {
    q: "Do I need an account?",
    a: "No. Everything here is public to view — just show up and compete. Only the organizers sign in to record results.",
  },
];

/**
 * The scoring/format explainer + FAQ, shared by the home page and the /format
 * route. Renders only the content sections (no page hero).
 */
export function FormatGuide() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-14">
      {/* The basics */}
      <section>
        <SectionHeader
          icon={<Trophy className="w-5 h-5 text-coral" />}
          tint="bg-coral/10"
          title="THE BASICS"
          subtitle="What you're competing for"
        />
        <div className="bg-card rounded-2xl border border-border p-6 space-y-3 text-sm text-foreground/90 leading-relaxed">
          <p>
            {NUM_TEAMS} teams of {PLAYERS_PER_TEAM} compete across two kinds of
            events: <strong>solo events</strong> (one player at a time) and{" "}
            <strong>team events</strong> (the whole team together). Every result
            turns into points, and the points feed three leaderboards:
          </p>
          <ul className="space-y-2">
            <LeaderboardRow
              icon={<Trophy className="w-4 h-4 text-gold" />}
              name="Teams"
              desc="The main standings that decide the champion — team-event points plus the solo top-3 bonus."
            />
            <LeaderboardRow
              icon={<Medal className="w-4 h-4 text-info" />}
              name="Solo"
              desc="Placement points across the solo events. The top 3 teams here earn the bonus and playoff priority."
            />
            <LeaderboardRow
              icon={<Star className="w-4 h-4 text-coral" />}
              name="Individual (MVP)"
              desc="Tracks points tied to a single player, for bragging rights."
            />
          </ul>
        </div>
      </section>

      {/* Solo scoring */}
      <section>
        <SectionHeader
          icon={<User className="w-5 h-5 text-info" />}
          tint="bg-info/10"
          title="EARNING POINTS — SOLO EVENTS"
          subtitle="Individual events, placement points"
        />
        <div className="bg-card rounded-2xl border border-border p-6 space-y-4 text-sm text-foreground/90 leading-relaxed">
          <p>
            Each team sends <strong>one player</strong> to each of the{" "}
            {soloEvents.length} solo events, and no player competes in more than
            one — so everyone gets a turn. In each event the teams are ranked by
            result (fastest time, longest distance, or most points) and earn{" "}
            <strong>placement points</strong>:
          </p>
          <PlacementChips scale={soloScale} color="#3B82F6" />
          <div className="rounded-xl border border-gold/30 bg-gold/5 p-4 flex gap-3">
            <Star className="w-5 h-5 text-gold shrink-0 mt-0.5" />
            <p className="text-sm">
              <strong>The solo bonus:</strong> solo points live on their own
              board, but the <strong>top 3 solo teams</strong> each carry{" "}
              <strong>+{SOLO_BONUS_POINTS} point</strong> onto the main team
              leaderboard and gain <strong>playoff priority</strong> for the Tug
              of War and Dodgeball brackets.
            </p>
          </div>
          <p className="text-xs text-muted">
            Ties share the higher placement and its points; the placement
            directly below is skipped.
          </p>
        </div>
      </section>

      {/* Team scoring */}
      <section>
        <SectionHeader
          icon={<Users className="w-5 h-5 text-gold" />}
          tint="bg-gold/10"
          title="EARNING POINTS — TEAM EVENTS"
          subtitle="Points here go straight to the team total"
        />
        <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {teamEvents.map((event) => {
            const Icon = event.icon;
            return (
              <StaggerItem key={event.slug}>
                <div className="bg-card rounded-2xl border border-border p-5 h-full">
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: event.color + "15" }}
                    >
                      <Icon className="w-5 h-5" style={{ color: event.color }} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-display text-base font-bold text-foreground truncate">
                        {event.name}
                      </h3>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                        {event.category}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-foreground/90 leading-relaxed">
                    {event.scoring}
                  </p>
                  <Link
                    href={`/rules/${event.slug}`}
                    className="inline-flex items-center gap-1 mt-3 text-xs font-medium text-coral hover:underline"
                  >
                    Full rules
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
        <div className="mt-4 rounded-xl border border-coral/30 bg-coral/5 p-4 text-sm text-foreground/90">
          <strong>Watch the relay.</strong> The Conditional Relay hands out by
          far the biggest placement points ({relayScale[0]} down to{" "}
          {relayScale[relayScale.length - 1]}), so it&apos;s often where the
          title is decided.
        </div>
      </section>

      {/* FAQ */}
      <section>
        <SectionHeader
          icon={<Info className="w-5 h-5 text-coral" />}
          tint="bg-coral/10"
          title="FAQ"
          subtitle="Quick answers"
        />
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <details
              key={i}
              className="group bg-card rounded-xl border border-border overflow-hidden"
            >
              <summary className="flex items-center justify-between gap-3 cursor-pointer list-none px-5 py-4 text-sm font-semibold text-foreground hover:bg-background/50 transition-colors">
                {faq.q}
                <ArrowRight className="w-4 h-4 text-muted shrink-0 transition-transform group-open:rotate-90" />
              </summary>
              <div className="px-5 pb-4 text-sm text-muted leading-relaxed">
                {faq.a}
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* Quick links */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <QuickLink
          href="/rules"
          icon={<BookOpen className="w-4 h-4" />}
          label="Full Rulebook"
        />
        <QuickLink
          href="/leaderboard"
          icon={<Trophy className="w-4 h-4" />}
          label="Live Standings"
        />
        <QuickLink
          href="/schedule"
          icon={<Clock className="w-4 h-4" />}
          label="Event Schedule"
        />
      </section>
    </div>
  );
}

function SectionHeader({
  icon,
  tint,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  tint: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tint}`}>
        {icon}
      </div>
      <div>
        <h2 className="font-display text-xl font-bold text-foreground">{title}</h2>
        <p className="text-sm text-muted">{subtitle}</p>
      </div>
    </div>
  );
}

function LeaderboardRow({
  icon,
  name,
  desc,
}: {
  icon: React.ReactNode;
  name: string;
  desc: string;
}) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>
        <strong className="text-foreground">{name}</strong>
        <span className="text-muted"> — {desc}</span>
      </span>
    </li>
  );
}

function QuickLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground hover:border-foreground/20 transition-colors"
    >
      {icon}
      {label}
    </Link>
  );
}
