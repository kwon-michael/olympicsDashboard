"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  Trash2,
  AlertTriangle,
  Undo2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { PageTransition } from "@/components/ui/page-transition";
import { logAudit } from "@/lib/audit";
import { canViewAuditLog } from "@/lib/auth";

interface AuditEntry {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  details: Record<string, unknown> | null;
  table_name: string | null;
  row_id: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reverted_at: string | null;
  created_at: string;
  actor: { display_name: string } | { display_name: string }[] | null;
}

interface ActivityEntry {
  id: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  user: { display_name: string } | { display_name: string }[] | null;
}

function getDisplayName(joined: { display_name: string } | { display_name: string }[] | null | undefined): string {
  if (!joined) return "Unknown";
  if (Array.isArray(joined)) return joined[0]?.display_name ?? "Unknown";
  return joined.display_name ?? "Unknown";
}

// Resolve who acted, preferring the live profile join and falling back to the
// name snapshotted on the log row when the account has since been deleted.
function resolveName(
  joined: { display_name: string } | { display_name: string }[] | null | undefined,
  snapshot: string | null
): string {
  const live = getDisplayName(joined);
  if (live !== "Unknown") return live;
  if (snapshot) return `${snapshot} (removed)`;
  return "Unknown";
}

function actionColor(action: string): { bg: string; text: string } {
  if (action === "revert") {
    return { bg: "bg-violet-500/10", text: "text-violet-500" };
  }
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

const PAGE_SIZE_OPTIONS = [5, 20, 50];
const DEFAULT_PAGE_SIZE = 20;

// Admin actions whose entries can be reverted, given a captured snapshot. These
// are the straightforward single-row data tables; tournament/bracket actions
// are intentionally excluded because reverting them would leave derived state
// (seeding, bracket propagation) inconsistent.
const REVERTIBLE_TABLES = new Set([
  "roster_players",
  "roster_scores",
  "solo_results",
  "schedule_entries",
]);

function isRevertible(entry: AuditEntry): boolean {
  if (entry.reverted_at) return false;
  if (!entry.table_name || !REVERTIBLE_TABLES.has(entry.table_name)) return false;
  if (entry.action === "delete") return !!entry.before;
  if (entry.action === "create" || entry.action === "update") {
    return !!entry.row_id && (entry.action === "create" || !!entry.before);
  }
  return false;
}

const adminActionLabels: Record<string, string> = {
  create: "Created",
  update: "Updated",
  delete: "Deleted",
  clear: "Cleared",
  revert: "Reverted",
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

// Plain-language summary of what reverting a given entry will do.
function revertDescription(entry: AuditEntry): string {
  const target = (entry.table_name ?? entry.entity_type).replace(/_/g, " ");
  const label =
    (entry.details as Record<string, unknown> | null)?.title ??
    (entry.details as Record<string, unknown> | null)?.player ??
    (entry.details as Record<string, unknown> | null)?.label ??
    (entry.details as Record<string, unknown> | null)?.name ??
    "";
  const suffix = label ? ` ("${label}")` : "";
  switch (entry.action) {
    case "create":
      return `This will delete the ${target}${suffix} that was created.`;
    case "delete":
      return `This will restore the ${target}${suffix} that was deleted.`;
    case "update":
      return `This will roll the ${target}${suffix} back to its previous values.`;
    default:
      return "This will undo the recorded action.";
  }
}

export default function AdminAuditPage() {
  const supabase = createClient();
  const router = useRouter();

  // Access is restricted to the audit-log owner. null = still checking.
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  const [tab, setTab] = useState<Tab>("admin");

  // Rows per page (shared across both tabs).
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

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

  // Clear-log confirmation
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Revert confirmation
  const [revertTarget, setRevertTarget] = useState<AuditEntry | null>(null);
  const [reverting, setReverting] = useState(false);
  const [revertError, setRevertError] = useState<string | null>(null);

  // Fetch admin audit entries
  async function fetchAudit() {
    setAuditLoading(true);
    let query = supabase
      .from("audit_log")
      .select(
        "id, actor_id, actor_name, action, entity_type, entity_id, details, table_name, row_id, before, after, reverted_at, created_at, actor:users!audit_log_actor_id_fkey(display_name)",
        { count: "exact" }
      )
      .order("created_at", { ascending: auditSortAsc })
      .range((auditPage - 1) * pageSize, auditPage * pageSize - 1);

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
        "id, user_id, user_name, action, metadata, created_at, user:users!user_activity_user_id_fkey(display_name)",
        { count: "exact" }
      )
      .order("created_at", { ascending: activitySortAsc })
      .range((activityPage - 1) * pageSize, activityPage * pageSize - 1);

    if (activityFilterAction) query = query.eq("action", activityFilterAction);
    if (activityFilterUser) query = query.eq("user_id", activityFilterUser);

    const { data, count } = await query;
    setActivityEntries((data ?? []) as unknown as ActivityEntry[]);
    setActivityTotal(count ?? 0);
    setActivityLoading(false);
  }

  // Load filter dropdown options from the current log data
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

  // Delete every row from the active tab's log. The clear itself is recorded
  // in the admin audit log for accountability.
  async function clearLog() {
    setClearing(true);
    const table = tab === "admin" ? "audit_log" : "user_activity";
    const { error } = await supabase
      .from(table)
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (!error) {
      await logAudit(supabase, "clear", table, table, { scope: "all" });
      if (tab === "admin") {
        setAuditFilterAction("");
        setAuditFilterActor("");
        setAuditPage(1);
        await fetchAudit();
      } else {
        setActivityFilterAction("");
        setActivityFilterUser("");
        setActivityPage(1);
        await fetchActivity();
      }
      await loadFilterData();
    }
    setClearing(false);
    setShowClearModal(false);
  }

  // Reverse a previously-recorded admin action using its captured snapshot:
  // undo a create by deleting the row, restore a delete by re-inserting it, or
  // roll an update back to the `before` values. The audit entry is then marked
  // reverted and the reversal itself is logged for accountability.
  async function revertEntry(entry: AuditEntry) {
    if (!entry.table_name) return;
    setReverting(true);
    setRevertError(null);

    let error: { message: string } | null = null;
    if (entry.action === "create") {
      ({ error } = await supabase
        .from(entry.table_name)
        .delete()
        .eq("id", entry.row_id));
    } else if (entry.action === "delete") {
      ({ error } = await supabase.from(entry.table_name).insert(entry.before));
    } else if (entry.action === "update") {
      ({ error } = await supabase
        .from(entry.table_name)
        .update(entry.before)
        .eq("id", entry.row_id));
    }

    if (error) {
      setRevertError(error.message);
      setReverting(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase
      .from("audit_log")
      .update({ reverted_at: new Date().toISOString(), reverted_by: user?.id ?? null })
      .eq("id", entry.id);
    await logAudit(supabase, "revert", entry.entity_type, entry.entity_id, {
      reverted_action: entry.action,
      target: entry.table_name,
    });

    setReverting(false);
    setRevertTarget(null);
    await fetchAudit();
    await loadFilterData();
    // Let other open admin views know the underlying data changed.
    window.dispatchEvent(new Event("scores-updated"));
  }

  // Gate access to the audit-log owner; everyone else is bounced to /admin.
  useEffect(() => {
    async function checkAccess() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (canViewAuditLog(user?.email)) {
        setAuthorized(true);
      } else {
        setAuthorized(false);
        router.replace("/admin");
      }
    }
    checkAccess();
  }, []);

  // Bootstrap: load filter options
  useEffect(() => {
    if (authorized) loadFilterData();
  }, [authorized]);

  useEffect(() => {
    if (authorized && tab === "admin") fetchAudit();
  }, [authorized, tab, auditPage, pageSize, auditFilterAction, auditFilterActor, auditSortAsc]);

  useEffect(() => {
    if (authorized && tab === "user") fetchActivity();
  }, [authorized, tab, activityPage, pageSize, activityFilterAction, activityFilterUser, activitySortAsc]);

  const auditTotalPages = Math.max(1, Math.ceil(auditTotal / pageSize));
  const activityTotalPages = Math.max(1, Math.ceil(activityTotal / pageSize));

  // Don't render log data until access is confirmed (redirect handles the rest).
  if (!authorized) {
    return (
      <PageTransition>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="p-8 text-center text-muted text-sm">
            {authorized === null ? "Checking access…" : "Redirecting…"}
          </div>
        </div>
      </PageTransition>
    );
  }

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

        <div className="flex items-start justify-between gap-3 mb-8">
          <div className="flex items-center gap-3">
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
          <Button
            variant="danger"
            size="sm"
            onClick={() => setShowClearModal(true)}
          >
            <Trash2 className="w-3.5 h-3.5" />
            {tab === "admin" ? "Clear admin log" : "Clear user activity"}
          </Button>
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
              <PageSizeControl
                pageSize={pageSize}
                onChange={(n) => { setPageSize(n); setAuditPage(1); }}
              />
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
                  <ul className="divide-y divide-border">
                    {auditEntries.map((entry) => {
                      const actorName = resolveName(entry.actor, entry.actor_name);
                      const detail =
                        (entry.details as Record<string, unknown> | null)?.title ??
                        (entry.details as Record<string, unknown> | null)?.name ??
                        (entry.details as Record<string, unknown> | null)?.team_name ??
                        "";
                      const colors = actionColor(entry.action);

                      return (
                        <li
                          key={entry.id}
                          className={`px-4 py-3 hover:bg-background/50 ${entry.reverted_at ? "opacity-50" : ""}`}
                        >
                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider shrink-0 ${colors.bg} ${colors.text}`}>
                              {formatAction(entry.action, adminActionLabels)}
                            </span>
                            <span className="font-medium text-foreground">
                              {actorName}
                            </span>
                            <span className="text-xs text-muted capitalize">
                              {entry.entity_type.replace(/_/g, " ")}
                            </span>
                            <span className="ml-auto text-xs text-muted whitespace-nowrap">
                              {new Date(entry.created_at).toLocaleString()}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                            {detail ? (
                              <span className="text-sm text-muted min-w-0 break-words">
                                {String(detail)}
                              </span>
                            ) : null}
                            {entry.reverted_at ? (
                              <span className="ml-auto text-[11px] text-muted italic shrink-0">
                                Reverted
                              </span>
                            ) : isRevertible(entry) ? (
                              <button
                                onClick={() => { setRevertError(null); setRevertTarget(entry); }}
                                className="ml-auto inline-flex items-center gap-1 text-xs text-coral hover:text-coral-light transition-colors shrink-0"
                                title="Undo this action"
                              >
                                <Undo2 className="w-3.5 h-3.5" />
                                Revert
                              </button>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  <Pagination
                    page={auditPage}
                    totalPages={auditTotalPages}
                    total={auditTotal}
                    pageSize={pageSize}
                    onPageChange={setAuditPage}
                  />
                </>
              )}
            </div>
          </div>
        )}

        {/* Clear confirmation modal */}
        {showClearModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-md p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-danger/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-danger" />
                </div>
                <h2 className="font-display text-lg font-bold text-foreground">
                  {tab === "admin" ? "Clear admin log?" : "Clear user activity?"}
                </h2>
              </div>
              <p className="text-sm text-muted mb-6">
                This permanently deletes{" "}
                <span className="font-semibold text-foreground">all</span>{" "}
                {tab === "admin" ? "admin action" : "user activity"} entries. This
                cannot be undone.
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowClearModal(false)}
                  disabled={clearing}
                  className="text-sm text-muted hover:text-foreground transition-colors px-4 py-2 disabled:opacity-50"
                >
                  Cancel
                </button>
                <Button variant="danger" size="sm" loading={clearing} onClick={clearLog}>
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear log
                </Button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Revert confirmation modal */}
        {revertTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-md p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-coral/10 flex items-center justify-center shrink-0">
                  <Undo2 className="w-5 h-5 text-coral" />
                </div>
                <h2 className="font-display text-lg font-bold text-foreground">
                  Revert this action?
                </h2>
              </div>
              <p className="text-sm text-muted mb-4">
                {revertDescription(revertTarget)}
              </p>
              <p className="text-xs text-muted mb-6">
                The original entry stays in the log marked as reverted, and the
                reversal is recorded separately.
              </p>
              {revertError && (
                <p className="text-xs text-danger mb-4">{revertError}</p>
              )}
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => { setRevertTarget(null); setRevertError(null); }}
                  disabled={reverting}
                  className="text-sm text-muted hover:text-foreground transition-colors px-4 py-2 disabled:opacity-50"
                >
                  Cancel
                </button>
                <Button
                  size="sm"
                  loading={reverting}
                  onClick={() => revertEntry(revertTarget)}
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  Revert
                </Button>
              </div>
            </motion.div>
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
              <PageSizeControl
                pageSize={pageSize}
                onChange={(n) => { setPageSize(n); setActivityPage(1); }}
              />
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
                  <ul className="divide-y divide-border">
                    {activityEntries.map((entry) => {
                      const userName = resolveName(entry.user, entry.user_name);
                      const meta = entry.metadata as Record<string, unknown> | null;
                      const detail = meta
                        ? Object.entries(meta)
                            .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
                            .join(", ")
                        : "";
                      const colors = actionColor(entry.action);

                      return (
                        <li key={entry.id} className="px-4 py-3 hover:bg-background/50">
                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider shrink-0 ${colors.bg} ${colors.text}`}>
                              {formatAction(entry.action, userActionLabels)}
                            </span>
                            <span className="font-medium text-foreground">
                              {userName}
                            </span>
                            <span className="ml-auto text-xs text-muted whitespace-nowrap">
                              {new Date(entry.created_at).toLocaleString()}
                            </span>
                          </div>

                          {detail ? (
                            <p className="text-sm text-muted break-words mt-1">
                              {detail}
                            </p>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>

                  <Pagination
                    page={activityPage}
                    totalPages={activityTotalPages}
                    total={activityTotal}
                    pageSize={pageSize}
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

function PageSizeControl({
  pageSize,
  onChange,
}: {
  pageSize: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 ml-auto">
      <span className="text-xs text-muted">Per page</span>
      <div className="w-20">
        <Select
          value={String(pageSize)}
          onChange={(e) => onChange(Number(e.target.value))}
          options={PAGE_SIZE_OPTIONS.map((n) => ({ value: String(n), label: String(n) }))}
        />
      </div>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border">
      <span className="text-xs text-muted">
        Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
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
