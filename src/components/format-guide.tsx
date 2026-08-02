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
  ChevronsUp,
} from "lucide-react";
import { StaggerContainer, StaggerItem } from "@/components/ui/page-transition";
import {
  soloEvents,
  teamEvents,
  getEventBySlug,
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
// What finishing 1st–4th in a tournament bracket pays. Tug of War and Dodgeball
// use the same scale, so either one stands for both.
const bracketScale =
  getEventBySlug("tug-of-war")?.teamScoring?.components?.find(
    (c) => c.key === "placement"
  )?.placementPoints ?? []; // 5 / 3 / 2 / 1

// What a grabbed tail pays in each Tail Grab round. Read from the scoring config
// so the guide can't drift from what the recorder actually awards.
const tailPoints = (key: string) =>
  getEventBySlug("tail-grab")?.teamScoring?.components?.find(
    (c) => c.key === key
  )?.pointsEach ?? 0;
const r1TailPoints = tailPoints("r1Tails"); // 1
const r2TailPoints = tailPoints("r2Tails"); // 2

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
        <a href="#playoff-priority" className="text-coral hover:underline">
          playoff priority
        </a>{" "}
        — a tiebreak edge in the Tug of War and Dodgeball brackets. So solo
        events still matter for the overall title.
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
    q: "Who officiates the games?",
    a: (
      <>
        Every game is officiated — a designated referee runs each event, makes
        the calls, and settles any disputes on the spot. Their ruling is final,
        so play hard and trust the whistle.
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
            turns into points, and the points feed two leaderboards:
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
              <strong>The solo bonus:</strong> while solo points don&apos;t
              contribute to team points, the{" "}
              <strong>top 3 teams in the solo events</strong> each carry{" "}
              <strong>+{SOLO_BONUS_POINTS} point</strong> onto the main team
              leaderboard and gain{" "}
              <a href="#playoff-priority" className="underline hover:no-underline">
                <strong>playoff priority</strong>
              </a>{" "}
              for the Tug of War and Dodgeball brackets.
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
        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-coral/30 bg-coral/5 p-4 text-sm text-foreground/90">
            <strong>Watch the relay.</strong> The Conditional Relay hands out by
            far the biggest placement points ({relayScale[0]} down to{" "}
            {relayScale[relayScale.length - 1]}), so it&apos;s often where the
            title is decided.
          </div>
          <div className="rounded-xl border border-gold/30 bg-gold/5 p-4 text-sm text-foreground/90">
            <strong>
              Tail Grab round 2 pays {r2TailPoints / r1TailPoints}× on
              eliminations.
            </strong>{" "}
            A tail pulled in round 1 is worth {r1TailPoints} point; the same tail
            in round 2 is worth <strong>{r2TailPoints}</strong>. Placement is
            scored separately each round and doesn&apos;t double — so a team that
            gets picked apart in round 1 can still claw it back by hunting tails
            in round 2.
          </div>
        </div>
      </section>

      {/* Playoff priority */}
      <section id="playoff-priority" className="scroll-mt-24">
        <SectionHeader
          icon={<ChevronsUp className="w-5 h-5 text-info" />}
          tint="bg-info/10"
          title="PLAYOFF PRIORITY"
          subtitle="What the solo top 3 carry into the brackets"
        />
        <div className="bg-card rounded-2xl border border-border p-6 space-y-5 text-sm text-foreground/90 leading-relaxed">
          <p>
            Finishing in the <strong>top 3 of the Solo leaderboard</strong> earns
            your team <strong>playoff priority</strong> — a marker carried into
            both the Tug of War and Dodgeball tournaments. It is worth{" "}
            <strong>no points at all</strong>. It does one thing:{" "}
            <strong>when teams are level, it breaks the tie your way.</strong>
          </p>

          <div className="space-y-4">
            <PriorityCase
              n={1}
              title="Inside your group"
              body={
                <>
                  Every group has exactly one winner and one runner-up, even when
                  teams finish level on round wins — the winner goes straight to
                  the bracket, the runner-up only makes the wildcard race. Those
                  positions are settled on paper, in this order, and{" "}
                  <strong>never by an extra game</strong>:
                </>
              }
              after={<TieChain />}
            />
            <PriorityCase
              n={2}
              title="The wildcard spot"
              body={
                <>
                  The three group runners-up compete for the{" "}
                  <strong>fourth and final bracket place</strong>, measured on
                  round wins. This is the{" "}
                  <strong>
                    only place inside a tournament where a tiebreaker game is
                    played
                  </strong>
                  , and priority decides whether one happens at all:
                </>
              }
              after={<WildcardOutcomes />}
            />
          </div>

          <div className="flex gap-3 rounded-xl border border-info/30 bg-info/5 p-4">
            <ChevronsUp className="w-5 h-5 text-info shrink-0 mt-0.5" />
            <p>
              <strong>Why it&apos;s worth chasing:</strong> two runners-up can
              finish dead level and one walks straight into the playoff bracket
              while the other has to win an extra game to get there — or misses
              out. Priority decides which one you are, in{" "}
              <strong>both tournaments</strong>. That&apos;s the real prize in the
              solo events: the{" "}
              <strong>+{SOLO_BONUS_POINTS} point</strong> is small, but reaching
              a bracket is worth {bracketScale[bracketScale.length - 1]}–
              {bracketScale[0]} placement points per tournament, plus every round
              you win on the way through.
            </p>
          </div>

          <div className="space-y-2 text-xs text-muted">
            <p>
              <strong className="text-foreground">Only the settled top 3.</strong>{" "}
              The Solo board runs its own tiebreaker, separately from the
              tournaments — but only when the game would decide{" "}
              <em>who holds priority</em>. A tie for 3rd is played off, because
              one of them takes the last spot and the other doesn&apos;t. A tie
              for 1st isn&apos;t: both teams are inside the top 3 whichever way
              it lands, so there&apos;s nothing to settle.
            </p>
            <p>
              <strong className="text-foreground">
                The team standings are never played off.
              </strong>{" "}
              Teams level on points there are ordered by their solo placement.
              The only tiebreaker games all day are the Solo top-3 boundary and
              the wildcard.
            </p>
            <p>
              <strong className="text-foreground">
                Priority beats no priority, never another priority.
              </strong>{" "}
              It lifts a marked team above the unmarked ones, but two marked
              teams are still level with each other — and that is what gets
              played off.
            </p>
          </div>
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

/** One numbered situation where playoff priority applies. */
function PriorityCase({
  n,
  title,
  body,
  after,
}: {
  n: number;
  title: string;
  body: React.ReactNode;
  after?: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span className="mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-info/10 font-mono text-xs font-bold text-info">
        {n}
      </span>
      <div className="min-w-0 space-y-2">
        <p>
          <strong className="text-foreground">{title}.</strong> {body}
        </p>
        {after}
      </div>
    </div>
  );
}

/**
 * The order a group table uses to separate teams level on round wins. Mirrors
 * the sort in `computeGroupStandings` — keep the two in step if that chain
 * changes. Priority is the highlighted link because it's the one step a team
 * can actually influence, and it's earned back in the solo events.
 *
 * It ends at seed because a group is always resolved on paper: no group tie is
 * ever played off. Tiebreaker games belong solely to the wildcard race — see
 * `WildcardOutcomes` and `computeQualifiers`.
 */
function TieChain() {
  const steps = ["Round wins", "Head-to-head", "Priority", "Seed"];
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {steps.map((step, i) => {
        const isPriority = step === "Priority";
        return (
          <span key={step} className="flex items-center gap-1.5">
            {i > 0 && (
              <ArrowRight aria-hidden className="h-3 w-3 shrink-0 text-muted/60" />
            )}
            <span
              className={
                isPriority
                  ? "rounded-full border border-info/40 bg-info/10 px-2.5 py-1 text-xs font-bold text-info"
                  : "rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted"
              }
            >
              {step}
            </span>
          </span>
        );
      })}
    </div>
  );
}

/**
 * What happens when the runners-up are level on round wins. Mirrors the branch
 * in `computeQualifiers`: the tied set narrows to the priority-holders when
 * there are any, and only a set of more than one is played off.
 */
function WildcardOutcomes() {
  const outcomes: { when: string; then: string; game: boolean }[] = [
    {
      when: "One of them has priority",
      then: "That team takes the wildcard outright",
      game: false,
    },
    {
      when: "Two or more have priority",
      then: "They play a tiebreaker game for it",
      game: true,
    },
    {
      when: "None of them has priority",
      then: "All the tied teams play it off",
      game: true,
    },
  ];
  return (
    <ul className="space-y-1.5">
      {outcomes.map((o) => (
        <li
          key={o.when}
          className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5"
        >
          <span
            className={
              o.game
                ? "rounded-full border border-border bg-background px-2 py-0.5 text-xs font-semibold text-muted"
                : "rounded-full border border-info/40 bg-info/10 px-2 py-0.5 text-xs font-semibold text-info"
            }
          >
            {o.when}
          </span>
          <span className="text-xs text-muted">
            {o.then}
            {o.game ? "" : " — no game"}
          </span>
        </li>
      ))}
    </ul>
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
