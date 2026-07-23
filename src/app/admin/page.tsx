"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Trophy,
  Users,
  Calendar,
  Shield,
  TrendingUp,
  Activity,
  ChevronRight,
  UserX,
  ScrollText,
  Swords,
  Medal,
  Eye,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { canViewAuditLog, VOLUNTEER_ADMIN_PATHS } from "@/lib/auth";
import { useAppStore } from "@/lib/store";
import { PageTransition, StaggerContainer, StaggerItem } from "@/components/ui/page-transition";

interface AdminStats {
  totalTeams: number;
  totalPlayers: number;
  totalScores: number;
  recentActivity: { action: string; entity_type: string; entity_id: string; details: Record<string, unknown> | null; created_at: string; actor_id: string; actor: { display_name: string } | { display_name: string }[] }[];
}

// Links shown to every admin.
const adminLinks = [
  {
    href: "/admin/scores",
    label: "Score Management",
    description: "Award points to teams and players",
    icon: Trophy,
    color: "#F5A623",
  },
  {
    href: "/admin/solo",
    label: "Solo Events",
    description: "Record per-event results; auto-ranks teams and awards placement points",
    icon: Medal,
    color: "#3B82F6",
  },
  {
    href: "/admin/team-events",
    label: "Team Events",
    description: "Record all four team games — Tail Grab, Conditional Relay, Tug of War, Dodgeball",
    icon: Swords,
    color: "#F43F5E",
  },
  {
    href: "/admin/roster",
    label: "Team Management",
    description: "Move players between teams, cross out, or replace",
    icon: Users,
    color: "#22C55E",
  },
  {
    href: "/admin/schedule",
    label: "Schedule & Events",
    description: "Build the event-day calendar and manage time blocks",
    icon: Calendar,
    color: "#8B5CF6",
  },
  {
    href: "/admin/players",
    label: "Player Management",
    description: "View and remove registered players",
    icon: UserX,
    color: "#EF4444",
  },
];

// Restricted to the audit-log owner (see canViewAuditLog).
const auditLink = {
  href: "/admin/audit",
  label: "Activity Logs",
  description: "Admin actions and user activity with filters",
  icon: ScrollText,
  color: "#64748B",
};

export default function AdminDashboardPage() {
  const supabase = createClient();
  const [stats, setStats] = useState<AdminStats>({
    totalTeams: 0,
    totalPlayers: 0,
    totalScores: 0,
    recentActivity: [],
  });
  const [loading, setLoading] = useState(true);
  const [canViewAudit, setCanViewAudit] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const viewAsVolunteer = useAppStore((s) => s.viewAsVolunteer);
  const setViewAsVolunteer = useAppStore((s) => s.setViewAsVolunteer);

  useEffect(() => {
    async function fetchStats() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const auditAllowed = canViewAuditLog(user?.email);
      setCanViewAudit(auditAllowed);

      // Role drives which tools are shown (see links filter below).
      if (user) {
        const { data: profile } = await supabase
          .from("users")
          .select("role")
          .eq("id", user.id)
          .single();
        setRole(profile?.role ?? null);
      }

      const [teams, players, scores, audit] = await Promise.all([
        supabase.from("roster_teams").select("id", { count: "exact", head: true }),
        supabase.from("roster_players").select("id", { count: "exact", head: true }),
        supabase.from("roster_scores").select("id", { count: "exact", head: true }),
        // The activity feed is only fetched for the audit-log owner.
        auditAllowed
          ? supabase
              .from("audit_log")
              .select("action, entity_type, entity_id, details, created_at, actor_id, actor:users!audit_log_actor_id_fkey(display_name)")
              .order("created_at", { ascending: false })
              .limit(10)
          : Promise.resolve({ data: [] }),
      ]);

      setStats({
        totalTeams: teams.count ?? 0,
        totalPlayers: players.count ?? 0,
        totalScores: scores.count ?? 0,
        recentActivity: audit.data ?? [],
      });
      setLoading(false);
    }

    fetchStats();
  }, []);

  const isAdmin = role === "admin";
  // An admin previewing "view as volunteer" sees the same reduced tools as a
  // real volunteer.
  const showVolunteerView = role === "volunteer" || (isAdmin && viewAsVolunteer);

  // Volunteers only get the live-event tools; admins get everything, plus the
  // audit link for the single owner account.
  const links = showVolunteerView
    ? adminLinks.filter((l) => VOLUNTEER_ADMIN_PATHS.includes(l.href))
    : canViewAudit
      ? [...adminLinks, auditLink]
      : adminLinks;

  const statCards = [
    { label: "Teams", value: stats.totalTeams, icon: Users, color: "#22C55E" },
    {
      label: "Players",
      value: stats.totalPlayers,
      icon: Activity,
      color: "#3B82F6",
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
        <div className="flex items-center justify-between gap-3 mb-8">
          <div className="flex items-center gap-3">
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
          {/* Admins can preview the reduced volunteer experience. */}
          {isAdmin && !viewAsVolunteer && (
            <button
              onClick={() => setViewAsVolunteer(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-foreground border border-border hover:border-foreground/20 rounded-lg px-3 py-2 transition-colors shrink-0"
            >
              <Eye className="w-3.5 h-3.5" />
              View as volunteer
            </button>
          )}
        </div>

        {/* Stats Grid */}
        <StaggerContainer className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
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
          {links.map((link) => {
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

        {/* Recent Activity — restricted to the audit-log owner; hidden while
            previewing the volunteer view. */}
        {canViewAudit && !showVolunteerView && (
          <>
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
                const actorName = entry.actor
                  ? Array.isArray(entry.actor)
                    ? entry.actor[0]?.display_name ?? "Admin"
                    : entry.actor.display_name ?? "Admin"
                  : "Admin";
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
          </>
        )}
      </div>
    </PageTransition>
  );
}
