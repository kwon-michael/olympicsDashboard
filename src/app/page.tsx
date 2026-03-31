"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Trophy,
  Users,
  Zap,
  BookOpen,
  ArrowRight,
  Flame,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  StaggerContainer,
  StaggerItem,
} from "@/components/ui/page-transition";
import { useAppStore } from "@/lib/store";
import { allEvents } from "@/lib/events";

const features = [
  {
    icon: Users,
    title: "Team Formation",
    description:
      "Create and customize your team in under 2 minutes. Choose your colors, set your motto, and rally your neighbors.",
    color: "#E94560",
  },
  {
    icon: Trophy,
    title: "Live Leaderboard",
    description:
      "Watch scores update in real-time with animated rankings, medal badges, and position-change indicators.",
    color: "#F5A623",
  },
  {
    icon: Zap,
    title: "Instant Announcements",
    description:
      "Never miss a moment. Real-time notifications for event starts, score updates, and celebration moments.",
    color: "#3B82F6",
  },
  {
    icon: BookOpen,
    title: "Interactive Rules",
    description:
      "Visual game guides with embedded videos, animated diagrams, and step-by-step instructions for every event.",
    color: "#22C55E",
  },
];


export default function HomePage() {
  const user = useAppStore((s) => s.user);

  return (
    <div className="overflow-hidden">
      {/* Hero Section */}
      <section className="relative bg-navy text-white overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-coral/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-gold/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-coral/5 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32 lg:py-40">
          <StaggerContainer className="text-center max-w-4xl mx-auto">
            <StaggerItem>
              <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-2 mb-8">
                <Flame className="w-4 h-4 text-coral" />
                <span className="text-sm font-medium text-white/80">
                  Digital Command Center
                </span>
              </div>
            </StaggerItem>

            <StaggerItem>
              <h1 className="font-display text-5xl sm:text-6xl lg:text-8xl font-bold tracking-tight leading-none">
                <span className="text-white">NEIGHBORHOOD</span>
                <br />
                <span className="text-coral">OLYMPICS</span>
              </h1>
            </StaggerItem>

            <StaggerItem>
              <p className="mt-6 text-lg sm:text-xl text-white/70 max-w-2xl mx-auto font-body leading-relaxed">
                The single hub for organizing, tracking, and celebrating your
                community&apos;s greatest sporting event. Real-time scores,
                team rivalries, and the glory of neighborhood champions.
              </p>
            </StaggerItem>

            <StaggerItem>
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                {user ? (
                  <Link href="/dashboard">
                    <Button size="lg" className="text-base">
                      Go to Dashboard
                      <ArrowRight className="w-5 h-5" />
                    </Button>
                  </Link>
                ) : (
                  <Link href="/signup">
                    <Button size="lg" className="text-base">
                      Join the Games
                      <ArrowRight className="w-5 h-5" />
                    </Button>
                  </Link>
                )}
                <Link href="/leaderboard">
                  <Button
                    variant="outline"
                    size="lg"
                    className="text-base border-white/30 text-white hover:bg-white/10 hover:text-white"
                  >
                    View Leaderboard
                    <Trophy className="w-5 h-5" />
                  </Button>
                </Link>
              </div>
            </StaggerItem>
          </StaggerContainer>

          {/* Floating stat cards */}
          <StaggerContainer className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {[
              { label: "Teams", value: "8+" },
              { label: "Events", value: String(allEvents.length) },
              { label: "Neighbors", value: "50+" },
              { label: "Glory", value: "∞" },
            ].map((stat) => (
              <StaggerItem key={stat.label}>
                <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-4 text-center">
                  <p className="font-mono text-2xl sm:text-3xl font-bold text-gold">
                    {stat.value}
                  </p>
                  <p className="text-xs text-white/50 uppercase tracking-wider mt-1">
                    {stat.label}
                  </p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground">
              EVERYTHING YOU NEED
            </h2>
            <p className="mt-4 text-muted text-lg max-w-2xl mx-auto">
              From sign-up to celebration, the Digital Command Center handles
              every aspect of your neighborhood Olympics.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ delay: index * 0.1 }}
                  className="group relative bg-card rounded-2xl border border-border p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                    style={{ backgroundColor: feature.color + "15" }}
                  >
                    <Icon
                      className="w-6 h-6"
                      style={{ color: feature.color }}
                    />
                  </div>
                  <h3 className="font-display text-xl font-bold text-foreground mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-muted text-sm leading-relaxed">
                    {feature.description}
                  </p>
                  <div
                    className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ backgroundColor: feature.color }}
                  />
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Events Preview */}
      <section className="py-24 bg-navy text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl sm:text-4xl font-bold">
              THE EVENTS
            </h2>
            <p className="mt-4 text-white/60 text-lg max-w-2xl mx-auto">
              {allEvents.length} competitions spanning track, field, strategy,
              and teamwork. Something for everyone.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {allEvents.map((event, index) => {
              const Icon = event.icon;
              return (
                <Link key={event.slug} href={`/rules/${event.slug}`}>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.03 }}
                    className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-5 text-center hover:bg-white/10 transition-colors group cursor-pointer"
                  >
                    <Icon className="w-8 h-8 mx-auto mb-3 text-gold group-hover:scale-110 transition-transform" />
                    <p className="font-display text-sm font-bold">
                      {event.name}
                    </p>
                    <p className="text-xs text-white/40 mt-1">
                      {event.category}
                    </p>
                  </motion.div>
                </Link>
              );
            })}
          </div>

          <div className="text-center mt-12">
            <Link href="/rules">
              <Button
                variant="outline"
                size="lg"
                className="border-white/30 text-white hover:bg-white/10 hover:text-white"
              >
                View All Rules
                <BookOpen className="w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-br from-coral to-coral-dark text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="font-display text-4xl sm:text-5xl font-bold mb-6">
              {user ? "YOUR GAMES AWAIT" : "READY TO COMPETE?"}
            </h2>
            <p className="text-lg text-white/80 mb-10 max-w-2xl mx-auto">
              {user
                ? "Head to your dashboard to check scores, manage your team, and stay on top of the action."
                : "Sign up, form your team, and get ready for the most exciting day in the neighborhood. It only takes 2 minutes."}
            </p>
            <Link href={user ? "/dashboard" : "/signup"}>
              <Button
                variant="secondary"
                size="lg"
                className="text-base bg-white text-coral hover:bg-white/90"
              >
                {user ? "Go to Dashboard" : "Get Started Now"}
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
