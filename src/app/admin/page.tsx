"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Trophy,
  Megaphone,
  Users,
  Calendar,
  Shield,
  TrendingUp,
  Activity,
  ChevronRight,
  UserX,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageTransition, StaggerContainer, StaggerItem } from "@/components/ui/page-transition";

interface AdminStats {
  totalTeams: number;
  totalUsers: number;
  totalEvents: number;
  totalScores: number;
  totalAnnouncements: number;
  recentActivity: { action: string; entity_type: string; entity_id: string; details: Record<string, unknown> | null; created_at: string; actor_id: string; actor: { display_name: string }[] }[];
}

const adminLinks = [
  {
    href: "/admin/scores",
    label: "Score Management",
    description: "Enter, edit, and verify event scores",
    icon: Trophy,
    color: "#F5A623",
  },
  {
    href: "/admin/announcements",
    label: "Announcements",
    description: "Compose and publish announcements",
    icon: Megaphone,
    color: "#E94560",
  },
  {
    href: "/admin/schedule",
    label: "Schedule & Events",
    description: "Build the event-day calendar and manage time blocks",
    icon: Calendar,
    color: "#8B5CF6",
  },
  {
    href: "/admin/teams",
    label: "Team Oversight",
    description: "Manage teams and roster changes",
    icon: Users,
    color: "#22C55E",
  },
  {
    href: "/admin/players",
    label: "Player Management",
    description: "View and remove registered players",
    icon: UserX,
    color: "#EF4444",
  },
];

export default function AdminDashboardPage() {
  const supabase = createClient();
  const [stats, setStats] = useState<AdminStats>({
    totalTeams: 0,
    totalUsers: 0,
    totalEvents: 0,
    totalScores: 0,
    totalAnnouncements: 0,
    recentActivity: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      const [teams, users, events, scores, announcements, audit] =
        await Promise.all([
          supabase.from("teams").select("id", { count: "exact", head: true }),
          supabase.from("users").select("id", { count: "exact", head: true }),
          supabase.from("events").select("id", { count: "exact", head: true }),
          supabase.from("scores").select("id", { count: "exact", head: true }),
          supabase
            .from("announcements")
            .select("id", { count: "exact", head: true }),
          supabase
            .from("audit_log")
            .select("action, entity_type, entity_id, details, created_at, actor_id, actor:users!audit_log_actor_id_fkey(display_name)")
            .order("created_at", { ascending: false })
            .limit(10),
        ]);

      setStats({
        totalTeams: teams.count ?? 0,
        totalUsers: users.count ?? 0,
        totalEvents: events.count ?? 0,
        totalScores: scores.count ?? 0,
        totalAnnouncements: announcements.count ?? 0,
        recentActivity: audit.data ?? [],
      });
      setLoading(false);
    }

    fetchStats();
  }, []);

  const statCards = [
    { label: "Teams", value: stats.totalTeams, icon: Users, color: "#22C55E" },
    {
      label: "Participants",
      value: stats.totalUsers,
      icon: Activity,
      color: "#3B82F6",
    },
    {
      label: "Events",
      value: stats.totalEvents,
      icon: Calendar,
      color: "#F5A623",
    },
    {
      label: "Scores Recorded",
      value: stats.totalScores,
      icon: TrendingUp,
      color: "#E94560",
    },
  ];

  return (
    <PageTransition>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-danger/10 flex items-center justify-center">
            <Shield className="w-6 h-6 text-danger" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              ADMIN DASHBOARD
            </h1>
            <p className="text-sm text-muted">
              Manage the Casualympics&trade;
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <StaggerContainer className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <StaggerItem key={stat.label}>
                <div className="bg-card rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Icon className="w-5 h-5" style={{ color: stat.color }} />
                  </div>
                  <p className="font-display text-2xl font-bold text-foreground">
                    {loading ? "—" : stat.value}
                  </p>
                  <p className="text-xs text-muted">{stat.label}</p>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerContainer>

        {/* Quick Actions */}
        <h2 className="font-display text-lg font-bold text-foreground mb-4">
          MANAGE
        </h2>
        <StaggerContainer className="grid sm:grid-cols-2 gap-4 mb-8">
          {adminLinks.map((link) => {
            const Icon = link.icon;
            return (
              <StaggerItem key={link.href}>
                <Link href={link.href}>
                  <div className="bg-card rounded-xl border border-border p-5 hover:border-foreground/20 transition-colors group">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: link.color + "15" }}
                        >
                          <Icon
                            className="w-5 h-5"
                            style={{ color: link.color }}
                          />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground text-sm">
                            {link.label}
                          </h3>
                          <p className="text-xs text-muted mt-0.5">
                            {link.description}
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

        {/* Recent Activity */}
        <h2 className="font-display text-lg font-bold text-foreground mb-4">
          RECENT ACTIVITY
        </h2>
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-muted text-sm">
              Loading audit log...
            </div>
          ) : stats.recentActivity.length === 0 ? (
            <div className="p-8 text-center text-muted text-sm">
              No activity recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {stats.recentActivity.map((entry, i) => {
                const actorName = entry.actor?.[0]?.display_name ?? "Admin";
                const detailLabel =
                  (entry.details as Record<string, unknown> | null)?.title ??
                  (entry.details as Record<string, unknown> | null)?.name ??
                  "";

                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="px-4 py-3 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-2 h-2 rounded-full bg-coral shrink-0" />
                      <p className="text-sm text-foreground truncate">
                        <span className="font-medium text-muted">
                          {actorName}
                        </span>{" "}
                        <span className="capitalize">
                          {entry.action.replace("_", " ")}d
                        </span>{" "}
                        a{" "}
                        <span className="font-medium capitalize">
                          {entry.entity_type.replace("_", " ")}
                        </span>
                        {detailLabel ? (
                          <span className="text-muted">
                            {" "}
                            &mdash; {String(detailLabel)}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <span className="text-xs text-muted whitespace-nowrap shrink-0">
                      {new Date(entry.created_at).toLocaleString()}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
