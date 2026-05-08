"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Trophy,
  Users,
  Zap,
  BookOpen,
  ArrowRight,
  Flame,
  Calendar,
  Medal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  StaggerContainer,
  StaggerItem,
} from "@/components/ui/page-transition";
import { useAppStore } from "@/lib/store";
import { allEvents } from "@/lib/events";

const soloEvents = allEvents.filter((e) => e.type === "solo");
const teamEvents = allEvents.filter((e) => e.type === "team");

const EVENT_TIME = new Date("2026-08-08T10:00:00").getTime();

function useCountdown() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
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
      <p className="font-mono text-3xl sm:text-4xl font-bold text-white tabular-nums">
        {String(value).padStart(2, "0")}
      </p>
      <p className="text-[10px] text-white/40 uppercase tracking-widest mt-1">
        {label}
      </p>
    </div>
  );
}

export default function HomePage() {
  const user = useAppStore((s) => s.user);
  const countdown = useCountdown();

  return (
    <div className="overflow-hidden">
      {/* Hero */}
      <section className="relative bg-navy text-white overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-96 h-96 bg-coral/8 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-gold/8 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-28 sm:py-36 lg:py-44 text-center">
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
              <h1 className="font-display text-6xl sm:text-7xl lg:text-9xl font-bold tracking-tight leading-none">
                <span className="text-white">CASUAL</span>
                <span className="text-coral">YMPICS</span>
                <span className="text-gold text-xl sm:text-2xl lg:text-3xl align-super">™</span>
              </h1>
            </StaggerItem>

            <StaggerItem>
              <p className="mt-6 text-base sm:text-lg text-white/60 max-w-lg mx-auto leading-relaxed">
                Get your teams together. Let&apos;s have some fun.
              </p>
            </StaggerItem>

            <StaggerItem>
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
                {user ? (
                  <Link href="/dashboard">
                    <Button size="lg">
                      Dashboard
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                ) : (
                  <Link href="/signup">
                    <Button size="lg">
                      Join the Games
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                )}
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
            className="mt-16"
          >
            {countdown.isOver ? (
              <p className="text-sm font-semibold text-gold uppercase tracking-widest">
                Game Day is Here!
              </p>
            ) : (
              <div className="inline-flex items-center gap-5 sm:gap-8 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 px-8 py-5">
                <CountdownUnit value={countdown.days} label="Days" />
                <span className="text-white/20 text-2xl font-light">:</span>
                <CountdownUnit value={countdown.hours} label="Hours" />
                <span className="text-white/20 text-2xl font-light">:</span>
                <CountdownUnit value={countdown.minutes} label="Min" />
                <span className="text-white/20 text-2xl font-light">:</span>
                <CountdownUnit value={countdown.seconds} label="Sec" />
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* Quick Links Strip */}
      <section className="bg-card border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border">
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
                  className="flex items-center justify-center gap-2 py-5 hover:bg-background transition-colors group"
                >
                  <Icon
                    className="w-4 h-4 transition-transform group-hover:scale-110"
                    style={{ color: link.color }}
                  />
                  <span className="text-sm font-semibold text-foreground">
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

      {/* CTA */}
      <section className="bg-navy text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Medal className="w-10 h-10 text-gold mx-auto mb-5" />
            <h2 className="font-display text-3xl sm:text-4xl font-bold mb-3">
              {user ? "YOUR GAMES AWAIT" : "READY TO COMPETE?"}
            </h2>
            <p className="text-white/50 text-sm max-w-md mx-auto mb-8">
              {user
                ? "Check scores, manage your team, and stay on top of the action."
                : "Sign up, form your team, and get ready. It takes 2 minutes."}
            </p>
            <Link href={user ? "/dashboard" : "/signup"}>
              <Button
                size="lg"
                className="bg-coral hover:bg-coral-light text-white"
              >
                {user ? "Go to Dashboard" : "Get Started"}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
