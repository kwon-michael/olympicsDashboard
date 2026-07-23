"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Trophy,
  Users,
  BookOpen,
  ArrowRight,
  Flame,
  Calendar,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StaggerContainer, StaggerItem } from "@/components/ui/page-transition";
import { soloEvents, teamEvents } from "@/lib/events";

const EVENT_TIME = new Date("2026-08-08T10:00:00").getTime();

function useCountdown() {
  // Start from a deterministic value so the server render and the first client
  // render match (avoids hydration mismatch). Begin ticking only after mount.
  const [now, setNow] = useState(EVENT_TIME);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const diff = Math.max(0, EVENT_TIME - now);
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1_000);

  return { days, hours, minutes, seconds, isOver: diff === 0 };
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <p className="font-mono text-2xl sm:text-4xl font-bold text-white tabular-nums">
        {String(value).padStart(2, "0")}
      </p>
      <p className="text-[9px] sm:text-[10px] text-white/40 uppercase tracking-widest mt-1">
        {label}
      </p>
    </div>
  );
}

export default function HomePage() {
  const countdown = useCountdown();

  return (
    <div className="overflow-hidden">
      {/* Hero */}
      <section className="relative bg-navy text-white overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-96 h-96 bg-coral/8 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-gold/8 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32 lg:py-40 text-center">
          <StaggerContainer>
            <StaggerItem>
              <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 mb-8">
                <Flame className="w-3.5 h-3.5 text-coral" />
                <span className="text-xs font-semibold text-white/70 uppercase tracking-wider">
                  August 8, 2026
                </span>
              </div>
            </StaggerItem>

            <StaggerItem>
              <h1 className="font-display text-[clamp(2.75rem,13vw,8rem)] font-bold tracking-tight leading-none break-words">
                <span className="text-white">CASUAL</span>
                <span className="text-coral">YMPICS</span>
                <span className="text-gold text-[0.35em] align-super">™</span>
              </h1>
            </StaggerItem>

            <StaggerItem>
              <p className="mt-6 text-base sm:text-lg text-white/60 max-w-lg mx-auto leading-relaxed">
                Get your teams together. Let&apos;s have some fun.
              </p>
            </StaggerItem>

            <StaggerItem>
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link href="/format">
                  <Button size="lg">
                    Read the Format
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <Link href="/leaderboard">
                  <Button
                    variant="outline"
                    size="lg"
                    className="border-white/20 text-white hover:bg-white/10 hover:text-white"
                  >
                    Leaderboard
                    <Trophy className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </StaggerItem>
          </StaggerContainer>

          {/* Countdown */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-12 sm:mt-16"
          >
            {countdown.isOver ? (
              <p className="text-sm font-semibold text-gold uppercase tracking-widest">
                Game Day is Here!
              </p>
            ) : (
              <div className="inline-flex max-w-full items-center gap-2.5 sm:gap-8 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 px-4 sm:px-8 py-4 sm:py-5">
                <CountdownUnit value={countdown.days} label="Days" />
                <span className="text-white/20 text-lg sm:text-2xl font-light">:</span>
                <CountdownUnit value={countdown.hours} label="Hours" />
                <span className="text-white/20 text-lg sm:text-2xl font-light">:</span>
                <CountdownUnit value={countdown.minutes} label="Min" />
                <span className="text-white/20 text-lg sm:text-2xl font-light">:</span>
                <CountdownUnit value={countdown.seconds} label="Sec" />
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* Read-before-you-attend banner → Format page */}
      <Link
        href="/format"
        className="block bg-coral hover:bg-coral-light transition-colors"
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-center gap-3 text-center text-white">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <p className="text-sm sm:text-base font-semibold">
            New here?{" "}
            <span className="underline underline-offset-2">
              Read the format before game day
            </span>{" "}
            so you know exactly how points are won.
          </p>
        </div>
      </Link>

      {/* Quick Links Strip */}
      <section className="bg-card border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border">
            {[
              { icon: Trophy, label: "Leaderboard", href: "/leaderboard", color: "#F5A623" },
              { icon: Users, label: "Teams", href: "/teams", color: "#E94560" },
              { icon: Calendar, label: "Schedule", href: "/schedule", color: "#3B82F6" },
              { icon: BookOpen, label: "Rules", href: "/rules", color: "#22C55E" },
            ].map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center justify-center gap-1.5 sm:gap-2 py-4 sm:py-5 bg-card hover:bg-background transition-colors group"
                >
                  <Icon
                    className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110"
                    style={{ color: link.color }}
                  />
                  <span className="text-xs sm:text-sm font-semibold text-foreground whitespace-nowrap">
                    {link.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Events Grid */}
      <section className="py-20 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
              THE EVENTS
            </h2>
            <p className="mt-2 text-muted text-sm">
              {soloEvents.length} solo + {teamEvents.length} team competitions
            </p>
          </div>

          {/* Solo Events */}
          <div className="mb-10">
            <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-4">
              Solo
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {soloEvents.map((event, i) => {
                const Icon = event.icon;
                return (
                  <Link key={event.slug} href={`/rules/${event.slug}`}>
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.04 }}
                      className="flex items-center gap-3 bg-card rounded-xl border border-border p-4 hover:border-foreground/20 transition-colors group"
                    >
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: event.color + "12" }}
                      >
                        <Icon
                          className="w-4 h-4 group-hover:scale-110 transition-transform"
                          style={{ color: event.color }}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {event.name}
                        </p>
                        <p className="text-[10px] text-muted capitalize">
                          {event.scoringInput}
                        </p>
                      </div>
                    </motion.div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Team Events */}
          <div>
            <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-4">
              Team
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {teamEvents.map((event, i) => {
                const Icon = event.icon;
                return (
                  <Link key={event.slug} href={`/rules/${event.slug}`}>
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.04 }}
                      className="flex items-center gap-3 bg-card rounded-xl border border-border p-4 hover:border-foreground/20 transition-colors group"
                    >
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: event.color + "12" }}
                      >
                        <Icon
                          className="w-4 h-4 group-hover:scale-110 transition-transform"
                          style={{ color: event.color }}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {event.name}
                        </p>
                        <p className="text-[10px] text-muted capitalize">
                          {event.scoringInput}
                        </p>
                      </div>
                    </motion.div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* CTA → Format page */}
      <section className="bg-navy text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Flame className="w-10 h-10 text-coral mx-auto mb-5" />
            <h2 className="font-display text-3xl sm:text-4xl font-bold mb-3">
              KNOW BEFORE YOU GO
            </h2>
            <p className="text-white/50 text-sm max-w-md mx-auto mb-8">
              A two-minute read covering how the event runs, how points are
              scored, and answers to common questions.
            </p>
            <Link href="/format">
              <Button
                size="lg"
                className="bg-coral hover:bg-coral-light text-white"
              >
                Read the Format
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
