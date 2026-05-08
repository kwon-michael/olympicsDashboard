"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ScrollText,
  Shield,
  Users,
  Filter,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { PageTransition } from "@/components/ui/page-transition";

interface AuditEntry {
  id: string;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: Record<string, unknown> | null;
  created_at: string;
  actor: { display_name: string } | { display_name: string }[];
}

interface ActivityEntry {
  id: string;
  user_id: string;
  action: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  user: { display_name: string } | { display_name: string }[];
}

function getDisplayName(joined: { display_name: string } | { display_name: string }[] | null | undefined): string {
  if (!joined) return "Unknown";
  if (Array.isArray(joined)) return joined[0]?.display_name ?? "Unknown";
  return joined.display_name ?? "Unknown";
}

function actionColor(action: string): { bg: string; text: string } {
  if (action.startsWith("create") || action === "join_team" || action === "sign_in") {
    return { bg: "bg-emerald-500/10", text: "text-emerald-500" };
  }
  if (action.startsWith("delete") || action === "leave_team") {
    return { bg: "bg-red-500/10", text: "text-red-500" };
  }
  if (action.startsWith("update")) {
    return { bg: "bg-amber-500/10", text: "text-amber-500" };
  }
  return { bg: "bg-sky-500/10", text: "text-sky-500" };
}

type Tab = "admin" | "user";

const PAGE_SIZE = 25;

const adminActionLabels: Record<string, string> = {
  create: "Created",
  update: "Updated",
  delete: "Deleted",
};

const userActionLabels: Record<string, string> = {
  sign_in: "Signed in",
  create_team: "Created a team",
  join_team: "Joined a team",
  leave_team: "Left a team",
};

function formatAction(action: string, labels: Record<string, string>): string {
  return labels[action] ?? action.replace(/_/g, " ");
}

export default function AdminAuditPage() {
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>("admin");

  // Admin audit state
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditFilterAction, setAuditFilterAction] = useState("");
  const [auditFilterActor, setAuditFilterActor] = useState("");
  const [auditSortAsc, setAuditSortAsc] = useState(false);

  // User activity state
  const [activityEntries, setActivityEntries] = useState<ActivityEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityPage, setActivityPage] = useState(1);
  const [activityTotal, setActivityTotal] = useState(0);
  const [activityFilterAction, setActivityFilterAction] = useState("");
  const [activityFilterUser, setActivityFilterUser] = useState("");
  const [activitySortAsc, setActivitySortAsc] = useState(false);

  // Lookup data for filter dropdowns
  const [adminActors, setAdminActors] = useState<{ id: string; name: string }[]>([]);
  const [adminActions, setAdminActions] = useState<string[]>([]);
  const [userList, setUserList] = useState<{ id: string; name: string }[]>([]);
  const [userActions, setUserActions] = useState<string[]>([]);

  // Fetch admin audit entries
  async function fetchAudit() {
    setAuditLoading(true);
    let query = supabase
      .from("audit_log")
      .select(
        "id, actor_id, action, entity_type, entity_id, details, created_at, actor:users!audit_log_actor_id_fkey(display_name)",
        { count: "exact" }
      )
      .order("created_at", { ascending: auditSortAsc })
      .range((auditPage - 1) * PAGE_SIZE, auditPage * PAGE_SIZE - 1);

    if (auditFilterAction) query = query.eq("action", auditFilterAction);
    if (auditFilterActor) query = query.eq("actor_id", auditFilterActor);

    const { data, count } = await query;
    setAuditEntries((data ?? []) as unknown as AuditEntry[]);
    setAuditTotal(count ?? 0);
    setAuditLoading(false);
  }

  // Fetch user activity entries
  async function fetchActivity() {
    setActivityLoading(true);
    let query = supabase
      .from("user_activity")
      .select(
        "id, user_id, action, metadata, created_at, user:users!user_activity_user_id_fkey(display_name)",
        { count: "exact" }
      )
      .order("created_at", { ascending: activitySortAsc })
      .range((activityPage - 1) * PAGE_SIZE, activityPage * PAGE_SIZE - 1);

    if (activityFilterAction) query = query.eq("action", activityFilterAction);
    if (activityFilterUser) query = query.eq("user_id", activityFilterUser);

    const { data, count } = await query;
    setActivityEntries((data ?? []) as unknown as ActivityEntry[]);
    setActivityTotal(count ?? 0);
    setActivityLoading(false);
  }

  // Bootstrap: load filter options
  useEffect(() => {
    async function loadFilterData() {
      const [auditRes, activityRes, usersRes] = await Promise.all([
        supabase
          .from("audit_log")
          .select("action, actor_id, actor:users!audit_log_actor_id_fkey(display_name)"),
        supabase.from("user_activity").select("action, user_id, user:users!user_activity_user_id_fkey(display_name)"),
        supabase.from("users").select("id, display_name").order("display_name"),
      ]);

      // Extract unique admin actions and actors
      const aActions = new Set<string>();
      const aActors = new Map<string, string>();
      for (const row of (auditRes.data ?? []) as any[]) {
        aActions.add(row.action);
        const name = getDisplayName(row.actor);
        if (name !== "Unknown") {
          aActors.set(row.actor_id, name);
        }
      }
      setAdminActions([...aActions].sort());
      setAdminActors(
        [...aActors.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
      );

      // Extract unique user actions
      const uActions = new Set<string>();
      for (const row of (activityRes.data ?? []) as any[]) {
        uActions.add(row.action);
      }
      setUserActions([...uActions].sort());

      setUserList(
        (usersRes.data ?? []).map((u) => ({ id: u.id, name: u.display_name }))
      );
    }

    loadFilterData();
  }, []);

  useEffect(() => {
    if (tab === "admin") fetchAudit();
  }, [tab, auditPage, auditFilterAction, auditFilterActor, auditSortAsc]);

  useEffect(() => {
    if (tab === "user") fetchActivity();
  }, [tab, activityPage, activityFilterAction, activityFilterUser, activitySortAsc]);

  const auditTotalPages = Math.max(1, Math.ceil(auditTotal / PAGE_SIZE));
  const activityTotalPages = Math.max(1, Math.ceil(activityTotal / PAGE_SIZE));

  return (
    <PageTransition>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Admin
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-muted/10 flex items-center justify-center">
            <ScrollText className="w-6 h-6 text-muted" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              ACTIVITY LOGS
            </h1>
            <p className="text-sm text-muted">
              Track admin actions and user activity
            </p>
          </div>
        </div>

        {/* Tab toggle */}
        <div className="inline-flex items-center bg-card border border-border rounded-xl p-1 mb-6">
          <button
            onClick={() => { setTab("admin"); setAuditPage(1); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
              tab === "admin"
                ? "bg-coral text-white"
                : "text-muted hover:text-foreground"
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            Admin Actions
          </button>
          <button
            onClick={() => { setTab("user"); setActivityPage(1); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
              tab === "user"
                ? "bg-coral text-white"
                : "text-muted hover:text-foreground"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            User Activity
          </button>
        </div>

        {/* Admin Actions Tab */}
        {tab === "admin" && (
          <div>
            {/* Filters */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <Filter className="w-4 h-4 text-muted" />
              <div className="w-40">
                <Select
                  value={auditFilterAction}
                  onChange={(e) => { setAuditFilterAction(e.target.value); setAuditPage(1); }}
                  options={[
                    { value: "", label: "All Actions" },
                    ...adminActions.map((a) => ({ value: a, label: formatAction(a, adminActionLabels) })),
                  ]}
                />
              </div>
              <div className="w-44">
                <Select
                  value={auditFilterActor}
                  onChange={(e) => { setAuditFilterActor(e.target.value); setAuditPage(1); }}
                  options={[
                    { value: "", label: "All Admins" },
                    ...adminActors.map((a) => ({ value: a.id, label: a.name })),
                  ]}
                />
              </div>
              <button
                onClick={() => { setAuditSortAsc(!auditSortAsc); setAuditPage(1); }}
                className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors px-3 py-2 rounded-xl border border-border bg-background"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                {auditSortAsc ? "Oldest first" : "Newest first"}
              </button>
              {(auditFilterAction || auditFilterActor) && (
                <button
                  onClick={() => { setAuditFilterAction(""); setAuditFilterActor(""); setAuditPage(1); }}
                  className="text-xs text-coral hover:text-coral-light transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>

            <div className="bg-card rounded-xl border border-border overflow-hidden">
              {auditLoading ? (
                <div className="p-8 text-center text-muted text-sm">Loading...</div>
              ) : auditEntries.length === 0 ? (
                <div className="p-8 text-center text-muted text-sm">
                  No admin actions found.
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-background border-b border-border">
                        <tr>
                          <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase">
                            Admin
                          </th>
                          <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase">
                            Action
                          </th>
                          <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase">
                            Target
                          </th>
                          <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase">
                            Details
                          </th>
                          <th className="text-right px-4 py-3 font-semibold text-muted text-xs uppercase">
                            Time
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {auditEntries.map((entry) => {
                          const actorName = getDisplayName(entry.actor);
                          const detail =
                            (entry.details as Record<string, unknown> | null)?.title ??
                            (entry.details as Record<string, unknown> | null)?.name ??
                            (entry.details as Record<string, unknown> | null)?.team_name ??
                            "";
                          const colors = actionColor(entry.action);

                          return (
                            <tr key={entry.id} className="hover:bg-background/50">
                              <td className="px-4 py-3 font-medium">
                                {actorName}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${colors.bg} ${colors.text}`}>
                                  {formatAction(entry.action, adminActionLabels)}
                                </span>
                              </td>
                              <td className="px-4 py-3 capitalize text-muted">
                                {entry.entity_type.replace(/_/g, " ")}
                              </td>
                              <td className="px-4 py-3 text-muted truncate max-w-[200px]">
                                {detail ? String(detail) : "—"}
                              </td>
                              <td className="px-4 py-3 text-right text-xs text-muted whitespace-nowrap">
                                {new Date(entry.created_at).toLocaleString()}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <Pagination
                    page={auditPage}
                    totalPages={auditTotalPages}
                    total={auditTotal}
                    onPageChange={setAuditPage}
                  />
                </>
              )}
            </div>
          </div>
        )}

        {/* User Activity Tab */}
        {tab === "user" && (
          <div>
            {/* Filters */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <Filter className="w-4 h-4 text-muted" />
              <div className="w-40">
                <Select
                  value={activityFilterAction}
                  onChange={(e) => { setActivityFilterAction(e.target.value); setActivityPage(1); }}
                  options={[
                    { value: "", label: "All Actions" },
                    ...userActions.map((a) => ({ value: a, label: formatAction(a, userActionLabels) })),
                  ]}
                />
              </div>
              <div className="w-48">
                <Select
                  value={activityFilterUser}
                  onChange={(e) => { setActivityFilterUser(e.target.value); setActivityPage(1); }}
                  options={[
                    { value: "", label: "All Users" },
                    ...userList.map((u) => ({ value: u.id, label: u.name })),
                  ]}
                />
              </div>
              <button
                onClick={() => { setActivitySortAsc(!activitySortAsc); setActivityPage(1); }}
                className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors px-3 py-2 rounded-xl border border-border bg-background"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                {activitySortAsc ? "Oldest first" : "Newest first"}
              </button>
              {(activityFilterAction || activityFilterUser) && (
                <button
                  onClick={() => { setActivityFilterAction(""); setActivityFilterUser(""); setActivityPage(1); }}
                  className="text-xs text-coral hover:text-coral-light transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>

            <div className="bg-card rounded-xl border border-border overflow-hidden">
              {activityLoading ? (
                <div className="p-8 text-center text-muted text-sm">Loading...</div>
              ) : activityEntries.length === 0 ? (
                <div className="p-8 text-center text-muted text-sm">
                  No user activity found.
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-background border-b border-border">
                        <tr>
                          <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase">
                            User
                          </th>
                          <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase">
                            Action
                          </th>
                          <th className="text-left px-4 py-3 font-semibold text-muted text-xs uppercase">
                            Details
                          </th>
                          <th className="text-right px-4 py-3 font-semibold text-muted text-xs uppercase">
                            Time
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {activityEntries.map((entry) => {
                          const userName = getDisplayName(entry.user);
                          const meta = entry.metadata as Record<string, unknown> | null;
                          const detail = meta
                            ? Object.entries(meta)
                                .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
                                .join(", ")
                            : "";
                          const colors = actionColor(entry.action);

                          return (
                            <tr key={entry.id} className="hover:bg-background/50">
                              <td className="px-4 py-3 font-medium">
                                {userName}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${colors.bg} ${colors.text}`}>
                                  {formatAction(entry.action, userActionLabels)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-muted truncate max-w-[250px]">
                                {detail || "—"}
                              </td>
                              <td className="px-4 py-3 text-right text-xs text-muted whitespace-nowrap">
                                {new Date(entry.created_at).toLocaleString()}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <Pagination
                    page={activityPage}
                    totalPages={activityTotalPages}
                    total={activityTotal}
                    onPageChange={setActivityPage}
                  />
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}

function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border">
      <span className="text-xs text-muted">
        Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="p-1 rounded-lg text-muted hover:text-foreground hover:bg-background disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs text-muted px-2">
          Page {page} of {totalPages}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="p-1 rounded-lg text-muted hover:text-foreground hover:bg-background disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
